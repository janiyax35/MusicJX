const { Events, ActivityType } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        client.user.setPresence({
            activities: [{ name: '/play • /help', type: ActivityType.Listening }],
            status: 'online',
        });
        logger.success(`Uplink established as ${client.user.tag} :: ${client.guilds.cache.size} sectors connected`);
    },
};
