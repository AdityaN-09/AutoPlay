const { filterFrequentTracks } = require('./filterTracks');

function displayFrequentTracks(threshold = 5) {
  const frequentTracks = filterFrequentTracks(threshold);

  if (!frequentTracks || frequentTracks.length === 0) {
    console.log('ℹ️ No tracks met the frequency threshold.');
    return;
  }

  console.log(`🎯 Frequent Tracks (${frequentTracks.length}):`);
  for (const track of frequentTracks) {
    const trackName = track.track_name || 'Unknown';
    const artistName = track.artist || 'Unknown';
    const count = typeof track.count === 'number' ? track.count : 0;
    console.log(`🎵 ${trackName} - ${artistName} (played ${count} times)`);
  }
}

module.exports = { displayFrequentTracks };


