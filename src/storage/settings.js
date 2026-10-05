const { createStore } = require('./jsonStore');

const MODES = ['normal', 'tech'];
const DEFAULT_MODE = 'normal';

const store = createStore('settings.json', { users: {} });

/** Returns the user's display style: "normal" (plain words) or "tech" (hacker terminal). */
function getMode(userId) {
    const mode = store.data.users[userId]?.mode;
    return MODES.includes(mode) ? mode : DEFAULT_MODE;
}

function setMode(userId, mode) {
    if (!MODES.includes(mode)) throw new Error(`Unknown mode "${mode}"`);
    store.data.users[userId] = { ...store.data.users[userId], mode };
    store.save();
}

module.exports = { MODES, getMode, setMode };
