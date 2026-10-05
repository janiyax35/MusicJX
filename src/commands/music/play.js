const { SlashCommandBuilder } = require('discord.js');
const { baseEmbed, readout, clip, linkLabel, hexId, ICONS, COLORS } = require('../../utils/theme');
const { requireVoice, requireVoicePermissions, fail } = require('../../utils/guards');
const { render, modeOf } = require('../../ui/text');
const { searchTracks, nodeOptions } = require('../../player/search');
const logger = require('../../utils/logger');

function addedEmbed(mode, { result, track, queue, user }) {
    const playlist = result.playlist;
    const playingNow = queue.currentTrack?.id === track.id;

    if (mode === 'tech') {
        return playlist
            ? baseEmbed('tech', {
                  title: `${ICONS.disk} [ PAYLOAD_INJECTED ]`,
                  description: [
                      `**Playlist decrypted →** [${linkLabel(playlist.title)}](${playlist.url})`,
                      readout([
                          ['PACKETS', `${result.tracks.length} track(s) loaded into buffer`],
                          ['SOURCE', String(playlist.source || 'unknown').toUpperCase()],
                          ['OPERATOR', user.username],
                          ['PACKET_ID', hexId()],
                      ]),
                  ].join('\n'),
              })
            : baseEmbed('tech', {
                  title: `${ICONS.disk} [ PACKET_INJECTED ]`,
                  description: [
                      `**Track queued →** [${linkLabel(track.title)}](${track.url})`,
                      readout([
                          ['ORIGIN', clip(track.author, 40)],
                          ['RUNTIME', track.duration || 'LIVE'],
                          ['POSITION', playingNow ? 'NOW STREAMING' : `#${queue.tracks.size} in buffer`],
                          ['OPERATOR', user.username],
                      ]),
                  ].join('\n'),
              });
    }

    if (playlist) {
        return baseEmbed('normal', {
            color: COLORS.GREEN,
            title: '📁 Playlist added',
            description: `Added **${result.tracks.length} songs** from **[${linkLabel(playlist.title)}](${playlist.url})** to the queue.`,
        });
    }
    return baseEmbed('normal', {
        color: COLORS.GREEN,
        title: playingNow ? '▶️ Playing now' : '➕ Added to queue',
        description:
            `**[${linkLabel(track.title)}](${track.url})**\nby ${clip(track.author, 60)} · \`${track.duration || 'LIVE'}\`` +
            (playingNow ? '' : `\n\nPosition in queue: **#${queue.tracks.size}**`),
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or playlist from YouTube, Spotify or SoundCloud (name or link).')
        .addStringOption((option) =>
            option.setName('query').setDescription('Song name, or a song / playlist link').setRequired(true).setMaxLength(500),
        ),

    async execute(interaction) {
        const player = interaction.client.player;
        const mode = modeOf(interaction.user);
        const query = interaction.options.getString('query', true).trim();

        const channel = await requireVoice(interaction);
        if (!channel) return;
        if (!(await requireVoicePermissions(interaction, channel))) return;

        // Searching can take a few seconds — acknowledge within Discord's 3s window.
        await interaction.deferReply();
        await interaction.editReply({ embeds: [render(mode, 'searching', { query })] });

        let result;
        try {
            result = await searchTracks(player, query, interaction.user);
        } catch (error) {
            logger.error(`Search failed for "${query}"`, error);
            return fail(interaction, 'searchFailed');
        }

        if (!result?.hasTracks()) return fail(interaction, 'notFound', { query });

        let track;
        let queue;
        try {
            ({ track, queue } = await player.play(channel, result, { nodeOptions: nodeOptions(interaction) }));
        } catch (error) {
            logger.error(`Playback failed for "${query}"`, error);
            return fail(interaction, 'playFailed');
        }

        const embed = addedEmbed(mode, { result, track, queue, user: interaction.user });
        const thumb = result.playlist?.thumbnail || track?.thumbnail;
        if (thumb) embed.setThumbnail(thumb);

        return interaction.editReply({ embeds: [embed] });
    },
};
