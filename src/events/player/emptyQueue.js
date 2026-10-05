const { GuildQueueEvent } = require('discord-player');
const { render, modeForQueue } = require('../../ui/text');
const { notify } = require('../../utils/notify');
const panel = require('../../player/panel');
const logger = require('../../utils/logger');

module.exports = {
    name: GuildQueueEvent.EmptyQueue,
    async execute(queue) {
        logger.info(`[${queue.guild.name}] Queue finished`);
        await panel.close(queue.guild.id);

        const cooldown = queue.options.leaveOnEnd ? Math.round((queue.options.leaveOnEndCooldown ?? 0) / 1000) : 0;
        await notify(queue, { embeds: [render(modeForQueue(queue, null), 'queueEnded', { cooldown })] });
    },
};
