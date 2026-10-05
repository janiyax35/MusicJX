const { GuildQueueEvent } = require('discord-player');
const { render, modeForQueue } = require('../../ui/text');
const { notify } = require('../../utils/notify');
const panel = require('../../player/panel');
const logger = require('../../utils/logger');

// Fires when the bot is removed from voice externally (kicked / moved out / channel deleted).
module.exports = {
    name: GuildQueueEvent.Disconnect,
    async execute(queue) {
        logger.warn(`[${queue.guild.name}] Forcibly disconnected from voice`);
        await panel.close(queue.guild.id);
        await notify(queue, { embeds: [render(modeForQueue(queue, null), 'disconnected')] });
    },
};
