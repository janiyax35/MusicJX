const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { render, modeOf } = require('../ui/text');

/**
 * Replies with an error message in the user's chosen style.
 * Errors are ephemeral unless we're editing an already-deferred slash command reply.
 */
async function fail(interaction, key, vars) {
    const payload = { embeds: [render(modeOf(interaction.user), key, vars)] };
    try {
        // Deferred component interactions must not overwrite the message they belong to.
        if (interaction.deferred && !interaction.isMessageComponent()) return await interaction.editReply(payload);
        if (interaction.deferred || interaction.replied) {
            return await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
        }
        return await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    } catch {
        // Interaction token expired or channel gone — nothing left to report to.
        return null;
    }
}

/**
 * Validates that the member is connected to a voice channel and, if the bot
 * is already connected somewhere in this guild, that it's the same channel.
 * Returns the member's voice channel, or null after replying with an error.
 */
async function requireVoice(interaction) {
    const memberChannel = interaction.member?.voice?.channel;
    if (!memberChannel) {
        await fail(interaction, 'notInVoice');
        return null;
    }

    const botChannel = interaction.guild.members.me?.voice?.channel;
    if (botChannel && botChannel.id !== memberChannel.id) {
        await fail(interaction, 'wrongChannel', { channel: botChannel.name });
        return null;
    }

    return memberChannel;
}

/** Checks the bot can actually connect + speak in the target channel. */
async function requireVoicePermissions(interaction, channel) {
    const perms = channel.permissionsFor(interaction.guild.members.me);
    const missing = [];
    if (!perms?.has(PermissionFlagsBits.ViewChannel)) missing.push('View Channel');
    if (!perms?.has(PermissionFlagsBits.Connect)) missing.push('Connect');
    if (!perms?.has(PermissionFlagsBits.Speak)) missing.push('Speak');

    if (missing.length) {
        await fail(interaction, 'missingPerms', { perms: missing.join(', ') });
        return false;
    }
    if (channel.full && !perms.has(PermissionFlagsBits.MoveMembers)) {
        await fail(interaction, 'channelFull');
        return false;
    }
    return true;
}

/**
 * Full guard for commands that control an existing stream:
 * user in the same voice channel + an active queue exists.
 * Returns the queue, or null after replying with an error.
 */
async function requireActiveQueue(interaction, { needsTrack = true } = {}) {
    const channel = await requireVoice(interaction);
    if (!channel) return null;

    const queue = interaction.client.player.nodes.get(interaction.guildId);
    if (!queue || (needsTrack && !queue.currentTrack)) {
        await fail(interaction, 'noQueue');
        return null;
    }
    return queue;
}

module.exports = { fail, requireVoice, requireVoicePermissions, requireActiveQueue };
