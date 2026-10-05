const { PermissionFlagsBits } = require('discord.js');
const logger = require('./logger');

/**
 * Sends a message to the text channel stored in a queue's metadata.
 * Silently no-ops if the channel was deleted or the bot lost send perms,
 * so player events never throw because of a missing channel.
 */
async function notify(queue, payload) {
    const channel = queue?.metadata?.channel;
    if (!channel?.isTextBased?.()) return null;

    const me = channel.guild?.members?.me;
    const perms = me ? channel.permissionsFor(me) : null;
    if (perms && !perms.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
        logger.warn(`Cannot transmit to #${channel.name} in ${channel.guild.name}: missing send/embed permissions`);
        return null;
    }

    try {
        return await channel.send(payload);
    } catch (error) {
        logger.warn(`Transmission to #${channel.name} failed: ${error.message}`);
        return null;
    }
}

module.exports = { notify };
