const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { Track } = require('discord-player');
const store = require('../../storage/playlists');
const { fail, requireVoice, requireVoicePermissions } = require('../../utils/guards');
const { render, modeOf } = require('../../ui/text');
const { playlistPage, playlistOverview } = require('../../ui/lists');
const { paginate } = require('../../ui/paginator');
const { searchTracks, nodeOptions } = require('../../player/search');
const logger = require('../../utils/logger');

const nameOption = (description, autocomplete = true) => (option) =>
    option
        .setName('name')
        .setDescription(description)
        .setRequired(true)
        .setMaxLength(store.LIMITS.nameLength)
        .setAutocomplete(autocomplete);

const ephemeral = { flags: MessageFlags.Ephemeral };

function shuffle(items) {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
}

const handlers = {
    async create(interaction, userId, mode) {
        const playlist = store.create(userId, interaction.options.getString('name', true));
        return interaction.reply({ embeds: [render(mode, 'plCreated', { name: playlist.name })], ...ephemeral });
    },

    async delete(interaction, userId, mode) {
        const playlist = store.remove(userId, interaction.options.getString('name', true));
        return interaction.reply({
            embeds: [render(mode, 'plDeleted', { name: playlist.name, count: playlist.tracks.length })],
            ...ephemeral,
        });
    },

    async rename(interaction, userId, mode) {
        const { oldName, playlist } = store.rename(
            userId,
            interaction.options.getString('name', true),
            interaction.options.getString('new_name', true),
        );
        return interaction.reply({ embeds: [render(mode, 'plRenamed', { oldName, name: playlist.name })], ...ephemeral });
    },

    async add(interaction, userId, mode) {
        const name = store.get(userId, interaction.options.getString('name', true)).name;
        const query = interaction.options.getString('song')?.trim();

        await interaction.deferReply(ephemeral);

        let tracks;
        if (query) {
            let result;
            try {
                result = await searchTracks(interaction.client.player, query, interaction.user);
            } catch (error) {
                logger.error(`Playlist search failed for "${query}"`, error);
                return fail(interaction, 'searchFailed');
            }
            if (!result?.hasTracks()) return fail(interaction, 'notFound', { query });
            // A playlist/album link adds every song; a search adds the best match.
            tracks = result.playlist ? result.tracks : [result.tracks[0]];
        } else {
            const current = interaction.client.player.nodes.get(interaction.guildId)?.currentTrack;
            if (!current) return fail(interaction, 'nothingToSave');
            tracks = [current];
        }

        const { playlist, added, skipped } = store.addTracks(userId, name, tracks.map(store.serializeTrack));
        return interaction.editReply({
            embeds: [
                render(mode, 'plAdded', {
                    name: playlist.name,
                    title: tracks[0].title,
                    added,
                    skipped,
                    total: playlist.tracks.length,
                    max: store.LIMITS.tracksPerPlaylist,
                }),
            ],
        });
    },

    async savequeue(interaction, userId, mode) {
        const rawName = interaction.options.getString('name', true);
        const queue = interaction.client.player.nodes.get(interaction.guildId);
        const tracks = [queue?.currentTrack, ...(queue?.tracks.toArray() ?? [])].filter(Boolean);
        if (!tracks.length) return fail(interaction, 'nothingToSave');

        // Saving into a name that doesn't exist yet creates the playlist.
        if (!store.exists(userId, rawName)) store.create(userId, rawName);

        const { playlist, added, skipped } = store.addTracks(userId, rawName, tracks.map(store.serializeTrack));
        return interaction.reply({
            embeds: [
                render(mode, 'plAdded', {
                    name: playlist.name,
                    title: tracks[0].title,
                    added,
                    skipped,
                    total: playlist.tracks.length,
                    max: store.LIMITS.tracksPerPlaylist,
                }),
            ],
            ...ephemeral,
        });
    },

    async remove(interaction, userId, mode) {
        const { playlist, removed } = store.removeTrack(
            userId,
            interaction.options.getString('name', true),
            interaction.options.getInteger('position', true),
        );
        return interaction.reply({ embeds: [render(mode, 'plRemoved', { name: playlist.name, title: removed.title })], ...ephemeral });
    },

    async view(interaction, userId, mode) {
        const name = store.get(userId, interaction.options.getString('name', true)).name;
        return paginate(interaction, {
            ephemeral: true,
            startPage: (interaction.options.getInteger('page') ?? 1) - 1,
            // Re-read on each click so edits made meanwhile show up.
            renderPage: (page) => playlistPage(store.get(userId, name), page, mode),
        });
    },

    async list(interaction, userId, mode) {
        return interaction.reply({
            embeds: [playlistOverview(store.list(userId), mode, store.LIMITS.playlistsPerUser)],
            ...ephemeral,
        });
    },

    async play(interaction, userId, mode) {
        const playlist = store.get(userId, interaction.options.getString('name', true));
        if (!playlist.tracks.length) return fail(interaction, 'plEmpty', { name: playlist.name });

        const channel = await requireVoice(interaction);
        if (!channel) return;
        if (!(await requireVoicePermissions(interaction, channel))) return;

        await interaction.deferReply();

        const player = interaction.client.player;
        const tracks = [];
        for (const data of playlist.tracks) {
            try {
                const track = Track.fromSerialized(player, data);
                track.requestedBy = interaction.user;
                tracks.push(track);
            } catch (error) {
                logger.warn(`Skipping unreadable track in playlist "${playlist.name}": ${error.message}`);
            }
        }
        if (!tracks.length) return fail(interaction, 'plEmpty', { name: playlist.name });

        const shuffled = interaction.options.getBoolean('shuffle') ?? false;
        if (shuffled) shuffle(tracks);

        try {
            await player.play(channel, tracks, { nodeOptions: nodeOptions(interaction) });
        } catch (error) {
            logger.error(`Playlist playback failed for "${playlist.name}"`, error);
            return fail(interaction, 'playFailed');
        }

        return interaction.editReply({
            embeds: [render(mode, 'plQueued', { name: playlist.name, count: tracks.length, shuffled })],
        });
    },
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('Create and play your own playlists.')
        .addSubcommand((sub) =>
            sub
                .setName('create')
                .setDescription('Create a new empty playlist.')
                .addStringOption(nameOption('Name for the new playlist', false)),
        )
        .addSubcommand((sub) =>
            sub
                .setName('add')
                .setDescription('Add a song (or a whole playlist link) to one of your playlists.')
                .addStringOption(nameOption('Your playlist'))
                .addStringOption((option) =>
                    option.setName('song').setDescription('Song name or link — leave empty to add the song playing now').setMaxLength(500),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('savequeue')
                .setDescription('Save the current song and the whole queue into a playlist (creates it if needed).')
                .addStringOption(nameOption('Playlist to save into (new or existing)')),
        )
        .addSubcommand((sub) =>
            sub
                .setName('play')
                .setDescription('Play one of your playlists.')
                .addStringOption(nameOption('Your playlist'))
                .addBooleanOption((option) => option.setName('shuffle').setDescription('Play the songs in random order')),
        )
        .addSubcommand((sub) =>
            sub
                .setName('view')
                .setDescription('See the songs in one of your playlists.')
                .addStringOption(nameOption('Your playlist'))
                .addIntegerOption((option) => option.setName('page').setDescription('Page to open').setMinValue(1)),
        )
        .addSubcommand((sub) => sub.setName('list').setDescription('See all of your playlists.'))
        .addSubcommand((sub) =>
            sub
                .setName('remove')
                .setDescription('Remove a song from one of your playlists.')
                .addStringOption(nameOption('Your playlist'))
                .addIntegerOption((option) =>
                    option.setName('position').setDescription('Song number (see /playlist view)').setRequired(true).setMinValue(1),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('rename')
                .setDescription('Rename one of your playlists.')
                .addStringOption(nameOption('Your playlist'))
                .addStringOption((option) =>
                    option.setName('new_name').setDescription('New name').setRequired(true).setMaxLength(store.LIMITS.nameLength),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('delete')
                .setDescription('Delete one of your playlists.')
                .addStringOption(nameOption('Playlist to delete')),
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        try {
            return await handlers[sub](interaction, interaction.user.id, modeOf(interaction.user));
        } catch (error) {
            if (error instanceof store.PlaylistError) return fail(interaction, error.code, error.vars);
            throw error;
        }
    },

    /** Suggests the user's own playlist names while they type. */
    async autocomplete(interaction) {
        const typed = interaction.options.getFocused().toLowerCase();
        const choices = store
            .list(interaction.user.id)
            .filter((p) => p.name.toLowerCase().includes(typed))
            .slice(0, 25)
            .map((p) => ({ name: `${p.name} (${p.tracks.length} songs)`.slice(0, 100), value: p.name }));
        return interaction.respond(choices);
    },
};
