const { GuildQueueEvent } = require('discord-player');
const panel = require('../../player/panel');

// Queue destroyed for any reason (/stop, auto-leave, errors) — retire its panel.
module.exports = {
    name: GuildQueueEvent.QueueDelete,
    async execute(queue) {
        await panel.close(queue.guild.id);
    },
};
