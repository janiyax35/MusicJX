const fs = require('node:fs');
const path = require('node:path');
const logger = require('../utils/logger');

const EVENTS_DIR = path.join(__dirname, '..', 'events');

function loadDir(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((file) => file.endsWith('.js'))
        .map((file) => ({ file, event: require(path.join(dir, file)) }));
}

/**
 * Wraps a handler so a thrown error in one event can never crash the process.
 */
function safe(name, fn) {
    return async (...args) => {
        try {
            await fn(...args);
        } catch (error) {
            logger.error(`Event handler "${name}" crashed`, error);
        }
    };
}

/**
 * Binds event modules:
 *   src/events/client/*.js  -> discord.js Client events
 *   src/events/player/*.js  -> discord-player GuildQueue events (player.events)
 * Each module exports { name, once?, execute }.
 */
function loadEvents(client, player) {
    let count = 0;

    for (const { file, event } of loadDir(path.join(EVENTS_DIR, 'client'))) {
        if (!event?.name || typeof event.execute !== 'function') {
            logger.warn(`Skipping malformed client event: ${file}`);
            continue;
        }
        const handler = safe(event.name, (...args) => event.execute(...args, client));
        if (event.once) client.once(event.name, handler);
        else client.on(event.name, handler);
        count++;
    }

    for (const { file, event } of loadDir(path.join(EVENTS_DIR, 'player'))) {
        if (!event?.name || typeof event.execute !== 'function') {
            logger.warn(`Skipping malformed player event: ${file}`);
            continue;
        }
        player.events.on(event.name, safe(event.name, (...args) => event.execute(...args, player)));
        count++;
    }

    return count;
}

module.exports = { loadEvents };
