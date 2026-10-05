const { createStore } = require('./jsonStore');

const LIMITS = {
    playlistsPerUser: 25, // Discord autocomplete shows at most 25 choices
    tracksPerPlaylist: 500,
    nameLength: 32,
};

const store = createStore('playlists.json', { users: {} });

/** Error with a code that commands translate into a user-facing message. */
class PlaylistError extends Error {
    constructor(code, vars = {}) {
        super(code);
        this.code = code;
        this.vars = vars;
    }
}

function normalizeName(raw) {
    const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
    if (!name || name.length > LIMITS.nameLength) {
        throw new PlaylistError('plNameInvalid', { max: LIMITS.nameLength });
    }
    return name;
}

const keyOf = (name) => name.toLowerCase();
const userBucket = (userId) => (store.data.users[userId] ??= {});

function list(userId) {
    return Object.values(store.data.users[userId] ?? {}).sort((a, b) => a.name.localeCompare(b.name));
}

function get(userId, rawName) {
    const name = normalizeName(rawName);
    const playlist = store.data.users[userId]?.[keyOf(name)];
    if (!playlist) throw new PlaylistError('plNotFound', { name });
    return playlist;
}

function exists(userId, rawName) {
    try {
        return Boolean(get(userId, rawName));
    } catch {
        return false;
    }
}

function create(userId, rawName) {
    const name = normalizeName(rawName);
    const bucket = userBucket(userId);
    if (bucket[keyOf(name)]) throw new PlaylistError('plExists', { name });
    if (Object.keys(bucket).length >= LIMITS.playlistsPerUser) {
        throw new PlaylistError('plLimit', { max: LIMITS.playlistsPerUser });
    }
    const now = Date.now();
    const playlist = { name, createdAt: now, updatedAt: now, tracks: [] };
    bucket[keyOf(name)] = playlist;
    store.save();
    return playlist;
}

function remove(userId, rawName) {
    const playlist = get(userId, rawName);
    delete store.data.users[userId][keyOf(playlist.name)];
    store.save();
    return playlist;
}

function rename(userId, rawName, rawNewName) {
    const playlist = get(userId, rawName);
    const newName = normalizeName(rawNewName);
    const bucket = userBucket(userId);
    if (keyOf(newName) !== keyOf(playlist.name) && bucket[keyOf(newName)]) {
        throw new PlaylistError('plExists', { name: newName });
    }
    const oldName = playlist.name;
    delete bucket[keyOf(oldName)];
    playlist.name = newName;
    playlist.updatedAt = Date.now();
    bucket[keyOf(newName)] = playlist;
    store.save();
    return { oldName, playlist };
}

/**
 * Appends serialized tracks. Tracks beyond the size limit are dropped.
 * Returns how many were added and how many didn't fit.
 */
function addTracks(userId, rawName, tracks) {
    const playlist = get(userId, rawName);
    const room = LIMITS.tracksPerPlaylist - playlist.tracks.length;
    if (room <= 0) throw new PlaylistError('plFull', { name: playlist.name, max: LIMITS.tracksPerPlaylist });

    const accepted = tracks.slice(0, room);
    playlist.tracks.push(...accepted);
    playlist.updatedAt = Date.now();
    store.save();
    return { playlist, added: accepted.length, skipped: tracks.length - accepted.length };
}

/** Removes the track at a 1-based position. */
function removeTrack(userId, rawName, position) {
    const playlist = get(userId, rawName);
    if (!Number.isInteger(position) || position < 1 || position > playlist.tracks.length) {
        throw new PlaylistError('plBadIndex', { name: playlist.name, max: playlist.tracks.length });
    }
    const [removed] = playlist.tracks.splice(position - 1, 1);
    playlist.updatedAt = Date.now();
    store.save();
    return { playlist, removed };
}

/** Converts a discord-player Track into a compact JSON-safe record. */
function serializeTrack(track) {
    // Drop per-session data (requester, raw extractor metadata) — it's large and not needed to replay.
    return { ...track.serialize(), requested_by: null, metadata: null };
}

module.exports = {
    LIMITS,
    PlaylistError,
    list,
    get,
    exists,
    create,
    remove,
    rename,
    addTracks,
    removeTrack,
    serializeTrack,
};
