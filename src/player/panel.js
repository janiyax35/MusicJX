const { buildNowPlaying } = require('../ui/nowPlaying');
const { modeForQueue } = require('../ui/text');
const logger = require('../utils/logger');

// How often the progress bar on the active panel is refreshed.
const REFRESH_MS = 15_000;

/** guildId -> { message, timer, player, busy } — one live panel per server. */
const panels = new Map();

/**
 * Posts a new now-playing panel (via `send`) and keeps its progress bar updated.
 * Any previous panel in the same server has its buttons removed.
 */
async function show(queue, send) {
    const guildId = queue.guild.id;
    await close(guildId);

    let message;
    try {
        message = await send(buildNowPlaying(queue, modeForQueue(queue)));
    } catch (error) {
        logger.warn(`[${queue.guild.name}] Could not post now-playing panel: ${error.message}`);
        return null;
    }
    if (!message) return null;

    // Another panel may have been posted while we were sending — retire it.
    await close(guildId);

    const timer = setInterval(() => void refresh(guildId), REFRESH_MS);
    timer.unref();
    panels.set(guildId, { message, timer, player: queue.player, busy: false });
    return message;
}

/** Re-renders the active panel with the latest position / state. */
async function refresh(guildId) {
    const entry = panels.get(guildId);
    if (!entry || entry.busy) return;

    const queue = entry.player.nodes.get(guildId);
    if (!queue?.currentTrack) {
        await close(guildId);
        return;
    }

    entry.busy = true;
    try {
        await entry.message.edit(buildNowPlaying(queue, modeForQueue(queue)));
    } catch (error) {
        // Message deleted or channel gone — stop tracking it.
        logger.debug(`Panel refresh failed in ${guildId}: ${error.message}`);
        clearInterval(entry.timer);
        if (panels.get(guildId) === entry) panels.delete(guildId);
    } finally {
        entry.busy = false;
    }
}

/** Stops updating the active panel and removes its buttons. */
async function close(guildId) {
    const entry = panels.get(guildId);
    if (!entry) return;
    clearInterval(entry.timer);
    panels.delete(guildId);
    await entry.message.edit({ components: [] }).catch(() => null);
}

/** True if `messageId` is the panel currently being controlled in this server. */
function isActive(guildId, messageId) {
    return panels.get(guildId)?.message.id === messageId;
}

/** Stops every refresh timer (shutdown). */
function closeAll() {
    for (const guildId of panels.keys()) void close(guildId);
}

module.exports = { show, refresh, close, isActive, closeAll };
