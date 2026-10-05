const { QueueRepeatMode } = require('discord-player');
const { formatMs } = require('../utils/time');

/** Current position / length of the playing track, or null for live streams. */
function trackTiming(queue) {
    const ts = queue.node.getTimestamp();
    const total = ts?.total.value;
    if (!ts || !Number.isFinite(total) || total <= 0) return null;
    return { current: ts.current.value, total };
}

/**
 * Jumps to an absolute position (ms) in the current track.
 * Returns null on success, or the message key describing why it failed.
 */
async function seekTo(queue, ms) {
    const timing = trackTiming(queue);
    if (!timing) return 'cannotSeekLive';
    if (ms >= timing.total) return 'timeOutOfRange';

    const ok = await queue.node.seek(Math.max(0, ms)).catch(() => false);
    return ok ? null : 'seekFailed';
}

/** Moves forward/backward by `deltaMs`, clamped to the track bounds. */
function seekBy(queue, deltaMs) {
    const timing = trackTiming(queue);
    if (!timing) return Promise.resolve('cannotSeekLive');
    const target = Math.min(Math.max(timing.current + deltaMs, 0), timing.total - 1000);
    return seekTo(queue, target);
}

const LOOP_CYCLE = [QueueRepeatMode.OFF, QueueRepeatMode.TRACK, QueueRepeatMode.QUEUE];

/** Off → this song → whole queue → off. */
function cycleLoop(queue) {
    const index = LOOP_CYCLE.indexOf(queue.repeatMode);
    const next = LOOP_CYCLE[(index + 1) % LOOP_CYCLE.length];
    queue.setRepeatMode(next);
    return next;
}

/** Human-readable "position / length" for the current track. */
function positionLabel(queue) {
    const timing = trackTiming(queue);
    return timing ? { time: formatMs(timing.current), total: formatMs(timing.total) } : { time: 'LIVE', total: 'LIVE' };
}

module.exports = { trackTiming, seekTo, seekBy, cycleLoop, positionLabel };
