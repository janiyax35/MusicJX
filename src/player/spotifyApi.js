// Minimal Spotify Web API client (client-credentials flow) used for /search.
// Spotify no longer hands out anonymous tokens, so search needs a free app from
// https://developer.spotify.com/dashboard — set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env.

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SEARCH_URL = 'https://api.spotify.com/v1/search';

let cachedToken = null; // { value, expiresAt }

function isConfigured() {
    return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

async function getToken() {
    if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;

    const key = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { Authorization: `Basic ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Spotify token request failed (HTTP ${res.status}) — check SPOTIFY_CLIENT_ID / SECRET`);

    const body = await res.json();
    cachedToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return cachedToken.value;
}

/** Searches Spotify tracks. Returns plain objects; they're turned into playable tracks only when picked. */
async function searchTracks(query, limit = 10) {
    const token = await getToken();
    const url = `${SEARCH_URL}?${new URLSearchParams({ q: query, type: 'track', limit: String(limit) })}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    if (res.status === 401) cachedToken = null;
    if (!res.ok) throw new Error(`Spotify search failed (HTTP ${res.status})`);

    const body = await res.json();
    return (body.tracks?.items ?? []).map((item) => ({
        title: item.name,
        author: item.artists.map((a) => a.name).join(', '),
        durationMS: item.duration_ms,
        url: item.external_urls?.spotify ?? `https://open.spotify.com/track/${item.id}`,
        thumbnail: item.album?.images?.[0]?.url ?? null,
    }));
}

module.exports = { isConfigured, searchTracks };
