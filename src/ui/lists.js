const { baseEmbed, terminal, readout, clip, linkLabel, COLORS, ICONS } = require('../utils/theme');
const { formatMs } = require('../utils/time');
const { pageSlice } = require('./paginator');
const { loopLabel } = require('./text');

const QUEUE_PAGE_SIZE = 10;
const PLAYLIST_PAGE_SIZE = 15;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const totalRuntime = (tracks) => formatMs(tracks.reduce((sum, t) => sum + (t.durationMS || 0), 0));

/** One page of the live queue. `queue` may be null if playback ended. */
function queuePage(queue, page, mode) {
    const tracks = queue?.tracks.toArray() ?? [];
    const { current, totalPages, start, slice } = pageSlice(tracks, page, QUEUE_PAGE_SIZE);
    const now = queue?.currentTrack;

    if (mode === 'tech') {
        const header = now ? `>> [ACTIVE] ${clip(now.title, 42)} [${now.duration || 'LIVE'}]` : '>> [ACTIVE] <null>';
        const width = String(start + slice.length).length;
        const rows = slice.length
            ? slice.map((t, i) => `[${String(start + i + 1).padStart(width, '0')}] ${clip(t.title, 34).padEnd(34)} ${(t.duration || 'LIVE').padStart(8)}`)
            : ['> buffer empty :: inject packets with /play'];

        const embed = baseEmbed('tech', {
            color: COLORS.CYAN,
            title: `${ICONS.disk} [ BUFFER_OVERFLOW_QUEUE ]`,
            description: [
                terminal(`$ cat /dev/musicjx/buffer --page ${current + 1}\n${header}\n${'-'.repeat(50)}\n${rows.join('\n')}`),
                terminal(
                    `packets: ${tracks.length}  |  est_runtime: ${totalRuntime(tracks)}  |  loop: ${loopLabel('tech', queue?.repeatMode)}  |  page: ${current + 1}/${totalPages}`,
                    'yml',
                ),
            ].join('\n'),
        });
        return { embed, current, totalPages };
    }

    const lines = [];
    lines.push(now ? `**Now playing:** [${linkLabel(now.title, 70)}](${now.url}) · \`${now.duration || 'LIVE'}\`` : '**Now playing:** nothing');
    lines.push('');
    if (slice.length) {
        lines.push('**Up next:**');
        slice.forEach((t, i) => lines.push(`\`${start + i + 1}.\` ${clip(t.title, 60)} — ${clip(t.author, 30)} · \`${t.duration || 'LIVE'}\``));
    } else {
        lines.push('No more songs in the queue. Add some with `/play`.');
    }
    lines.push('');
    lines.push(
        `${plural(tracks.length, 'song')} waiting · ${totalRuntime(tracks)} total · Loop: ${loopLabel('normal', queue?.repeatMode)} · Page ${current + 1}/${totalPages}`,
    );

    const embed = baseEmbed('normal', { color: COLORS.CYAN, title: '📜 Queue', description: lines.join('\n') });
    return { embed, current, totalPages };
}

/** One page of a saved playlist's tracks. */
function playlistPage(playlist, page, mode) {
    const tracks = playlist.tracks;
    const { current, totalPages, start, slice } = pageSlice(tracks, page, PLAYLIST_PAGE_SIZE);

    if (mode === 'tech') {
        const width = String(start + slice.length).length;
        const rows = slice.length
            ? slice.map((t, i) => `[${String(start + i + 1).padStart(width, '0')}] ${clip(t.title, 34).padEnd(34)} ${(t.duration || 'LIVE').padStart(8)}`)
            : ['> archive empty :: write packets with /playlist add'];
        const embed = baseEmbed('tech', {
            color: COLORS.CYAN,
            title: `${ICONS.disk} [ ARCHIVE :: ${clip(playlist.name, 32)} ]`,
            description: [
                terminal(`$ ls vault/${playlist.name} --page ${current + 1}\n${rows.join('\n')}`),
                terminal(`packets: ${tracks.length}  |  page: ${current + 1}/${totalPages}`, 'yml'),
            ].join('\n'),
        });
        return { embed, current, totalPages };
    }

    const lines = slice.length
        ? slice.map((t, i) => `\`${start + i + 1}.\` ${clip(t.title, 60)} — ${clip(t.author, 30)} · \`${t.duration || 'LIVE'}\``)
        : ['This playlist is empty. Add songs with `/playlist add`.'];
    lines.push('', `${plural(tracks.length, 'song')} · Page ${current + 1}/${totalPages}`);

    const embed = baseEmbed('normal', { color: COLORS.CYAN, title: `📁 ${playlist.name}`, description: lines.join('\n') });
    return { embed, current, totalPages };
}

/** Overview of all of a user's playlists. */
function playlistOverview(playlists, mode, max) {
    if (mode === 'tech') {
        const body = playlists.length
            ? readout(playlists.map((p) => [clip(p.name, 32), `${p.tracks.length} packet(s)`]))
            : terminal('> vault empty :: /playlist create <name>');
        return baseEmbed('tech', {
            color: COLORS.CYAN,
            title: `${ICONS.lock} [ PERSONAL_VAULT ] ${playlists.length}/${max}`,
            description: body,
        });
    }

    const description = playlists.length
        ? playlists.map((p) => `📁 **${p.name}** — ${plural(p.tracks.length, 'song')}`).join('\n') +
          '\n\nPlay one with `/playlist play`, or see its songs with `/playlist view`.'
        : 'You don’t have any playlists yet.\nCreate one with `/playlist create`.';

    return baseEmbed('normal', { color: COLORS.CYAN, title: `📁 Your playlists (${playlists.length}/${max})`, description });
}

module.exports = { queuePage, playlistPage, playlistOverview };
