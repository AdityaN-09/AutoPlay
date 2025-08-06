const fs = require('fs');
const path = require('path');

const TRACK_LOG_FILE = path.join(__dirname, '../data/track_log.json');

function loadTrackLog() {
    if (!fs.existsSync(TRACK_LOG_FILE)) return [];
    return JSON.parse(fs.readFileSync(TRACK_LOG_FILE));
}

function saveTrackLog(log) {
    fs.writeFileSync(TRACK_LOG_FILE, JSON.stringify(log, null, 2));
}

function logTrack(track) {
    const logs = loadTrackLog();

    const existing = logs.find(item => item.id === track.id);
    const timestamp = new Date().toISOString();

    if (existing) {
        existing.frequency += 1;
        existing.timestamps.push(timestamp);
    } else {
        logs.push({
            id: track.id,
            name: track.name,
            artist: track.artist,
            frequency: 1,
            timestamps: [timestamp],
        });
    }

    saveTrackLog(logs);
}

module.exports = {
    logTrack,
    loadTrackLog
};
