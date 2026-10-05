const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');
const logger = require('../utils/logger');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

/** Recursively collects every .js file under a directory. */
function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return entry.name.endsWith('.js') ? [full] : [];
    });
}

/**
 * Loads all command modules. Each module must export `data` (a SlashCommandBuilder)
 * and `execute(interaction)`. Invalid modules are skipped with a warning.
 */
function loadCommands() {
    const commands = new Collection();

    for (const file of walk(COMMANDS_DIR)) {
        const command = require(file);
        const rel = path.relative(COMMANDS_DIR, file);

        if (!command?.data?.name || typeof command.execute !== 'function') {
            logger.warn(`Skipping malformed command module: ${rel}`);
            continue;
        }
        if (commands.has(command.data.name)) {
            logger.warn(`Duplicate command name "${command.data.name}" in ${rel} — skipped`);
            continue;
        }
        commands.set(command.data.name, command);
        logger.debug(`Command mounted: /${command.data.name} (${rel})`);
    }

    return commands;
}

module.exports = { loadCommands };
