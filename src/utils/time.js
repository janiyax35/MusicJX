/** Formats milliseconds as m:ss or h:mm:ss. */
function formatMs(ms) {
    const total = Math.max(0, Math.floor((ms || 0) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/**
 * Parses user input like "90", "1:30" or "1:02:03" into milliseconds.
 * Returns null when the input isn't a valid time.
 */
function parseTime(input) {
    const parts = String(input ?? '').trim().split(':');
    if (!parts.length || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;

    const nums = parts.map(Number);
    // Every part after the first is a 0–59 field.
    if (nums.slice(1).some((n) => n > 59)) return null;
    return nums.reduce((total, n) => total * 60 + n, 0) * 1000;
}

module.exports = { formatMs, parseTime };
