const { SlashCommandBuilder } = require('discord.js');
const { QueueRepeatMode } = require('discord-player');
const { requireActiveQueue } = require('../../utils/guards');
const { render, modeOf } = require('../../ui/text');
const { cycleLoop } = require('../../player/controls');
const panel = require('../../player/panel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Repeat the current song or the whole queue.')
        .addStringOption((option) =>
            option
                .setName('mode')
                .setDescription('What to repeat (leave empty to switch to the next option)')
                .addChoices(
                    { name: 'Off', value: 'off' },
                    { name: 'This song', value: 'track' },
                    { name: 'Whole queue', value: 'queue' },
                ),
        ),

    async execute(interaction) {
        const queue = await requireActiveQueue(interaction);
        if (!queue) return;

        const choice = interaction.options.getString('mode');
        let repeatMode;
        if (choice) {
            repeatMode = { off: QueueRepeatMode.OFF, track: QueueRepeatMode.TRACK, queue: QueueRepeatMode.QUEUE }[choice];
            queue.setRepeatMode(repeatMode);
        } else {
            repeatMode = cycleLoop(queue);
        }

        void panel.refresh(interaction.guildId);
        return interaction.reply({ embeds: [render(modeOf(interaction.user), 'loopSet', { repeatMode })] });
    },
};
