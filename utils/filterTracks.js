const fs = require('fs');
const path = require('path');

const PLAY_COUNTS_FILE = path.join(__dirname, '..', 'data', 'playCounts.json');
const PLAYED_TRACKS_FILE = path.join(__dirname, '..', 'data', 'playedTracks.json');

function filterFrequentTracks(threshold = 5, days = 3) {
  if (!fs.existsSync(PLAY_COUNTS_FILE) || !fs.existsSync(PLAYED_TRACKS_FILE)) return [];

  const countsData = JSON.parse(fs.readFileSync(PLAY_COUNTS_FILE, 'utf8'));
  const playedData = JSON.parse(fs.readFileSync(PLAYED_TRACKS_FILE, 'utf8'));

  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  const trackDetailsMap = {};

  // Build a reference map of track details (name, artist)
  playedData.forEach(play => {
    if (!trackDetailsMap[play.track_id]) {
      trackDetailsMap[play.track_id] = {
        track_name: play.track_name,
        artist: play.artist
      };
    }
  });

  const frequentTracks = [];

  for (const [track_id, info] of Object.entries(countsData)) {
    if (info.count > threshold && info.lastPlayed > cutoffTime) {
      frequentTracks.push({
        track_id,
        track_name: trackDetailsMap[track_id]?.track_name || 'Unknown',
        artist: trackDetailsMap[track_id]?.artist || 'Unknown',
        count: info.count
      });
    }
  }

  return frequentTracks;
}

module.exports = { filterFrequentTracks };
