const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueue, fail } = require('../../utils/guards');
const { render, modeOf } = require('../../ui/text');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder().setName('previous').setDescription('Go back to the previous song.'),

    async execute(interaction) {
        const queue = await requireActiveQueue(interaction, { needsTrack: false });
        if (!queue) return;

        const previous = queue.history.previousTrack;
        if (!previous) return fail(interaction, 'noPrevious');

        await interaction.deferReply();
        try {
            // Plays the previous song and puts the current one back at the front of the queue.
            await queue.history.previous();
        } catch (error) {
            logger.error('Previous track failed', error);
            return fail(interaction, 'noPrevious');
        }

        return interaction.editReply({ embeds: [render(modeOf(interaction.user), 'previous', { title: previous.title })] });
    },
};
