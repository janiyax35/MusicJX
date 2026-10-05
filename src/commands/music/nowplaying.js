const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueue } = require('../../utils/guards');
const panel = require('../../player/panel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show the current song with a live progress bar and playback controls.'),

    async execute(interaction) {
        const queue = await requireActiveQueue(interaction);
        if (!queue) return;

        // Becomes the live panel for this server; the old one loses its buttons.
        await panel.show(queue, async (payload) => {
            const response = await interaction.reply({ ...payload, withResponse: true });
            return response.resource.message;
        });
    },
};
