const { filterFrequentTracks } = require('./utils/filterTracks');

const frequentTracks = filterFrequentTracks(3, 3); // threshold = 3 plays in last 3 days

console.log("🎵 Frequent Tracks:\n", frequentTracks);
