// Registers slash commands with Discord. Run with: npm run deploy
// If GUILD_ID is set (one ID, or several separated by commas), commands register
// to those servers instantly. Otherwise they register globally (can take up to ~1 hour).
require('dotenv').config({ quiet: true });

const { REST, Routes, RESTJSONErrorCodes } = require('discord.js');
const logger = require('./utils/logger');
const { loadCommands } = require('./handlers/commandHandler');

async function deploy() {
    const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
    if (!DISCORD_TOKEN || !CLIENT_ID) {
        logger.error('DISCORD_TOKEN and CLIENT_ID are required in .env');
        process.exit(1);
    }

    const body = loadCommands().map((command) => command.data.toJSON());
    const rest = new REST().setToken(DISCORD_TOKEN);
    const guildIds = (GUILD_ID ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);

    if (!guildIds.length) {
        logger.info(`Uploading ${body.length} command payloads globally...`);
        const result = await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
        logger.success(`Deployed ${result.length} commands: ${result.map((c) => `/${c.name}`).join(' ')}`);
        return;
    }

    let failed = 0;
    for (const guildId of guildIds) {
        try {
            const result = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body });
            logger.success(`Server ${guildId} :: deployed ${result.length} commands`);
        } catch (error) {
            failed++;
            if (error.code === RESTJSONErrorCodes.MissingAccess) {
                logger.error(`Server ${guildId} :: bot isn't in this server yet (or the ID is wrong) — invite it first`);
            } else {
                logger.error(`Server ${guildId} :: deployment failed`, error);
            }
        }
    }
    if (failed) process.exit(1);
}

deploy().catch((error) => {
    logger.error('Command deployment failed', error);
    process.exit(1);
});
