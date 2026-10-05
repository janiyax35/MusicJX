const { GuildQueueEvent } = require('discord-player');
const { render, modeForQueue } = require('../../ui/text');
const { notify } = require('../../utils/notify');
const logger = require('../../utils/logger');

// General queue-level error (connection failures, etc.).
module.exports = {
    name: GuildQueueEvent.Error,
    async execute(queue, error) {
        logger.error(`[${queue.guild.name}] Queue fault`, error);
        await notify(queue, { embeds: [render(modeForQueue(queue), 'queueError')] });
    },
};
