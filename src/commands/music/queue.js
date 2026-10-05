const { SlashCommandBuilder } = require('discord.js');
const { requireActiveQueue } = require('../../utils/guards');
const { modeOf } = require('../../ui/text');
const { queuePage } = require('../../ui/lists');
const { paginate } = require('../../ui/paginator');

/** Shows the live queue with page buttons. Also used by the 📜 button on the now-playing panel. */
function showQueue(interaction, { page = 0, ephemeral = false } = {}) {
    const player = interaction.client.player;
    const mode = modeOf(interaction.user);
    return paginate(interaction, {
        startPage: page,
        ephemeral,
        // Re-read the queue on every click so pages reflect skips/additions.
        renderPage: (p) => queuePage(player.nodes.get(interaction.guildId), p, mode),
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the songs waiting to play.')
        .addIntegerOption((option) => option.setName('page').setDescription('Page to open').setMinValue(1)),

    showQueue,

    async execute(interaction) {
        const queue = await requireActiveQueue(interaction, { needsTrack: false });
        if (!queue) return;
        return showQueue(interaction, { page: (interaction.options.getInteger('page') ?? 1) - 1 });
    },
};
