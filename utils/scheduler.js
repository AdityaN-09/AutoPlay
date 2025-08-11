const { getAccessToken } = require('./tokenManager');
const { handleTrack, logPlayedTrack } = require('./spotify');
// Auto-add disabled
const axios = require('axios');

class AutoPlayScheduler {
  constructor() {
    this.isRunning = false;
    this.interval = null;
  }

  async fetchAndProcessRecentTracks() {
    try {
      console.log('🔄 Fetching recent tracks...');
      const accessToken = await getAccessToken();
      
      const response = await axios.get(
        'https://api.spotify.com/v1/me/player/recently-played?limit=20',
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      const tracks = response.data.items;
      
      if (!tracks || tracks.length === 0) {
        console.log('ℹ️ No recent tracks found.');
        return;
      }

      console.log(`📊 Processing ${tracks.length} recent tracks...`);
      
      for (const item of tracks) {
        logPlayedTrack(item);
        await handleTrack(item, accessToken);
      }

      console.log('✅ Recent tracks processed successfully.');
      
    } catch (error) {
      console.error('❌ Error in scheduled task:', error.message);
    }
  }

  async runAutoAdd() {
    // Disabled
  }

  start(intervalMinutes = 30) {
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running.');
      return;
    }

    console.log(`🚀 Starting AutoPlay scheduler (runs every ${intervalMinutes} minutes)`);
    this.isRunning = true;

    // Run immediately
    this.fetchAndProcessRecentTracks();

    // Then schedule regular runs
    this.interval = setInterval(() => {
      this.fetchAndProcessRecentTracks();
    }, intervalMinutes * 60 * 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('⏹️ AutoPlay scheduler stopped.');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      interval: this.interval ? 'active' : 'inactive'
    };
  }
}

module.exports = AutoPlayScheduler;
