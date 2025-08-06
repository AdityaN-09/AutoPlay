const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'playedTracks.json');

function filterFrequentTracks(threshold = 5, days = 3) {
  if (!fs.existsSync(DATA_FILE)) return [];

  const rawData = fs.readFileSync(DATA_FILE, 'utf8');
  const allPlays = JSON.parse(rawData);

  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);

  const trackCountMap = {};

  allPlays.forEach(play => {
    if (play.played_at > cutoffTime) {
      if (!trackCountMap[play.track_id]) {
        trackCountMap[play.track_id] = {
          count: 1,
          track_name: play.track_name,
          artist: play.artist
        };
      } else {
        trackCountMap[play.track_id].count++;
      }
    }
  });

  const frequentTracks = Object.entries(trackCountMap)
    .filter(([_, info]) => info.count > threshold)
    .map(([track_id, info]) => ({
      track_id,
      track_name: info.track_name,
      artist: info.artist,
      count: info.count
    }));

  return frequentTracks;
}

module.exports = { filterFrequentTracks };
