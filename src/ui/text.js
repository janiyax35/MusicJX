const { QueueRepeatMode } = require('discord-player');
const { baseEmbed, terminal, clip, COLORS, ICONS } = require('../utils/theme');
const { getMode } = require('../storage/settings');

/**
 * Every user-facing message exists in two styles:
 *   normal — plain, friendly words (default)
 *   tech   — the MusicJX netrunner / hacker-terminal style
 *
 * Simple messages live in MESSAGES and are rendered by render().
 * Richer views (now playing panel, queue, playlists) build their own embeds
 * but still branch on the same mode.
 */

const LOOP_LABELS = {
    normal: {
        [QueueRepeatMode.OFF]: 'Off',
        [QueueRepeatMode.TRACK]: 'This song',
        [QueueRepeatMode.QUEUE]: 'Whole queue',
        [QueueRepeatMode.AUTOPLAY]: 'Autoplay',
    },
    tech: {
        [QueueRepeatMode.OFF]: 'OFF',
        [QueueRepeatMode.TRACK]: 'TRACK',
        [QueueRepeatMode.QUEUE]: 'QUEUE',
        [QueueRepeatMode.AUTOPLAY]: 'AUTOPLAY',
    },
};

const loopLabel = (mode, repeatMode) => LOOP_LABELS[mode][repeatMode] ?? LOOP_LABELS[mode][QueueRepeatMode.OFF];

// kind: 'ok' (green) | 'info' (cyan) | 'error' (cyan, error styling)
const MESSAGES = {
    // ── Errors ────────────────────────────────────────────────────────────
    notInVoice: {
        kind: 'error',
        normal: { title: '🎧 Join a voice channel first', text: () => 'You need to be in a voice channel to use this.' },
        tech: { title: '[ ACCESS_DENIED ]', err: () => 'No voice uplink detected. Join a voice channel first.' },
    },
    wrongChannel: {
        kind: 'error',
        normal: {
            title: '🎧 I’m in another channel',
            text: (v) => `I’m already playing music in **${v.channel}**. Join that channel to control me.`,
        },
        tech: { title: '[ CHANNEL_LOCKED ]', err: (v) => `Daemon is bound to #${v.channel}. Join that channel to issue commands.` },
    },
    missingPerms: {
        kind: 'error',
        normal: {
            title: '🚫 I can’t join that channel',
            text: (v) => `I’m missing these permissions in your voice channel: **${v.perms}**. Ask a server admin to allow them.`,
        },
        tech: { title: '[ PRIVILEGE_ESCALATION_REQUIRED ]', err: (v) => `Missing permissions: ${v.perms}` },
    },
    channelFull: {
        kind: 'error',
        normal: { title: '🚫 Channel is full', text: () => 'Your voice channel is full, so I can’t join it.' },
        tech: { title: '[ NODE_SATURATED ]', err: () => 'Voice channel is at max capacity.' },
    },
    noQueue: {
        kind: 'error',
        normal: { title: '🔇 Nothing is playing', text: () => 'Nothing is playing right now. Use `/play` to start some music.' },
        tech: { title: '[ NULL_POINTER ]', err: () => 'No active audio stream in this sector.' },
    },
    notFound: {
        kind: 'error',
        normal: { title: '🔍 No results', text: (v) => `I couldn’t find anything for **${clip(v.query, 60)}**. Try different words or a link.` },
        tech: { title: '[ 404_SIGNAL_NOT_FOUND ]', err: (v) => `No audio packets matched "${clip(v.query, 60)}".` },
    },
    searchFailed: {
        kind: 'error',
        normal: { title: '⚠️ Search failed', text: () => 'Something went wrong while searching. Please try again or use a link.' },
        tech: { title: '[ SNIFF_FAILED ]', err: () => 'Search subsystem returned an error. Try another query or URL.' },
    },
    playFailed: {
        kind: 'error',
        normal: { title: '⚠️ Couldn’t start playing', text: () => 'I couldn’t connect to your voice channel. Check my permissions and try again.' },
        tech: { title: '[ UPLINK_FAILURE ]', err: () => 'Could not open the voice stream. Verify permissions and retry.' },
    },
    alreadyPaused: {
        kind: 'error',
        normal: { title: '⏸️ Already paused', text: () => 'The music is already paused. Use `/resume` to continue.' },
        tech: { title: '[ ALREADY_INTERCEPTED ]', err: () => 'Stream is already frozen. Use /resume.' },
    },
    notPaused: {
        kind: 'error',
        normal: { title: '▶️ Already playing', text: () => 'The music isn’t paused.' },
        tech: { title: '[ STREAM_ALREADY_LIVE ]', err: () => 'Stream is not intercepted.' },
    },
    noPrevious: {
        kind: 'error',
        normal: { title: '⏮️ No previous song', text: () => 'There’s no earlier song to go back to.' },
        tech: { title: '[ HISTORY_EMPTY ]', err: () => 'No previous node in the stream history.' },
    },
    invalidTime: {
        kind: 'error',
        normal: { title: '⏱️ Invalid time', text: (v) => `I didn’t understand **${clip(v.input, 20)}**. Use a time like \`90\`, \`1:30\` or \`1:02:03\`.` },
        tech: { title: '[ MALFORMED_OFFSET ]', err: (v) => `Cannot parse "${clip(v.input, 20)}". Expected ss | mm:ss | hh:mm:ss.` },
    },
    timeOutOfRange: {
        kind: 'error',
        normal: { title: '⏱️ Time out of range', text: (v) => `This song is only **${v.total}** long.` },
        tech: { title: '[ OFFSET_OVERFLOW ]', err: (v) => `Offset exceeds track runtime (${v.total}).` },
    },
    cannotSeekLive: {
        kind: 'error',
        normal: { title: '⏱️ Can’t skip around', text: () => 'This is a live stream, so you can’t jump to a different time.' },
        tech: { title: '[ SEEK_UNSUPPORTED ]', err: () => 'Live stream detected. Offset control unavailable.' },
    },
    seekFailed: {
        kind: 'error',
        normal: { title: '⚠️ Couldn’t jump', text: () => 'I couldn’t jump to that time. Please try again.' },
        tech: { title: '[ SEEK_FAULT ]', err: () => 'Offset relocation failed.' },
    },
    stalePanel: {
        kind: 'error',
        normal: { title: '🕹️ Old controls', text: () => 'These controls are out of date. Use `/nowplaying` to get new ones.' },
        tech: { title: '[ SESSION_EXPIRED ]', err: () => 'Control panel detached. Run /nowplaying for a fresh terminal.' },
    },
    notYourView: {
        kind: 'error',
        normal: { title: '🔒 Not your list', text: () => 'Only the person who opened this list can flip its pages. Run the command yourself.' },
        tech: { title: '[ ACCESS_DENIED ]', err: () => 'This terminal session belongs to another operator.' },
    },
    guildOnly: {
        kind: 'error',
        normal: { title: '🏠 Servers only', text: () => 'I only work inside servers.' },
        tech: { title: '[ SECTOR_INVALID ]', err: () => 'MusicJX only operates inside servers.' },
    },
    unknownCommand: {
        kind: 'error',
        normal: { title: '❓ Unknown command', text: (v) => `\`/${v.name}\` isn’t available right now.` },
        tech: { title: '[ UNKNOWN_OPCODE ]', err: (v) => `/${v.name} is not a registered module.` },
    },
    crash: {
        kind: 'error',
        normal: { title: '⚠️ Something went wrong', text: () => 'Something went wrong on my side. Please try again.' },
        tech: { title: '[ KERNEL_PANIC ]', err: () => 'Unexpected fault while executing module. Logged to console.' },
    },
    nothingToSave: {
        kind: 'error',
        normal: { title: '🔇 Nothing to add', text: () => 'Nothing is playing. Give me a song name or link, or start music first.' },
        tech: { title: '[ NULL_POINTER ]', err: () => 'No active track to capture. Supply a query.' },
    },

    // Playlist errors (codes come from storage/playlists.js)
    plNameInvalid: {
        kind: 'error',
        normal: { title: '📁 Invalid name', text: (v) => `Playlist names must be 1–${v.max} characters.` },
        tech: { title: '[ INVALID_IDENTIFIER ]', err: (v) => `Playlist id must be 1-${v.max} chars.` },
    },
    plNotFound: {
        kind: 'error',
        normal: { title: '📁 Playlist not found', text: (v) => `You don’t have a playlist called **${v.name}**. See yours with \`/playlist list\`.` },
        tech: { title: '[ 404_ARCHIVE_NOT_FOUND ]', err: (v) => `No archive named "${v.name}" in your vault.` },
    },
    plExists: {
        kind: 'error',
        normal: { title: '📁 Name already used', text: (v) => `You already have a playlist called **${v.name}**.` },
        tech: { title: '[ ARCHIVE_COLLISION ]', err: (v) => `Archive "${v.name}" already exists.` },
    },
    plLimit: {
        kind: 'error',
        normal: { title: '📁 Too many playlists', text: (v) => `You can have up to ${v.max} playlists. Delete one to make room.` },
        tech: { title: '[ VAULT_FULL ]', err: (v) => `Archive limit reached (${v.max}). Purge one first.` },
    },
    plFull: {
        kind: 'error',
        normal: { title: '📁 Playlist is full', text: (v) => `**${v.name}** already has the maximum of ${v.max} songs.` },
        tech: { title: '[ ARCHIVE_FULL ]', err: (v) => `"${v.name}" is at capacity (${v.max} packets).` },
    },
    plEmpty: {
        kind: 'error',
        normal: { title: '📁 Playlist is empty', text: (v) => `**${v.name}** has no songs yet. Add some with \`/playlist add\`.` },
        tech: { title: '[ ARCHIVE_EMPTY ]', err: (v) => `"${v.name}" contains 0 packets.` },
    },
    plBadIndex: {
        kind: 'error',
        normal: { title: '📁 Invalid song number', text: (v) => `Pick a song number from 1 to ${v.max}. See them with \`/playlist view\`.` },
        tech: { title: '[ INDEX_OUT_OF_BOUNDS ]', err: (v) => `Valid range: 1-${v.max}.` },
    },

    // ── Status / success ─────────────────────────────────────────────────
    searching: {
        kind: 'info',
        normal: { title: '🔍 Searching…', text: (v) => `Looking for **${clip(v.query, 80)}**` },
        tech: {
            title: `${ICONS.antenna} [ INITIATING_PACKET_SNIFF ]`,
            lines: (v) => [`$ sniff --target "${clip(v.query, 80)}"`, '> scanning frequencies...'],
        },
    },
    skipped: {
        kind: 'ok',
        normal: {
            title: '⏭️ Skipped',
            text: (v) => `Skipped **${clip(v.title, 80)}**.\n${v.next ? `Up next: **${clip(v.next, 80)}**` : 'That was the last song in the queue.'}`,
        },
        tech: {
            title: `${ICONS.plug} [ BYPASSING_NODE ]`,
            lang: 'diff',
            lines: (v) => [
                `+ node bypassed :: ${clip(v.title, 60)}`,
                v.next ? `+ next target   :: ${clip(v.next, 60)}` : '- buffer empty  :: no further packets',
            ],
        },
    },
    previous: {
        kind: 'ok',
        normal: { title: '⏮️ Going back', text: (v) => `Playing the previous song: **${clip(v.title, 80)}**` },
        tech: { title: `${ICONS.plug} [ REWINDING_NODE ]`, lang: 'diff', lines: (v) => [`+ restoring node :: ${clip(v.title, 60)}`] },
    },
    paused: {
        kind: 'ok',
        normal: { title: '⏸️ Paused', text: (v) => `Paused at **${v.time}**. Use \`/resume\` to continue.` },
        tech: { title: `${ICONS.lock} [ STREAM_INTERCEPTED ]`, lang: 'diff', lines: (v) => [`+ Stream frozen at ${v.time} :: /resume to restore`] },
    },
    resumed: {
        kind: 'ok',
        normal: { title: '▶️ Resumed', text: () => 'The music is playing again.' },
        tech: { title: `${ICONS.antenna} [ STREAM_RESTORED ]`, lang: 'diff', lines: () => ['+ Intercept released :: audio packets flowing'] },
    },
    stopped: {
        kind: 'info',
        normal: {
            title: '⏹️ Stopped',
            text: (v) => `Stopped the music, cleared ${v.count} song${v.count === 1 ? '' : 's'} and left the voice channel.`,
        },
        tech: {
            title: `${ICONS.plug} [ CONNECTION_TERMINATED ]`,
            lines: (v) => ['$ kill -9 musicjx.stream', `> ${v.count} packet(s) purged from buffer`, '> voice uplink closed', `> session terminated by ${v.user}`],
        },
    },
    loopSet: {
        kind: 'ok',
        normal: {
            title: '🔁 Loop updated',
            text: (v) =>
                ({
                    [QueueRepeatMode.OFF]: 'Loop is **off**.',
                    [QueueRepeatMode.TRACK]: '🔂 Now repeating **this song**.',
                    [QueueRepeatMode.QUEUE]: '🔁 Now repeating the **whole queue**.',
                })[v.repeatMode] ?? `Loop: **${loopLabel('normal', v.repeatMode)}**`,
        },
        tech: { title: '🔁 [ LOOP_PROTOCOL ]', lang: 'diff', lines: (v) => [`+ repeat_mode set :: ${loopLabel('tech', v.repeatMode)}`] },
    },
    seeked: {
        kind: 'ok',
        normal: { title: '⏩ Jumped', text: (v) => `Jumped to **${v.time}** / ${v.total}.` },
        tech: { title: '⏩ [ OFFSET_RELOCATED ]', lang: 'diff', lines: (v) => [`+ stream offset :: ${v.time} / ${v.total}`] },
    },
    modeSet: {
        kind: 'ok',
        normal: {
            title: '✅ Style updated',
            text: () => 'I’ll talk to you in **simple, everyday words** from now on.\nWant the hacker style? Use `/mode` and pick **Tech**.',
        },
        tech: {
            title: `${ICONS.pager} [ INTERFACE_RECONFIGURED ]`,
            lines: () => ['$ set --ui netrunner', '> terminal skin loaded', '> revert anytime :: /mode normal'],
        },
    },

    // Player events posted in the text channel
    queueEnded: {
        kind: 'info',
        normal: {
            title: '✅ Queue finished',
            text: (v) => `That was the last song.${v.cooldown ? ` I’ll leave the voice channel in ${v.cooldown} seconds unless you \`/play\` something.` : ''}`,
        },
        tech: {
            title: `${ICONS.disk} [ BUFFER_DRAINED ]`,
            lines: (v) => [
                '> all packets transmitted',
                '> buffer_overflow_queue :: 0 entries',
                ...(v.cooldown ? [`> auto-disconnect in ${v.cooldown}s unless new packets are injected via /play`] : []),
            ],
        },
    },
    channelEmpty: {
        kind: 'info',
        normal: { title: '👋 Left the voice channel', text: () => 'Everyone left, so I stopped the music and left too.' },
        tech: {
            title: `${ICONS.plug} [ CONNECTION_TERMINATED ]`,
            lines: () => ['> no operators detected on voice node', '> idle timeout reached', '> uplink closed :: buffer purged'],
        },
    },
    disconnected: {
        kind: 'info',
        normal: { title: '👋 Disconnected', text: () => 'I was disconnected from the voice channel, so the queue was cleared.' },
        tech: {
            title: `${ICONS.plug} [ CONNECTION_SEVERED ]`,
            lang: 'diff',
            lines: () => ['- external kill signal received', '- voice uplink dropped :: buffer purged'],
        },
    },
    trackError: {
        kind: 'error',
        normal: { title: '⚠️ Couldn’t play a song', text: (v) => `**${clip(v.title, 80)}** couldn’t be played, so I skipped it.` },
        tech: { title: '[ PACKET_CORRUPTED ]', err: (v) => `Stream for "${clip(v.title, 60)}" could not be decrypted. Bypassing node...` },
    },
    queueError: {
        kind: 'error',
        normal: { title: '⚠️ Playback problem', text: () => 'Something went wrong with the music player. Try `/play` again.' },
        tech: { title: '[ SYSTEM_FAULT ]', err: () => 'Audio subsystem encountered an error. Check the daemon console.' },
    },

    // Playlist success messages
    plCreated: {
        kind: 'ok',
        normal: { title: '📁 Playlist created', text: (v) => `Created **${v.name}**. Add songs with \`/playlist add\`.` },
        tech: { title: `${ICONS.disk} [ ARCHIVE_ALLOCATED ]`, lang: 'diff', lines: (v) => [`+ mkdir vault/${v.name}`] },
    },
    plDeleted: {
        kind: 'info',
        normal: { title: '🗑️ Playlist deleted', text: (v) => `Deleted **${v.name}** (${v.count} song${v.count === 1 ? '' : 's'}).` },
        tech: { title: `${ICONS.disk} [ ARCHIVE_PURGED ]`, lang: 'diff', lines: (v) => [`- rm -rf vault/${v.name} :: ${v.count} packet(s) wiped`] },
    },
    plRenamed: {
        kind: 'ok',
        normal: { title: '📁 Playlist renamed', text: (v) => `Renamed **${v.oldName}** to **${v.name}**.` },
        tech: { title: `${ICONS.disk} [ ARCHIVE_RELABELED ]`, lang: 'diff', lines: (v) => [`+ mv vault/${v.oldName} vault/${v.name}`] },
    },
    plAdded: {
        kind: 'ok',
        normal: {
            title: '➕ Added to playlist',
            text: (v) =>
                `${v.added === 1 && v.title ? `Added **${clip(v.title, 80)}**` : `Added **${v.added}** songs`} to **${v.name}**. It now has ${v.total} song${v.total === 1 ? '' : 's'}.` +
                (v.skipped ? `\n${v.skipped} song(s) didn’t fit — playlists hold up to ${v.max}.` : ''),
        },
        tech: {
            title: `${ICONS.disk} [ ARCHIVE_WRITE ]`,
            lang: 'diff',
            lines: (v) => [
                `+ ${v.added} packet(s) written to vault/${v.name}`,
                `+ archive size :: ${v.total}`,
                ...(v.skipped ? [`- ${v.skipped} packet(s) dropped :: capacity ${v.max}`] : []),
            ],
        },
    },
    plRemoved: {
        kind: 'info',
        normal: { title: '➖ Removed from playlist', text: (v) => `Removed **${clip(v.title, 80)}** from **${v.name}**.` },
        tech: { title: `${ICONS.disk} [ ARCHIVE_WRITE ]`, lang: 'diff', lines: (v) => [`- packet removed :: ${clip(v.title, 60)}`] },
    },
    plQueued: {
        kind: 'ok',
        normal: {
            title: '📁 Playing playlist',
            text: (v) => `Added **${v.count}** song${v.count === 1 ? '' : 's'} from **${v.name}** to the queue${v.shuffled ? ' (shuffled)' : ''}.`,
        },
        tech: {
            title: `${ICONS.disk} [ ARCHIVE_MOUNTED ]`,
            lang: 'diff',
            lines: (v) => [`+ vault/${v.name} mounted`, `+ ${v.count} packet(s) injected into buffer${v.shuffled ? ' :: scrambled' : ''}`],
        },
    },
};

/** Builds an embed for a simple message key in the given style. */
function render(mode, key, vars = {}) {
    const entry = MESSAGES[key];
    if (!entry) throw new Error(`Unknown message key "${key}"`);
    const variant = entry[mode] ?? entry.normal;
    const color = entry.kind === 'ok' ? COLORS.GREEN : COLORS.CYAN;

    if (mode === 'tech') {
        if (variant.err) {
            return baseEmbed(mode, {
                color,
                title: `${ICONS.lock} ${variant.title}`,
                description: terminal(`- ERR :: ${variant.err(vars)}`, 'diff'),
            });
        }
        return baseEmbed(mode, { color, title: variant.title, description: terminal(variant.lines(vars).join('\n'), variant.lang) });
    }

    return baseEmbed(mode, { color, title: variant.title, description: variant.text(vars) });
}

/** Style for whoever triggered an interaction. */
const modeOf = (user) => getMode(user?.id);

/** Style for messages posted by the player itself: follows whoever queued the song. */
function modeForQueue(queue, track = queue?.currentTrack) {
    return getMode(track?.requestedBy?.id ?? queue?.metadata?.requestedBy?.id);
}

module.exports = { render, modeOf, modeForQueue, loopLabel, MESSAGES };
