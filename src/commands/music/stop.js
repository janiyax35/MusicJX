const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueue } = require('../../utils/guards');
const { render, modeOf } = require('../../ui/text');

/** Clears the queue and leaves voice. Shared with the ⏹️ button on the now-playing panel. */
function stopQueue(queue) {
    const count = queue.tracks.size + (queue.currentTrack ? 1 : 0);
    queue.delete(); // queueDelete event closes the now-playing panel
    return count;
}

module.exports = {
    data: new SlashCommandBuilder().setName('stop').setDescription('Stop the music, clear the queue and leave the voice channel.'),

    stopQueue,

    async execute(interaction) {
        // needsTrack: false so /stop also cleans up a connected-but-idle session.
        const queue = await requireActiveQueue(interaction, { needsTrack: false });
        if (!queue) return;

        const count = stopQueue(queue);
        return interaction.reply({
            embeds: [render(modeOf(interaction.user), 'stopped', { count, user: interaction.user.username })],
        });
    },
};
