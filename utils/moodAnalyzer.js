const axios = require('axios');
const { getAccessToken } = require('./tokenManager');

// Mood categories based on Spotify audio features
const MOOD_CATEGORIES = {
  energetic: {
    name: 'Energetic Vibes',
    description: 'High energy, upbeat tracks',
    conditions: {
      energy: { min: 0.7, max: 1.0 },
      valence: { min: 0.6, max: 1.0 },
      danceability: { min: 0.6, max: 1.0 }
    }
  },
  chill: {
    name: 'Chill & Relaxed',
    description: 'Calm, peaceful tracks',
    conditions: {
      energy: { min: 0.0, max: 0.4 },
      valence: { min: 0.3, max: 0.7 },
      acousticness: { min: 0.5, max: 1.0 }
    }
  },
  happy: {
    name: 'Happy & Upbeat',
    description: 'Joyful, positive tracks',
    conditions: {
      valence: { min: 0.7, max: 1.0 },
      energy: { min: 0.5, max: 1.0 },
      danceability: { min: 0.5, max: 1.0 }
    }
  },
  sad: {
    name: 'Melancholic',
    description: 'Sad, emotional tracks',
    conditions: {
      valence: { min: 0.0, max: 0.3 },
      energy: { min: 0.0, max: 0.5 },
      acousticness: { min: 0.3, max: 1.0 }
    }
  },
  party: {
    name: 'Party Mode',
    description: 'High energy party tracks',
    conditions: {
      energy: { min: 0.8, max: 1.0 },
      danceability: { min: 0.7, max: 1.0 },
      loudness: { min: -10, max: 0 }
    }
  },
  focus: {
    name: 'Focus & Study',
    description: 'Instrumental, concentration-friendly',
    conditions: {
      instrumentalness: { min: 0.5, max: 1.0 },
      energy: { min: 0.2, max: 0.6 },
      speechiness: { min: 0.0, max: 0.1 }
    }
  }
};

class MoodAnalyzer {
  constructor() {
    this.playlistCache = new Map();
  }

  // Get audio features for a track
  async getAudioFeatures(trackId, accessToken) {
    try {
      const response = await axios.get(
        `https://api.spotify.com/v1/audio-features/${trackId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      return response.data;
    } catch (error) {
      console.error(`❌ Error getting audio features for ${trackId}:`, error.message);
      return null;
    }
  }

  // Analyze mood based on audio features
  analyzeMood(audioFeatures) {
    if (!audioFeatures) return null;

    const scores = {};

    // Calculate score for each mood category
    for (const [mood, config] of Object.entries(MOOD_CATEGORIES)) {
      let score = 0;
      let totalConditions = 0;

      for (const [feature, range] of Object.entries(config.conditions)) {
        const value = audioFeatures[feature];
        if (value !== undefined) {
          totalConditions++;
          if (value >= range.min && value <= range.max) {
            score += 1;
          } else {
            // Partial score for close matches
            const distance = Math.min(
              Math.abs(value - range.min),
              Math.abs(value - range.max)
            );
            if (distance < 0.2) {
              score += 0.5;
            }
          }
        }
      }

      scores[mood] = totalConditions > 0 ? score / totalConditions : 0;
    }

    // Find the mood with highest score
    const bestMood = Object.entries(scores).reduce((a, b) => 
      scores[a[0]] > scores[b[0]] ? a : b
    );

    return bestMood[1] > 0.5 ? bestMood[0] : 'mixed';
  }

  // Get or create playlist for a mood
  async getOrCreatePlaylist(mood, accessToken) {
    const moodConfig = MOOD_CATEGORIES[mood];
    if (!moodConfig) {
      console.warn(`⚠️ Unknown mood: ${mood}`);
      return null;
    }

    // Check cache first
    if (this.playlistCache.has(mood)) {
      return this.playlistCache.get(mood);
    }

    try {
      // First, try to find existing playlist
      const searchResponse = await axios.get(
        `https://api.spotify.com/v1/me/playlists?limit=50`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );

      const existingPlaylist = searchResponse.data.items.find(
        playlist => playlist.name === moodConfig.name
      );

      if (existingPlaylist) {
        this.playlistCache.set(mood, existingPlaylist.id);
        return existingPlaylist.id;
      }

      // Playlist creation disabled in console-only mode
      return null;

    } catch (error) {
      console.error(`❌ Error getting/creating playlist for ${mood}:`, error.message);
      return null;
    }
  }

  // Add track to mood-based playlist
  async addToMoodPlaylist(trackId, mood, accessToken) {
    // Disabled
    return false;
  }

  // Analyze and categorize a track
  async analyzeAndCategorize(trackId, accessToken) {
    const audioFeatures = await this.getAudioFeatures(trackId, accessToken);
    const mood = this.analyzeMood(audioFeatures);
    
    // Do not add to playlists; just return mood info
    if (mood && mood !== 'mixed') {
      return { mood, audioFeatures };
    }
    return { mood: 'mixed', audioFeatures };
  }

  // Get all mood playlists
  async getMoodPlaylists(accessToken) {
    const playlists = {};
    
    for (const mood of Object.keys(MOOD_CATEGORIES)) {
      const playlistId = await this.getOrCreatePlaylist(mood, accessToken);
      if (playlistId) {
        playlists[mood] = {
          id: playlistId,
          name: MOOD_CATEGORIES[mood].name,
          description: MOOD_CATEGORIES[mood].description
        };
      }
    }
    
    return playlists;
  }
}

module.exports = { MoodAnalyzer, MOOD_CATEGORIES };
