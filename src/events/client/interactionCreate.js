const { Events } = require('discord.js');
const logger = require('../../utils/logger');
const { fail } = require('../../utils/guards');
const nowPlayingControls = require('../../components/nowPlayingControls');

// Persistent component handlers, matched by custom id prefix.
// (Short-lived components such as page buttons use collectors instead.)
const COMPONENT_HANDLERS = [nowPlayingControls];

async function handleCommand(interaction, client) {
    if (!interaction.inGuild()) return fail(interaction, 'guildOnly');

    const command = client.commands.get(interaction.commandName);
    if (!command) return fail(interaction, 'unknownCommand', { name: interaction.commandName });

    const sub = interaction.options.getSubcommand(false);
    logger.info(`${interaction.user.tag} -> /${interaction.commandName}${sub ? ` ${sub}` : ''} @ ${interaction.guild.name}`);
    return command.execute(interaction);
}

async function handleAutocomplete(interaction, client) {
    const command = client.commands.get(interaction.commandName);
    if (!command?.autocomplete) return interaction.respond([]);
    return command.autocomplete(interaction);
}

async function handleComponent(interaction) {
    const handler = COMPONENT_HANDLERS.find((h) => interaction.customId.startsWith(h.prefix));
    if (!handler || !interaction.inGuild()) return; // collector-owned component
    return handler.execute(interaction);
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        try {
            if (interaction.isChatInputCommand()) return await handleCommand(interaction, client);
            if (interaction.isAutocomplete()) return await handleAutocomplete(interaction, client);
            if (interaction.isButton() || interaction.isStringSelectMenu()) return await handleComponent(interaction);
        } catch (error) {
            const label = interaction.commandName ? `/${interaction.commandName}` : interaction.customId;
            logger.error(`${label} failed`, error);
            if (interaction.isRepliable()) await fail(interaction, 'crash');
        }
    },
};
