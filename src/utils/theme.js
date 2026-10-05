const { EmbedBuilder } = require('discord.js');

// MusicJX palette — every embed uses one of these two, nothing else.
const COLORS = {
    GREEN: 0x00ff00,
    CYAN: 0x00ffff,
};

const FOOTERS = {
    normal: 'MusicJX v1.0 • Made by JaniyaX',
    tech: 'MusicJX v1.0 | Authorized Auth: JaniyaX',
};

const ICONS = {
    pager: '📟',
    plug: '🔌',
    antenna: '📡',
    disk: '💾',
    lock: '🔒',
};

/** Wraps text in a Discord code block so it renders like a terminal. */
function terminal(text, lang = '') {
    return `\`\`\`${lang}\n${text}\n\`\`\``;
}

/** Renders `key: value` rows with aligned keys, inside a yml block. */
function readout(rows) {
    const width = Math.max(...rows.map(([key]) => key.length));
    const body = rows.map(([key, value]) => `${key.padEnd(width)} : ${value}`).join('\n');
    return terminal(body, 'yml');
}

/** Base embed with the mode's footer applied. */
function baseEmbed(mode, { color = COLORS.GREEN, title, description } = {}) {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setFooter({ text: FOOTERS[mode] ?? FOOTERS.normal })
        .setTimestamp();
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    return embed;
}

/** Terminal-style loading bar, e.g. [██████░░░░]. */
function progressBar(ratio, size = 20) {
    const clamped = clampRatio(ratio);
    const filled = Math.round(clamped * size);
    return `[${'█'.repeat(filled)}${'░'.repeat(size - filled)}]`;
}

/** YouTube-style scrubber, e.g. ━━━━━●──────── */
function sliderBar(ratio, size = 18) {
    const pos = Math.round(clampRatio(ratio) * (size - 1));
    return `${'━'.repeat(pos)}●${'─'.repeat(size - 1 - pos)}`;
}

function clampRatio(ratio) {
    return Math.min(Math.max(Number.isFinite(ratio) ? ratio : 0, 0), 1);
}

/** Truncates a string so embeds never exceed Discord limits. */
function clip(text, max = 50) {
    const str = String(text ?? '');
    return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

/** Escapes characters that would break a markdown [label](url) link. */
function linkLabel(text, max = 80) {
    return clip(text, max).replace(/[[\]]/g, '');
}

/** Pseudo-random hex "packet id" for flavour text. */
function hexId(length = 8) {
    let out = '';
    for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 16).toString(16);
    return `0x${out.toUpperCase()}`;
}

module.exports = {
    COLORS,
    FOOTERS,
    ICONS,
    terminal,
    readout,
    baseEmbed,
    progressBar,
    sliderBar,
    clip,
    linkLabel,
    hexId,
};
