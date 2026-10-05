const { GuildQueueEvent } = require('discord-player');
const { render, modeForQueue } = require('../../ui/text');
const { notify } = require('../../utils/notify');
const panel = require('../../player/panel');
const logger = require('../../utils/logger');

module.exports = {
    name: GuildQueueEvent.EmptyChannel,
    async execute(queue) {
        logger.info(`[${queue.guild.name}] Voice channel empty — leaving`);
        await panel.close(queue.guild.id);
        await notify(queue, { embeds: [render(modeForQueue(queue, null), 'channelEmpty')] });
    },
};
