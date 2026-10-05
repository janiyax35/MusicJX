const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueue, fail } = require('../../utils/guards');
const { render, modeOf } = require('../../ui/text');
const { parseTime, formatMs } = require('../../utils/time');
const { seekTo, trackTiming } = require('../../player/controls');
const panel = require('../../player/panel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Jump to a time in the current song.')
        .addStringOption((option) =>
            option.setName('time').setDescription('Time to jump to, e.g. 90, 1:30 or 1:02:03').setRequired(true).setMaxLength(12),
        ),

    async execute(interaction) {
        const queue = await requireActiveQueue(interaction);
        if (!queue) return;

        const input = interaction.options.getString('time', true);
        const ms = parseTime(input);
        if (ms === null) return fail(interaction, 'invalidTime', { input });

        const timing = trackTiming(queue);
        if (!timing) return fail(interaction, 'cannotSeekLive');
        if (ms >= timing.total) return fail(interaction, 'timeOutOfRange', { total: formatMs(timing.total) });

        // Seeking restarts the stream at the new position, which can take a few seconds.
        await interaction.deferReply();
        const errorKey = await seekTo(queue, ms);
        if (errorKey) return fail(interaction, errorKey, { total: formatMs(timing.total) });

        void panel.refresh(interaction.guildId);
        return interaction.editReply({
            embeds: [render(modeOf(interaction.user), 'seeked', { time: formatMs(ms), total: formatMs(timing.total) })],
        });
    },
};
