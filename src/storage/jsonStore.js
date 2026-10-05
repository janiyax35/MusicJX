const fs = require('node:fs');
const path = require('node:path');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SAVE_DELAY_MS = 250;

/**
 * Tiny JSON-file store. Data lives in memory; writes are debounced and
 * atomic (write temp file, then rename) so a crash can't corrupt the file.
 */
class JsonStore {
    constructor(fileName, fallback) {
        this.file = path.join(DATA_DIR, fileName);
        this.fallback = fallback;
        this.timer = null;
        this.data = this.#load();
    }

    #load() {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        try {
            return JSON.parse(fs.readFileSync(this.file, 'utf8'));
        } catch (error) {
            if (error.code === 'ENOENT') return structuredClone(this.fallback);

            // Unreadable file — keep a copy for manual recovery and start fresh.
            const backup = `${this.file}.corrupt-${Date.now()}`;
            try {
                fs.copyFileSync(this.file, backup);
            } catch {
                // Nothing to back up.
            }
            logger.error(`Could not read ${path.basename(this.file)} — backed up to ${path.basename(backup)}`, error);
            return structuredClone(this.fallback);
        }
    }

    /** Schedules a write; many changes in a row become a single write. */
    save() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
    }

    /** Writes immediately (used on shutdown). */
    flush() {
        clearTimeout(this.timer);
        this.timer = null;
        const tmp = `${this.file}.tmp`;
        try {
            fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
            fs.renameSync(tmp, this.file);
        } catch (error) {
            logger.error(`Failed to save ${path.basename(this.file)}`, error);
        }
    }
}

const stores = new Set();

function createStore(fileName, fallback) {
    const store = new JsonStore(fileName, fallback);
    stores.add(store);
    return store;
}

/** Flushes every pending write — call before the process exits. */
function flushAll() {
    for (const store of stores) if (store.timer) store.flush();
}

module.exports = { createStore, flushAll };
