const { QueryType, QueryResolver } = require('discord-player');
const { YoutubeExtractor } = require('discord-player-youtubei');

/**
 * Searches every registered source for a query or URL.
 *
 * The YouTube extractor claims Spotify/Apple Music URLs but returns nothing for them,
 * so it's skipped at search time for those links; playback still bridges them to YouTube audio.
 */
function searchTracks(player, query, user) {
    const { type } = QueryResolver.resolve(query);
    const blockExtractors = /^(spotify|appleMusic)/.test(type) ? [YoutubeExtractor.identifier] : [];

    return player.search(query, {
        requestedBy: user,
        searchEngine: QueryType.AUTO,
        blockExtractors,
    });
}

/** Queue settings shared by everything that starts playback (/play, /playlist play). */
function nodeOptions(interaction) {
    return {
        metadata: { channel: interaction.channel, requestedBy: interaction.user },
        volume: 80,
        selfDeaf: true,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 30_000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 60_000,
        leaveOnStop: true,
        pauseOnEmpty: true,
        bufferingTimeout: 15_000,
        connectionTimeout: 30_000,
    };
}

module.exports = { searchTracks, nodeOptions };
