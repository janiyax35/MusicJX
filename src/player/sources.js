const { QueryType } = require('discord-player');
const { YoutubeExtractor } = require('discord-player-youtubei');
const spotify = require('./spotifyApi');
const { searchTracks } = require('./search');
const { formatMs } = require('../utils/time');
const logger = require('../utils/logger');

/**
 * Music sites /search can look through.
 * (Apple Music is not listed: its search page scraping currently returns nothing.)
 */
const SOURCES = [
    { id: 'youtube', label: 'YouTube', emoji: '🔴', available: () => true },
    { id: 'spotify', label: 'Spotify', emoji: '🟢', available: spotify.isConfigured },
    { id: 'soundcloud', label: 'SoundCloud', emoji: '🟠', available: () => true },
    { id: 'all', label: 'All sources', emoji: '🌐', available: () => true },
];

const MAX_RESULTS = 10;
// How many results each site contributes to an "All sources" search.
const ALL_SPLIT = { youtube: 4, spotify: 3, soundcloud: 3 };

/** Normalised search result. `track` is set when it's already playable. */
function fromTrack(track, source) {
    return {
        title: track.title,
        author: track.author,
        duration: track.duration || 'LIVE',
        url: track.url,
        thumbnail: track.thumbnail,
        source,
        track,
    };
}

async function searchPlayer(player, query, user, engine, source, limit) {
    const result = await player.search(query, {
        requestedBy: user,
        searchEngine: engine,
        fallbackSearchEngine: engine,
        // The YouTube extractor answers every search type; keep it out of non-YouTube searches.
        blockExtractors: source === 'youtube' ? [] : [YoutubeExtractor.identifier],
    });
    return result.tracks.slice(0, limit).map((track) => fromTrack(track, source));
}

async function searchSpotify(query, limit) {
    const items = await spotify.searchTracks(query, limit);
    return items.map((item) => ({ ...item, duration: formatMs(item.durationMS), source: 'spotify', track: null }));
}

function searchOne(player, sourceId, query, user, limit) {
    if (sourceId === 'youtube') return searchPlayer(player, query, user, QueryType.YOUTUBE_SEARCH, 'youtube', limit);
    if (sourceId === 'soundcloud') return searchPlayer(player, query, user, QueryType.SOUNDCLOUD_SEARCH, 'soundcloud', limit);
    if (sourceId === 'spotify') return searchSpotify(query, limit);
    throw new Error(`Unknown source "${sourceId}"`);
}

/** Searches one site, or every available site for "all". */
async function searchSource(player, sourceId, query, user) {
    if (sourceId !== 'all') return searchOne(player, sourceId, query, user, MAX_RESULTS);

    const ids = Object.keys(ALL_SPLIT).filter((id) => SOURCES.find((s) => s.id === id).available());
    const settled = await Promise.allSettled(ids.map((id) => searchOne(player, id, query, user, ALL_SPLIT[id])));
    settled.forEach((r, i) => {
        if (r.status === 'rejected') logger.warn(`${ids[i]} search failed: ${r.reason?.message ?? r.reason}`);
    });
    if (settled.every((r) => r.status === 'rejected')) throw settled[0].reason;
    return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).slice(0, MAX_RESULTS);
}

/** Turns a search result into a playable discord-player Track. */
async function resolveTrack(player, result, user) {
    if (result.track) return result.track;
    const found = await searchTracks(player, result.url, user);
    return found.tracks[0] ?? null;
}

const sourceById = (id) => SOURCES.find((s) => s.id === id);

module.exports = { SOURCES, sourceById, searchSource, resolveTrack };
