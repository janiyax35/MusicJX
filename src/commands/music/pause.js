const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueue, fail } = require('../../utils/guards');
const { render, modeOf } = require('../../ui/text');
const { positionLabel } = require('../../player/controls');
const panel = require('../../player/panel');

module.exports = {
    data: new SlashCommandBuilder().setName('pause').setDescription('Pause the music.'),

    async execute(interaction) {
        const queue = await requireActiveQueue(interaction);
        if (!queue) return;
        if (queue.node.isPaused()) return fail(interaction, 'alreadyPaused');

        queue.node.pause();
        void panel.refresh(interaction.guildId);
        return interaction.reply({ embeds: [render(modeOf(interaction.user), 'paused', positionLabel(queue))] });
    },
};
