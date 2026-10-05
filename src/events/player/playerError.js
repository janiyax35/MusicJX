const { GuildQueueEvent } = require('discord-player');
const { render, modeForQueue } = require('../../ui/text');
const { notify } = require('../../utils/notify');
const logger = require('../../utils/logger');

// Fires when a single track fails to stream; discord-player then moves to the next track.
module.exports = {
    name: GuildQueueEvent.PlayerError,
    async execute(queue, error, track) {
        logger.error(`[${queue.guild.name}] Stream failure on "${track?.title}"`, error);
        await notify(queue, { embeds: [render(modeForQueue(queue, track), 'trackError', { title: track?.title ?? 'Unknown song' })] });
    },
};
