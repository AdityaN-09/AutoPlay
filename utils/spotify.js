const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const playCountPath = path.join(__dirname, '../data/playCounts.json');

const playedTracksPath = path.join(__dirname, '../data/playedTracks.json');

function logPlayedTrack(track) {
  const entry = {
    track_id: track.track.id,
    track_name: track.track.name,
    artist: track.track.artists.map(a => a.name).join(', '),
    played_at: Date.now()
  };

  let history = [];

  try {
    history = JSON.parse(fs.readFileSync(playedTracksPath));
  } catch (err) {
    history = [];
  }

  history.push(entry);
  fs.writeFileSync(playedTracksPath, JSON.stringify(history, null, 2));
}


// Load play count data
function loadPlayCounts() {
  try {
    const data = fs.readFileSync(playCountPath);
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

// Save play count data
function savePlayCounts(playCounts) {
  fs.writeFileSync(playCountPath, JSON.stringify(playCounts, null, 2));
}

// Add track to playlist
async function addToPlaylist(trackUri, access_token) {
  try {
    await axios.post(
      `https://api.spotify.com/v1/playlists/${process.env.SPOTIFY_PLAYLIST_ID}/tracks`,
      { uris: [trackUri] },
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    console.log('📤 Trying to add to playlist:', trackUri);

    console.log(`✅ Added to playlist: ${trackUri}`);
  } catch (err) {
    console.error(`❌ Error adding to playlist: ${err.response?.data?.error?.message}`);
  }
}

// Update play count and check if threshold passed
async function handleTrack(track, access_token) {
  const playCounts = loadPlayCounts();

  const trackData = track.track || track;  // fallback

  if (!trackData || !trackData.id || !trackData.uri) {
    console.warn('⚠️ Skipping invalid track object:', JSON.stringify(track));
    return;
  }

  const trackId = trackData.id;
  const trackUri = `spotify:track:${trackId}`; // safer format

  console.log(`🎵 Processing track: ${trackData.name} by ${trackData.artists?.map(a => a.name).join(', ')}`);
  console.log(`📤 URI to add: ${trackUri}`);

  // Update play counts
  if (!playCounts[trackId]) {
    playCounts[trackId] = { count: 1, lastPlayed: Date.now() };
  } else {
    playCounts[trackId].count++;
    playCounts[trackId].lastPlayed = Date.now();
  }

  // Threshold check
  if (playCounts[trackId].count === 5) {
    await addToPlaylist(trackUri, access_token);
  }

  savePlayCounts(playCounts);
}


module.exports = {
  handleTrack,
  logPlayedTrack
};
