const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueue, fail } = require('../../utils/guards');
const { render, modeOf } = require('../../ui/text');
const panel = require('../../player/panel');

module.exports = {
    data: new SlashCommandBuilder().setName('resume').setDescription('Continue playing paused music.'),

    async execute(interaction) {
        const queue = await requireActiveQueue(interaction);
        if (!queue) return;
        if (!queue.node.isPaused()) return fail(interaction, 'notPaused');

        queue.node.resume();
        void panel.refresh(interaction.guildId);
        return interaction.reply({ embeds: [render(modeOf(interaction.user), 'resumed')] });
    },
};
