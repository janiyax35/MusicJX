const { requireActiveQueue, fail } = require('../utils/guards');
const { render, modeOf } = require('../ui/text');
const { seekTo, seekBy, cycleLoop } = require('../player/controls');
const { formatMs } = require('../utils/time');
const panel = require('../player/panel');
const { showQueue } = require('../commands/music/queue');
const { stopQueue } = require('../commands/music/stop');
const logger = require('../utils/logger');

const SKIP_MS = 10_000;

/** Handles every button / menu on the now-playing panel (custom ids starting with "np:"). */
module.exports = {
    prefix: 'np:',

    async execute(interaction) {
        const action = interaction.customId.slice(this.prefix.length);

        if (!panel.isActive(interaction.guildId, interaction.message.id)) {
            await fail(interaction, 'stalePanel');
            await interaction.message.edit({ components: [] }).catch(() => null);
            return;
        }

        const queue = await requireActiveQueue(interaction, { needsTrack: action !== 'stop' });
        if (!queue) return;

        switch (action) {
            case 'queue':
                return showQueue(interaction, { ephemeral: true });

            case 'prev': {
                if (!queue.history.previousTrack) return fail(interaction, 'noPrevious');
                await interaction.deferUpdate();
                // Starting the previous track posts a fresh panel via the playerStart event.
                return queue.history.previous().catch((error) => logger.error('Previous track failed', error));
            }

            case 'next':
                await interaction.deferUpdate();
                queue.node.skip(); // playerStart / emptyQueue replace this panel
                return;

            case 'stop': {
                const count = stopQueue(queue);
                return interaction.reply({
                    embeds: [render(modeOf(interaction.user), 'stopped', { count, user: interaction.user.username })],
                });
            }

            case 'toggle':
                if (queue.node.isPaused()) queue.node.resume();
                else queue.node.pause();
                break;

            case 'loop':
                cycleLoop(queue);
                break;

            case 'rw':
            case 'ff':
            case 'seek': {
                // Seeking restarts the stream, which can take longer than Discord's 3s reply window.
                await interaction.deferUpdate();
                const errorKey =
                    action === 'seek'
                        ? await seekTo(queue, Number(interaction.values[0]))
                        : await seekBy(queue, action === 'ff' ? SKIP_MS : -SKIP_MS);
                if (errorKey) {
                    const total = queue.node.getTimestamp()?.total.value;
                    await fail(interaction, errorKey, { total: formatMs(total) });
                }
                return panel.refresh(interaction.guildId);
            }

            default:
                return;
        }

        // toggle / loop: acknowledge by redrawing the panel.
        await interaction.deferUpdate();
        return panel.refresh(interaction.guildId);
    },
};
