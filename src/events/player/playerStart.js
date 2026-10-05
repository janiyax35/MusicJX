const { GuildQueueEvent } = require('discord-player');
const { notify } = require('../../utils/notify');
const panel = require('../../player/panel');
const logger = require('../../utils/logger');

module.exports = {
    name: GuildQueueEvent.PlayerStart,
    async execute(queue, track) {
        logger.info(`[${queue.guild.name}] Streaming: ${track.title} — ${track.author}`);
        // Live now-playing panel with controls; replaces the previous song's panel.
        await panel.show(queue, (payload) => notify(queue, payload));
    },
};
