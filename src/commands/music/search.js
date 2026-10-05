const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { SOURCES, sourceById, searchSource, resolveTrack } = require('../../player/sources');
const { nodeOptions } = require('../../player/search');
const views = require('../../ui/searchViews');
const { modeOf } = require('../../ui/text');
const { fail, requireVoice, requireVoicePermissions } = require('../../utils/guards');
const store = require('../../storage/playlists');
const logger = require('../../utils/logger');

const IDLE_MS = 180_000; // close after 3 minutes without activity
const MAX_MS = 14 * 60_000; // interaction tokens expire at 15 minutes
const MODAL_MS = 120_000;

/** userId -> their open session; opening a new search closes the old one. */
const activeSessions = new Map();

/**
 * One user's search session, shown in a private (ephemeral) message:
 *   source picker → results → song preview → play now / add to queue / save to playlist
 * Choices can be clicked, or typed as a number in chat when Message Content Intent is enabled.
 */
class SearchSession {
    constructor(interaction, query) {
        this.interaction = interaction;
        this.player = interaction.client.player;
        this.user = interaction.user;
        this.mode = modeOf(interaction.user);
        this.sid = interaction.id;
        this.query = query;
        this.typed = Boolean(interaction.client.typedChoices);
        this.sources = SOURCES;
        this.stage = 'sources';
        this.results = [];
        this.selected = null;
        this.status = null;
        this.chain = Promise.resolve(); // serialises clicks/typed input
        this.closed = false;
    }

    ctx(extra = {}) {
        return { mode: this.mode, sid: this.sid, query: this.query, typed: this.typed, sources: this.sources, ...extra };
    }

    async start(sourceId) {
        await activeSessions.get(this.user.id)?.close();
        activeSessions.set(this.user.id, this);

        const response = await this.interaction.reply({
            ...views.sourcePicker(this.ctx()),
            flags: MessageFlags.Ephemeral,
            withResponse: true,
        });
        this.listen(response.resource.message);
        if (sourceId) await this.run(() => this.search(sourceId));
    }

    listen(message) {
        const prefix = `srch:${this.sid}:`;
        this.components = message.createMessageComponentCollector({
            filter: (i) => i.customId.startsWith(prefix),
            idle: IDLE_MS,
            time: MAX_MS,
        });
        this.components.on('collect', (i) => this.run(() => this.onComponent(i, i.customId.slice(prefix.length))));
        this.components.on('end', () => void this.close());

        if (this.typed && this.interaction.channel) {
            this.messages = this.interaction.channel.createMessageCollector({
                filter: (m) => m.author.id === this.user.id && /^\s*\d{1,2}\s*$/.test(m.content),
                time: MAX_MS,
            });
            this.messages.on('collect', (m) => this.run(() => this.onTyped(m)));
        }
    }

    run(task) {
        this.chain = this.chain.then(task).catch(async (error) => {
            logger.error('Search session error', error);
            await fail(this.interaction, 'crash');
        });
        return this.chain;
    }

    render(view) {
        return this.interaction.editReply(view).catch(() => null);
    }

    // ── input handlers ─────────────────────────────────────────────────
    async onTyped(message) {
        const n = Number(message.content.trim());
        const list = this.stage === 'sources' ? this.sources : this.stage === 'results' ? this.results : null;
        if (!list || n < 1 || n > list.length) return;

        this.components.resetTimer();
        // Tidy up the typed number if we're allowed to.
        if (message.channel.permissionsFor?.(message.guild.members.me)?.has(PermissionFlagsBits.ManageMessages)) {
            await message.delete().catch(() => null);
        }

        if (this.stage === 'sources') {
            const source = this.sources[n - 1];
            if (source.available()) await this.search(source.id);
        } else {
            await this.showPreview(n - 1);
        }
    }

    async onComponent(i, customId) {
        const [action, arg] = customId.split(':');

        switch (action) {
            case 'src':
                await i.deferUpdate();
                return this.search(arg);
            case 'sources':
                await i.deferUpdate();
                this.stage = 'sources';
                return this.render(views.sourcePicker(this.ctx()));
            case 'pick':
                await i.deferUpdate();
                return this.showPreview(Number(i.values[0]));
            case 'back':
                await i.deferUpdate();
                this.stage = 'results';
                return this.render(views.resultsView(this.ctx({ source: this.source, results: this.results })));
            case 'preview':
                await i.deferUpdate();
                return this.renderPreview();
            case 'playnow':
            case 'queue':
                return this.enqueue(i, action === 'playnow');
            case 'save':
                await i.deferUpdate();
                this.stage = 'playlist';
                return this.render(views.playlistPicker(this.ctx({ result: this.selected, playlists: store.list(this.user.id) })));
            case 'plpick':
                return this.onPlaylistPick(i);
            case 'close':
                await i.deferUpdate();
                return this.close();
            default:
                return i.deferUpdate();
        }
    }

    // ── steps ──────────────────────────────────────────────────────────
    async search(sourceId) {
        const source = sourceById(sourceId);
        if (!source?.available()) return;

        this.source = sourceId;
        this.stage = 'searching';
        await this.render(views.searching(this.ctx({ source: sourceId })));

        let results;
        try {
            results = await searchSource(this.player, sourceId, this.query, this.user);
        } catch (error) {
            logger.error(`/search on ${sourceId} failed for "${this.query}"`, error);
            this.stage = 'sources';
            return this.render(views.emptyView(this.ctx({ source: sourceId, failed: true })));
        }

        this.results = results;
        if (!results.length) {
            this.stage = 'sources';
            return this.render(views.emptyView(this.ctx({ source: sourceId })));
        }
        this.stage = 'results';
        return this.render(views.resultsView(this.ctx({ source: sourceId, results })));
    }

    async showPreview(index) {
        this.selected = this.results[index];
        if (!this.selected) return;
        this.status = null;
        return this.renderPreview();
    }

    renderPreview() {
        this.stage = 'preview';
        return this.render(views.previewView(this.ctx({ result: this.selected, status: this.status })));
    }

    /** Resolves the selected result to a playable track (Spotify results are looked up now). */
    async loadTrack() {
        const track = await resolveTrack(this.player, this.selected, this.user).catch((error) => {
            logger.warn(`Could not resolve "${this.selected.title}": ${error.message}`);
            return null;
        });
        if (track) {
            track.requestedBy = this.user;
            this.selected.track = track; // cache for later actions
        }
        return track;
    }

    async enqueue(i, playNow) {
        const channel = await requireVoice(i);
        if (!channel) return;
        if (!(await requireVoicePermissions(i, channel))) return;
        await i.deferUpdate();

        const track = await this.loadTrack();
        if (!track) {
            this.status = { key: 'loadFailed' };
            return this.renderPreview();
        }

        const queue = this.player.nodes.get(i.guildId);
        try {
            if (playNow && queue?.connection && queue.currentTrack) {
                // Replace the current song immediately; it moves to history (so ⏮️ Previous can return to it).
                await queue.node.play(track, { queue: false });
                this.status = { key: 'playingNow' };
            } else {
                const res = await this.player.play(channel, track, { nodeOptions: nodeOptions(i) });
                const startedNow = res.queue.currentTrack?.id === track.id;
                this.status = startedNow ? { key: 'startedQueue' } : { key: 'queued', vars: { position: res.queue.tracks.size } };
            }
        } catch (error) {
            logger.error(`Search playback failed for "${track.title}"`, error);
            return fail(i, 'playFailed');
        }
        return this.renderPreview();
    }

    async onPlaylistPick(i) {
        const value = i.values[0];

        if (value === views.NEW_PLAYLIST) {
            // A modal must be the direct response to the click, so no deferUpdate here.
            await i.showModal(views.newPlaylistModal(this.ctx()));
            const submit = await i
                .awaitModalSubmit({ filter: (s) => s.customId === `srch:${this.sid}:plmodal`, time: MODAL_MS })
                .catch(() => null);
            if (!submit) return; // closed the popup

            try {
                store.create(this.user.id, submit.fields.getTextInputValue('name'));
            } catch (error) {
                if (error instanceof store.PlaylistError) return fail(submit, error.code, error.vars);
                throw error;
            }
            await submit.deferUpdate();
            return this.saveTo(submit, submit.fields.getTextInputValue('name'));
        }

        await i.deferUpdate();
        return this.saveTo(i, value.slice('pl:'.length));
    }

    async saveTo(i, playlistName) {
        const track = await this.loadTrack();
        if (!track) {
            this.status = { key: 'loadFailed' };
            return this.renderPreview();
        }
        try {
            const { playlist } = store.addTracks(this.user.id, playlistName, [store.serializeTrack(track)]);
            this.status = { key: 'saved', vars: { name: playlist.name, total: playlist.tracks.length } };
        } catch (error) {
            if (error instanceof store.PlaylistError) return fail(i, error.code, error.vars);
            throw error;
        }
        return this.renderPreview();
    }

    async close() {
        if (this.closed) return;
        this.closed = true;
        if (activeSessions.get(this.user.id) === this) activeSessions.delete(this.user.id);
        this.components?.stop();
        this.messages?.stop();
        await this.render(views.closedView(this.ctx()));
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search YouTube, Spotify or SoundCloud, preview results and pick what to play.')
        .addStringOption((option) =>
            option.setName('query').setDescription('Song, artist or album to look for').setRequired(true).setMaxLength(200),
        )
        .addStringOption((option) =>
            option
                .setName('source')
                .setDescription('Where to search (leave empty to choose from a list)')
                .addChoices(...SOURCES.map((s) => ({ name: s.label, value: s.id }))),
        ),

    SearchSession,

    async execute(interaction) {
        const session = new SearchSession(interaction, interaction.options.getString('query', true).trim());
        const sourceId = interaction.options.getString('source');
        // A preset source that isn't configured falls back to the picker.
        await session.start(sourceById(sourceId)?.available() ? sourceId : null);
    },
};
