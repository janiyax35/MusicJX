const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { QueueRepeatMode } = require('discord-player');
const { baseEmbed, readout, terminal, progressBar, sliderBar, clip, linkLabel, COLORS, ICONS } = require('../utils/theme');
const { formatMs } = require('../utils/time');
const { loopLabel } = require('./text');
const { trackTiming } = require('../player/controls');

const SEEK_STEPS = 20; // select menu positions: 0%, 5%, … 95%

const LABELS = {
    normal: {
        prev: 'Previous',
        pause: 'Pause',
        resume: 'Resume',
        next: 'Next',
        loop: (m) => `Loop: ${loopLabel('normal', m)}`,
        stop: 'Stop',
        rw: '-10s',
        ff: '+10s',
        queue: 'Queue',
        seek: '🎚️ Jump to a position in the song…',
        seekOption: (pct) => `${pct}% into the song`,
    },
    tech: {
        prev: 'PREV',
        pause: 'HALT',
        resume: 'RESUME',
        next: 'NEXT',
        loop: (m) => `LOOP:${loopLabel('tech', m)}`,
        stop: 'KILL',
        rw: '-10s',
        ff: '+10s',
        queue: 'BUFFER',
        seek: '[ SEEK_OFFSET ] select timestamp…',
        seekOption: (pct) => `offset ${pct}%`,
    },
};

function normalEmbed(queue, track, timing) {
    const paused = queue.node.isPaused();
    const next = queue.tracks.at(0);

    const progress = timing
        ? `\`${formatMs(timing.current)}\` ${sliderBar(timing.current / timing.total)} \`${formatMs(timing.total)}\``
        : '🔴 **LIVE**';

    return baseEmbed('normal', {
        color: paused ? COLORS.CYAN : COLORS.GREEN,
        title: paused ? '⏸️ Paused' : '🎶 Now Playing',
        description: `**[${linkLabel(track.title)}](${track.url})**\nby ${clip(track.author, 60)}\n\n${progress}`,
    }).addFields(
        { name: 'Requested by', value: track.requestedBy ? `<@${track.requestedBy.id}>` : 'Unknown', inline: true },
        { name: 'Loop', value: loopLabel('normal', queue.repeatMode), inline: true },
        { name: 'Songs in queue', value: String(queue.tracks.size), inline: true },
        {
            name: 'Up next',
            value: next ? `[${linkLabel(next.title, 70)}](${next.url})` : 'Nothing yet — add more with `/play`',
        },
    );
}

function techEmbed(queue, track, timing) {
    const paused = queue.node.isPaused();
    const next = queue.tracks.at(0);
    const ratio = timing ? timing.current / timing.total : 1;
    const bar = timing
        ? `DECRYPTING ${progressBar(ratio)} ${Math.floor(ratio * 100)}%\n${formatMs(timing.current)} / ${formatMs(timing.total)}`
        : `DECRYPTING ${progressBar(1)} LIVE`;

    return baseEmbed('tech', {
        color: paused ? COLORS.CYAN : COLORS.GREEN,
        title: `${ICONS.antenna} ${paused ? '[ STREAM_INTERCEPTED ]' : '[ ACTIVE_AUDIO_STREAM ]'}`,
        description: [
            `**[ DECRYPTING_TRACK ]** → [${linkLabel(track.title)}](${track.url})`,
            terminal(bar),
            readout([
                ['ORIGIN', clip(track.author, 40)],
                ['STATUS', paused ? 'STREAM_INTERCEPTED' : 'STREAMING'],
                ['LOOP', loopLabel('tech', queue.repeatMode)],
                ['BUFFERED', `${queue.tracks.size} packet(s)`],
                ['NEXT_TARGET', next ? clip(next.title, 36) : '<null>'],
                ['OPERATOR', track.requestedBy?.username ?? 'unknown'],
            ]),
        ].join('\n'),
    });
}

function controls(queue, mode, timing) {
    const L = LABELS[mode];
    const paused = queue.node.isPaused();
    const looping = queue.repeatMode !== QueueRepeatMode.OFF;

    const button = (id, emoji, label, style = ButtonStyle.Secondary, disabled = false) =>
        new ButtonBuilder().setCustomId(`np:${id}`).setEmoji(emoji).setLabel(label).setStyle(style).setDisabled(disabled);

    const rows = [
        new ActionRowBuilder().addComponents(
            button('prev', '⏮️', L.prev, ButtonStyle.Secondary, !queue.history.previousTrack),
            button('toggle', paused ? '▶️' : '⏸️', paused ? L.resume : L.pause, ButtonStyle.Primary),
            button('next', '⏭️', L.next),
            button('loop', queue.repeatMode === QueueRepeatMode.TRACK ? '🔂' : '🔁', L.loop(queue.repeatMode), looping ? ButtonStyle.Success : ButtonStyle.Secondary),
            button('stop', '⏹️', L.stop, ButtonStyle.Danger),
        ),
        new ActionRowBuilder().addComponents(
            button('rw', '⏪', L.rw, ButtonStyle.Secondary, !timing),
            button('ff', '⏩', L.ff, ButtonStyle.Secondary, !timing),
            button('queue', '📜', L.queue),
        ),
    ];

    if (timing) {
        const seen = new Set();
        const options = [];
        for (let i = 0; i < SEEK_STEPS; i++) {
            const ms = Math.floor((timing.total * i) / SEEK_STEPS / 1000) * 1000;
            if (seen.has(ms)) continue; // very short tracks produce duplicate seconds
            seen.add(ms);
            options.push({ label: formatMs(ms), description: L.seekOption(Math.round((i * 100) / SEEK_STEPS)), value: String(ms) });
        }
        rows.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('np:seek').setPlaceholder(L.seek).addOptions(options),
            ),
        );
    }

    return rows;
}

/** Full message payload (embed + buttons + seek menu) for the now-playing panel. */
function buildNowPlaying(queue, mode) {
    const track = queue.currentTrack;
    const timing = trackTiming(queue);
    const embed = mode === 'tech' ? techEmbed(queue, track, timing) : normalEmbed(queue, track, timing);
    if (track.thumbnail) embed.setThumbnail(track.thumbnail);
    return { embeds: [embed], components: controls(queue, mode, timing) };
}

module.exports = { buildNowPlaying };
