const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const { baseEmbed, terminal, clip, COLORS, ICONS } = require('../utils/theme');
const { sourceById } = require('../player/sources');
const { LIMITS } = require('../storage/playlists');

const NEW_PLAYLIST = '__new__';
const SOURCE_TAGS = { youtube: 'YT', spotify: 'SP', soundcloud: 'SC' };

const id = (sid, action, arg) => ['srch', sid, action, arg].filter((p) => p !== undefined).join(':');
const btn = (sid, action, { label, emoji, style = ButtonStyle.Secondary, disabled = false, arg }) => {
    const b = new ButtonBuilder().setCustomId(id(sid, action, arg)).setLabel(label).setStyle(style).setDisabled(disabled);
    if (emoji) b.setEmoji(emoji);
    return b;
};
const row = (...components) => new ActionRowBuilder().addComponents(components);
const srcName = (sourceId) => sourceById(sourceId)?.label ?? sourceId;
const srcEmoji = (sourceId) => sourceById(sourceId)?.emoji ?? '🎵';

/** Short status line shown above the song preview after an action. */
const STATUS = {
    normal: {
        playingNow: () => '▶️ **Playing now!**',
        queued: (v) => `✅ **Added to the queue** (position #${v.position}).`,
        startedQueue: () => '▶️ **Started playing!**',
        saved: (v) => `📁 **Saved to ${v.name}** (${v.total} song${v.total === 1 ? '' : 's'}).`,
        loadFailed: () => '⚠️ **Couldn’t load this song.** Try another result.',
    },
    tech: {
        playingNow: () => '`[ OVERRIDE ]` packet streaming now',
        queued: (v) => `\`[ INJECTED ]\` buffer position #${v.position}`,
        startedQueue: () => '`[ STREAM_OPEN ]` uplink established',
        saved: (v) => `\`[ ARCHIVE_WRITE ]\` vault/${v.name} :: ${v.total} packets`,
        loadFailed: () => '`[ DECRYPT_FAIL ]` packet unreadable — pick another',
    },
};

function statusLine(mode, status) {
    return status ? `${STATUS[mode][status.key](status.vars ?? {})}\n\n` : '';
}

// ── Step 1: choose where to search ───────────────────────────────────────
function sourcePicker({ mode, sid, query, sources, typed }) {
    const lines = sources.map((s, i) =>
        mode === 'tech'
            ? `[${i + 1}] ${s.label.toUpperCase().padEnd(12)} ${s.available() ? 'ONLINE' : 'OFFLINE (no api key)'}`
            : `**${i + 1}.** ${s.emoji} ${s.label}${s.available() ? '' : ' — *not set up*'}`,
    );

    const embed =
        mode === 'tech'
            ? baseEmbed('tech', {
                  color: COLORS.CYAN,
                  title: `${ICONS.antenna} [ SELECT_FREQUENCY ]`,
                  description: terminal(
                      `$ sniff --target "${clip(query, 60)}"\n> choose source node:\n${lines.join('\n')}\n> ${typed ? 'click or type 1-' + sources.length : 'click a node'}`,
                  ),
              })
            : baseEmbed('normal', {
                  color: COLORS.CYAN,
                  title: '🔎 Where should I search?',
                  description: `Searching for **${clip(query, 80)}**\n\n${lines.join('\n')}\n\nClick a button${typed ? ` or type a number (1–${sources.length}) in the chat` : ''}.`,
              });

    const buttons = sources.map((s, i) =>
        btn(sid, 'src', { label: `${i + 1} · ${s.label}`, emoji: s.emoji, arg: s.id, disabled: !s.available(), style: ButtonStyle.Primary }),
    );
    const cancel = btn(sid, 'close', { label: mode === 'tech' ? 'ABORT' : 'Cancel', emoji: '✖️' });

    // Max 5 buttons per row.
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) rows.push(row(...buttons.slice(i, i + 5)));
    rows.push(row(cancel));
    return { embeds: [embed], components: rows };
}

function searching({ mode, query, source }) {
    const embed =
        mode === 'tech'
            ? baseEmbed('tech', {
                  color: COLORS.CYAN,
                  title: `${ICONS.antenna} [ INITIATING_PACKET_SNIFF ]`,
                  description: terminal(`$ sniff --node ${source} --target "${clip(query, 60)}"\n> scanning frequencies...`),
              })
            : baseEmbed('normal', {
                  color: COLORS.CYAN,
                  title: '🔎 Searching…',
                  description: `Looking for **${clip(query, 80)}** on ${srcEmoji(source)} **${srcName(source)}**…`,
              });
    return { embeds: [embed], components: [] };
}

// ── Step 2: results list ─────────────────────────────────────────────────
function resultsView({ mode, sid, query, source, results, typed }) {
    const showSource = source === 'all';
    const lines = results.map((r, i) =>
        mode === 'tech'
            ? `[${String(i + 1).padStart(2, '0')}] ${clip(r.title, 36).padEnd(36)} ${r.duration.padStart(8)}${showSource ? ` ${SOURCE_TAGS[r.source] ?? '??'}` : ''}`
            : `**${i + 1}.** ${showSource ? `${srcEmoji(r.source)} ` : ''}${clip(r.title, 60)} — ${clip(r.author, 30)} · \`${r.duration}\``,
    );

    const embed =
        mode === 'tech'
            ? baseEmbed('tech', {
                  color: COLORS.GREEN,
                  title: `${ICONS.disk} [ SNIFF_RESULTS :: ${srcName(source).toUpperCase()} ]`,
                  description: terminal(`$ results --query "${clip(query, 40)}"\n${lines.join('\n')}\n> ${typed ? 'select or type index' : 'select index'}`),
              })
            : baseEmbed('normal', {
                  color: COLORS.GREEN,
                  title: `${srcEmoji(source)} Results from ${srcName(source)}`,
                  description: `${lines.join('\n')}\n\nPick a song from the menu below${typed ? ' or type its number in the chat' : ''}.`,
              });
    if (results[0]?.thumbnail) embed.setThumbnail(results[0].thumbnail);

    const menu = new StringSelectMenuBuilder()
        .setCustomId(id(sid, 'pick'))
        .setPlaceholder(mode === 'tech' ? '[ SELECT_PACKET ]' : '🎵 Choose a song…')
        .addOptions(
            results.map((r, i) => ({
                label: clip(`${i + 1}. ${r.title}`, 100),
                description: clip(`${r.author} · ${r.duration} · ${srcName(r.source)}`, 100),
                value: String(i),
                emoji: srcEmoji(r.source),
            })),
        );

    return {
        embeds: [embed],
        components: [row(menu), row(...navButtons(mode, sid))],
    };
}

function navButtons(mode, sid) {
    return [
        btn(sid, 'sources', { label: mode === 'tech' ? 'SWITCH_NODE' : 'Change source', emoji: '🔄' }),
        btn(sid, 'close', { label: mode === 'tech' ? 'ABORT' : 'Close', emoji: '✖️' }),
    ];
}

function emptyView({ mode, sid, query, source, failed }) {
    const embed =
        mode === 'tech'
            ? baseEmbed('tech', {
                  color: COLORS.CYAN,
                  title: `${ICONS.lock} ${failed ? '[ SNIFF_FAILED ]' : '[ 404_SIGNAL_NOT_FOUND ]'}`,
                  description: terminal(
                      `- ERR :: ${failed ? `node ${source} unreachable` : `no packets matched "${clip(query, 40)}" on ${source}`}`,
                      'diff',
                  ),
              })
            : baseEmbed('normal', {
                  color: COLORS.CYAN,
                  title: failed ? '⚠️ Search failed' : '🔎 No results',
                  description: failed
                      ? `I couldn’t search **${srcName(source)}** right now. Try another source.`
                      : `Nothing found for **${clip(query, 80)}** on **${srcName(source)}**. Try another source or different words.`,
              });
    return { embeds: [embed], components: [row(...navButtons(mode, sid))] };
}

// ── Step 3: song preview + actions ───────────────────────────────────────
function previewView({ mode, sid, result, status }) {
    const embed =
        mode === 'tech'
            ? baseEmbed('tech', {
                  color: COLORS.GREEN,
                  title: `${ICONS.pager} [ PACKET_INSPECT ]`,
                  description:
                      statusLine(mode, status) +
                      terminal(
                          [
                              `TARGET   : ${clip(result.title, 50)}`,
                              `ORIGIN   : ${clip(result.author, 50)}`,
                              `RUNTIME  : ${result.duration}`,
                              `PROTOCOL : ${srcName(result.source).toUpperCase()}`,
                          ].join('\n'),
                          'yml',
                      ),
              })
            : baseEmbed('normal', {
                  color: COLORS.GREEN,
                  title: `🎵 ${clip(result.title, 240)}`,
                  description: `${statusLine(mode, status)}by **${clip(result.author, 80)}**\n⏱️ \`${result.duration}\` · ${srcEmoji(result.source)} ${srcName(result.source)}`,
              });
    embed.setURL(result.url);
    if (result.thumbnail) embed.setImage(result.thumbnail);

    const L =
        mode === 'tech'
            ? { play: 'OVERRIDE_NOW', queue: 'INJECT', save: 'ARCHIVE', open: 'SOURCE', back: 'RESULTS', close: 'ABORT' }
            : { play: 'Play now', queue: 'Add to queue', save: 'Save to playlist', open: 'Open', back: 'Back to results', close: 'Close' };

    return {
        embeds: [embed],
        components: [
            row(
                btn(sid, 'playnow', { label: L.play, emoji: '▶️', style: ButtonStyle.Primary }),
                btn(sid, 'queue', { label: L.queue, emoji: '➕', style: ButtonStyle.Success }),
                btn(sid, 'save', { label: L.save, emoji: '📁' }),
                new ButtonBuilder().setLabel(L.open).setEmoji('🔗').setStyle(ButtonStyle.Link).setURL(result.url),
            ),
            row(
                btn(sid, 'back', { label: L.back, emoji: '🔙' }),
                btn(sid, 'close', { label: L.close, emoji: '✖️' }),
            ),
        ],
    };
}

// ── Step 4: choose a playlist ────────────────────────────────────────────
function playlistPicker({ mode, sid, result, playlists }) {
    const canCreate = playlists.length < LIMITS.playlistsPerUser;
    const options = playlists.slice(0, canCreate ? 24 : 25).map((p) => ({
        label: clip(p.name, 100),
        description: `${p.tracks.length} ${mode === 'tech' ? 'packets' : 'songs'}`,
        value: `pl:${p.name}`.slice(0, 100),
        emoji: '📁',
    }));
    if (canCreate) {
        options.push({
            label: mode === 'tech' ? 'ALLOCATE NEW ARCHIVE…' : 'Create a new playlist…',
            value: NEW_PLAYLIST,
            emoji: '➕',
        });
    }

    const embed =
        mode === 'tech'
            ? baseEmbed('tech', {
                  color: COLORS.CYAN,
                  title: `${ICONS.lock} [ SELECT_ARCHIVE ]`,
                  description: terminal(`> target :: ${clip(result.title, 50)}\n> choose destination archive`),
              })
            : baseEmbed('normal', {
                  color: COLORS.CYAN,
                  title: '📁 Save to a playlist',
                  description: `Where should I save **${clip(result.title, 80)}**?${playlists.length ? '' : '\nYou don’t have any playlists yet — create one below.'}`,
              });

    const menu = new StringSelectMenuBuilder()
        .setCustomId(id(sid, 'plpick'))
        .setPlaceholder(mode === 'tech' ? '[ SELECT_ARCHIVE ]' : '📁 Choose a playlist…')
        .addOptions(options);

    return {
        embeds: [embed],
        components: [row(menu), row(btn(sid, 'preview', { label: mode === 'tech' ? 'BACK' : 'Back to song', emoji: '🔙' }))],
    };
}

function newPlaylistModal({ mode, sid }) {
    return new ModalBuilder()
        .setCustomId(id(sid, 'plmodal'))
        .setTitle(mode === 'tech' ? 'ALLOCATE ARCHIVE' : 'New playlist')
        .addComponents(
            row(
                new TextInputBuilder()
                    .setCustomId('name')
                    .setLabel(mode === 'tech' ? 'Archive id' : 'Playlist name')
                    .setStyle(TextInputStyle.Short)
                    .setMinLength(1)
                    .setMaxLength(LIMITS.nameLength)
                    .setRequired(true),
            ),
        );
}

function closedView({ mode }) {
    const embed =
        mode === 'tech'
            ? baseEmbed('tech', { color: COLORS.CYAN, title: `${ICONS.plug} [ SESSION_CLOSED ]`, description: terminal('> search terminal detached :: /search to reopen') })
            : baseEmbed('normal', { color: COLORS.CYAN, title: '🔎 Search closed', description: 'Use `/search` to search again.' });
    return { embeds: [embed], components: [] };
}

module.exports = {
    NEW_PLAYLIST,
    sourcePicker,
    searching,
    resultsView,
    emptyView,
    previewView,
    playlistPicker,
    newPlaylistModal,
    closedView,
};
