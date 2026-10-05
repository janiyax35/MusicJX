const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueue } = require('../../utils/guards');
const { render, modeOf } = require('../../ui/text');

/** Shared by /skip and /next. */
async function skipCurrent(interaction) {
    const queue = await requireActiveQueue(interaction);
    if (!queue) return;

    const skipped = queue.currentTrack;
    const next = queue.tracks.at(0);
    queue.node.skip();

    return interaction.reply({
        embeds: [render(modeOf(interaction.user), 'skipped', { title: skipped.title, next: next?.title })],
    });
}

module.exports = {
    data: new SlashCommandBuilder().setName('skip').setDescription('Skip to the next song.'),
    skipCurrent,
    execute: skipCurrent,
};
