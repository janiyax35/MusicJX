require('dotenv').config({ quiet: true });

const { Client, GatewayIntentBits, REST, Routes, ApplicationFlagsBitField } = require('discord.js');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');
const { YoutubeExtractor } = require('discord-player-youtubei');

const logger = require('./utils/logger');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { flushAll } = require('./storage/jsonStore');
const panel = require('./player/panel');

/** True if the bot's application has the Message Content Intent switched on. */
async function messageContentEnabled(token) {
    try {
        const app = await new REST().setToken(token).get(Routes.currentApplication());
        const flags = new ApplicationFlagsBitField(app.flags ?? 0);
        return flags.any([ApplicationFlagsBitField.Flags.GatewayMessageContent, ApplicationFlagsBitField.Flags.GatewayMessageContentLimited]);
    } catch {
        return false; // unreachable / bad token — login will report the real problem
    }
}

async function boot() {
    logger.banner();

    if (!process.env.DISCORD_TOKEN) {
        logger.error('DISCORD_TOKEN missing. Copy .env.example to .env and fill it in.');
        process.exit(1);
    }

    // Typing a number to pick /search options needs the privileged Message Content Intent.
    // Only request it if it's enabled in the Developer Portal — otherwise login would be rejected.
    const typedChoices = await messageContentEnabled(process.env.DISCORD_TOKEN);
    const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates];
    if (typedChoices) intents.push(GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent);
    logger.info(
        typedChoices
            ? 'Message Content Intent on :: users can type numbers in /search'
            : 'Message Content Intent off :: /search uses clicks only (enable it in the Developer Portal to allow typed numbers)',
    );

    const client = new Client({ intents });
    client.typedChoices = typedChoices;

    const player = new Player(client);
    client.player = player;
    client.commands = loadCommands();
    logger.success(`Command matrix loaded :: ${client.commands.size} modules`);

    // YouTube first so Spotify/Apple Music tracks bridge to it for playback.
    await player.extractors.register(YoutubeExtractor, {
        cookie: process.env.YOUTUBE_COOKIE || undefined,
    });
    await player.extractors.loadMulti(DefaultExtractors);
    logger.success(`Extractors online :: ${player.extractors.size} packet sniffers armed`);

    if (process.env.DEBUG === 'true') {
        logger.info(player.scanDeps());
        player.on('debug', (msg) => logger.debug(`[player] ${msg}`));
        player.events.on('debug', (queue, msg) => logger.debug(`[${queue.guild.name}] ${msg}`));
    }

    const events = loadEvents(client, player);
    logger.success(`Event listeners bound :: ${events} hooks`);

    // Last-resort safety nets so a single bad stream never takes the daemon down.
    process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection', reason));
    process.on('uncaughtException', (error) => logger.error('Uncaught exception', error));

    const shutdown = async (signal) => {
        logger.warn(`${signal} received :: terminating all connections`);
        flushAll(); // write pending playlist / settings changes before exiting
        panel.closeAll();
        try {
            await player.destroy();
            await client.destroy();
        } finally {
            process.exit(0);
        }
    };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));

    logger.info('Establishing gateway handshake...');
    await client.login(process.env.DISCORD_TOKEN);
}

boot().catch((error) => {
    logger.error('Boot sequence failed', error);
    process.exit(1);
});
