const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const { fail } = require('../utils/guards');

const IDLE_MS = 120_000;

function buildControls(id, current, totalPages, disabled = false) {
    const btn = (suffix, emoji, isDisabled) =>
        new ButtonBuilder()
            .setCustomId(`${id}:${suffix}`)
            .setEmoji(emoji)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled || isDisabled);

    return new ActionRowBuilder().addComponents(
        btn('first', '⏮️', current === 0),
        btn('prev', '◀️', current === 0),
        btn('refresh', '🔄', false),
        btn('next', '▶️', current >= totalPages - 1),
        btn('last', '⏭️', current >= totalPages - 1),
    );
}

/**
 * Replies with a paginated embed and handles the page buttons.
 * `renderPage(page)` must return { embed, current, totalPages } and is called
 * again on every click, so pages always reflect live data.
 */
async function paginate(interaction, { renderPage, startPage = 0, ephemeral = false }) {
    const id = `page:${interaction.id}`;
    let view = renderPage(startPage);
    let page = view.current;

    const response = await interaction.reply({
        embeds: [view.embed],
        components: view.totalPages > 1 ? [buildControls(id, page, view.totalPages)] : [],
        flags: ephemeral ? MessageFlags.Ephemeral : undefined,
        withResponse: true,
    });

    if (view.totalPages <= 1) return;

    const collector = response.resource.message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        idle: IDLE_MS,
        filter: (i) => i.customId.startsWith(`${id}:`),
    });

    collector.on('collect', async (button) => {
        if (button.user.id !== interaction.user.id) {
            await fail(button, 'notYourView');
            return;
        }

        const action = button.customId.split(':').pop();
        if (action === 'first') page = 0;
        else if (action === 'prev') page -= 1;
        else if (action === 'next') page += 1;
        else if (action === 'last') page = Number.MAX_SAFE_INTEGER; // clamped by renderPage

        view = renderPage(page);
        page = view.current;
        await button.update({ embeds: [view.embed], components: [buildControls(id, page, view.totalPages)] });
    });

    collector.on('end', async () => {
        await interaction.editReply({ components: [buildControls(id, page, view.totalPages, true)] }).catch(() => null);
    });
}

/** Clamps a page index and returns the slice for it. */
function pageSlice(items, page, pageSize) {
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const current = Math.min(Math.max(page, 0), totalPages - 1);
    const start = current * pageSize;
    return { current, totalPages, start, slice: items.slice(start, start + pageSize) };
}

module.exports = { paginate, pageSlice };
