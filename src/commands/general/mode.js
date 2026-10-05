const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { setMode } = require('../../storage/settings');
const { render } = require('../../ui/text');
const panel = require('../../player/panel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mode')
        .setDescription('Choose how MusicJX talks to you: simple words or hacker style.')
        .addStringOption((option) =>
            option
                .setName('style')
                .setDescription('Your preferred style')
                .setRequired(true)
                .addChoices(
                    { name: 'Normal — simple, everyday words', value: 'normal' },
                    { name: 'Tech — hacker terminal style', value: 'tech' },
                ),
        ),

    async execute(interaction) {
        const mode = interaction.options.getString('style', true);
        setMode(interaction.user.id, mode);

        // If the current song is theirs, the live panel switches style right away.
        if (interaction.inGuild()) void panel.refresh(interaction.guildId);

        return interaction.reply({ embeds: [render(mode, 'modeSet')], flags: MessageFlags.Ephemeral });
    },
};
