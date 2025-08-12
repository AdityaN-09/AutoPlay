const { handleTrack } = require('./utils/spotify');
const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const { getAccessToken } = require('./utils/tokenManager');

require('dotenv').config();

const PORT = process.env.PORT || 8888;

// Serve static files from public directory
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is live at http://localhost:${PORT}`);
});

const querystring = require('querystring');
const axios = require('axios');

// ✅ Global variables to hold tokens (in-memory for now)
let access_token = null;
let refresh_token = null;

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URI;

// 1. LOGIN ROUTE
app.get('/login', (req, res) => {
  const scope = 'user-top-read playlist-modify-public playlist-modify-private user-read-currently-playing user-read-playback-state user-read-recently-played';
  const auth_url = 'https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri
    });

  res.redirect(auth_url);
});

// 2. CALLBACK ROUTE
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;

  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: querystring.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
      }
    });

    // ✅ Save tokens in global variables
    access_token = response.data.access_token;
    refresh_token = response.data.refresh_token;

    // ✅ Save tokens to tokens.json
    const tokenPath = path.join(__dirname, 'tokens.json');
    fs.writeFileSync(tokenPath, JSON.stringify({
      access_token,
      refresh_token,
      timestamp: Date.now()
    }, null, 2));

    res.send('✅ Tokens saved to tokens.json. You can now call /recent.');
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send('Error getting tokens');
  }
});

// 3. RECENTLY PLAYED ROUTE
app.get('/recent', async (req, res) => {
  try {
    // Use tokenManager to get fresh access token
    const access_token = await getAccessToken();

    // Fetch recent tracks
    const recentResponse = await axios.get(
      'https://api.spotify.com/v1/me/player/recently-played?limit=10',
      {
        headers: { Authorization: `Bearer ${access_token}` }
      }
    );

    const tracks = recentResponse.data.items;

    if (!tracks || tracks.length === 0) {
      return res.status(204).send('No recent tracks found. Play some music and try again.');
    }

    // Import logPlayedTrack from utils/spotify.js
    const { logPlayedTrack } = require('./utils/spotify');
    
    // Process all tracks
     for (const item of tracks) {
      logPlayedTrack(item);
      await handleTrack(item, access_token);
    }

    res.send(`✅ Processed ${tracks.length} recently played tracks.`);

  } catch (err) {
    console.error('Error in /recent:', err.response?.data || err.message);
    return res.status(500).send('Failed to fetch recently played tracks.');
  }
});

// 3b. CURRENTLY PLAYING ROUTE
app.get('/currently-playing', async (req, res) => {
  try {
    // Use tokenManager to get fresh access token
    const access_token = await getAccessToken();

    // Import getCurrentlyPlaying from utils/spotify.js
    const { getCurrentlyPlaying } = require('./utils/spotify');
    
    const currentTrack = await getCurrentlyPlaying(access_token);
    res.json(currentTrack);

  } catch (err) {
    console.error('Error in /currently-playing:', err.message);
    
    // Check if it's an authentication error
    if (err.message.includes('authenticate') || err.message.includes('token')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please visit /login to authenticate with Spotify',
        action: 'login'
      });
    }
    
    return res.status(500).json({
      error: 'Failed to fetch currently playing track',
      message: err.message
    });
  }
});

// Reset and refresh track data endpoint
app.get('/reset-tracks', async (req, res) => {
  try {
    const fs = require('fs');
    const playCountsPath = path.join(__dirname, 'data/playCounts.json');
    const playedTracksPath = path.join(__dirname, 'data/playedTracks.json');
    
    // Clear old data files
    if (fs.existsSync(playCountsPath)) {
      fs.unlinkSync(playCountsPath);
      console.log('🗑️ Cleared old play counts');
    }
    if (fs.existsSync(playedTracksPath)) {
      fs.unlinkSync(playedTracksPath);
      console.log('🗑️ Cleared old played tracks');
    }
    
    // Re-fetch recent tracks with proper names
    const access_token = await getAccessToken();
    const { logPlayedTrack, handleTrack } = require('./utils/spotify');
    
    const recentResponse = await axios.get(
      'https://api.spotify.com/v1/me/player/recently-played?limit=50',
      {
        headers: { Authorization: `Bearer ${access_token}` }
      }
    );

    const tracks = recentResponse.data.items;
    
    if (tracks && tracks.length > 0) {
      for (const item of tracks) {
        logPlayedTrack(item);
        await handleTrack(item, access_token);
      }
      console.log(`✅ Re-processed ${tracks.length} tracks with proper names`);
    }
    
    res.send(`✅ Track data reset and refreshed! Processed ${tracks?.length || 0} tracks with proper names.`);
    
  } catch (error) {
    console.error('Error resetting tracks:', error);
    res.status(500).send('Failed to reset track data');
  }
});

// Debug endpoint to check token and environment status
app.get('/debug', (req, res) => {
  try {
    const fs = require('fs');
    const tokenPath = path.join(__dirname, 'tokens.json');
    
    let tokenInfo = 'No tokens file found';
    let envInfo = {
      SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ? 'Set' : 'Not set',
      SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET ? 'Set' : 'Not set',
      REDIRECT_URI: process.env.REDIRECT_URI ? 'Set' : 'Not set'
    };
    
    if (fs.existsSync(tokenPath)) {
      const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
      const tokenAge = Date.now() - (tokens.timestamp || 0);
      const tokenExpiry = 3600000; // 1 hour
      
      tokenInfo = {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        tokenAge: `${Math.round(tokenAge / 1000)} seconds`,
        isExpired: tokenAge > tokenExpiry,
        timestamp: tokens.timestamp ? new Date(tokens.timestamp).toISOString() : 'None'
      };
    }
    
    res.json({
      timestamp: new Date().toISOString(),
      environment: envInfo,
      tokens: tokenInfo
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Debug endpoint failed',
      message: error.message
    });
  }
});

// filter working or not
const { filterFrequentTracks } = require('./utils/filterTracks');

app.get('/frequent', (req, res) => {
  const frequent = filterFrequentTracks(); // default: >5 in 3 days
  res.json(frequent);
});

// 4. SHOW FREQUENT ROUTE - Display frequent tracks in console
app.get('/show-frequent', async (req, res) => {
  try {
    const { displayFrequentTracks } = require('./utils/displayFrequentTracks');
    displayFrequentTracks(5);
    res.send('Displayed frequent tracks in console');
  } catch (error) {
    console.error('Error in show-frequent:', error);
    res.status(500).send('Failed to display frequent tracks.');
  }
});

// 4b. Mood auto-add disabled as part of refactor to console-only output
// app.get('/mood-auto-add', async (req, res) => {
//   try {
//     const { MoodAutoAdd } = require('./utils/moodAutoAdd');
//     const moodAutoAdd = new MoodAutoAdd();
//     await moodAutoAdd.run();
//     res.send('✅ Mood-based auto-add process completed. Check console for details.');
//   } catch (error) {
//     console.error('Error in mood-auto-add:', error);
//     res.status(500).send('Failed to run mood-based auto-add process.');
//   }
// });

// 5. ANALYTICS ROUTE - Get play statistics
app.get('/analytics', (req, res) => {
  try {
    const frequent = filterFrequentTracks();
    const fs = require('fs');
    const playCountsPath = path.join(__dirname, 'data/playCounts.json');
    const playedTracksPath = path.join(__dirname, 'data/playedTracks.json');
    
    const playCounts = JSON.parse(fs.readFileSync(playCountsPath, 'utf8'));
    const playedTracks = JSON.parse(fs.readFileSync(playedTracksPath, 'utf8'));
    
    const analytics = {
      totalTracksPlayed: Object.keys(playCounts).length,
      totalPlayEvents: playedTracks.length,
      frequentTracks: frequent,
      topTracks: Object.entries(playCounts)
        .sort(([,a], [,b]) => b.count - a.count)
        .slice(0, 10)
        .map(([id, data]) => ({
          track_id: id,
          count: data.count,
          lastPlayed: data.lastPlayed
        }))
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).send('Failed to get analytics.');
  }
});

// 5b. MOOD ANALYTICS ROUTE - Removed as auto-add feature is not needed
// This route was for mood-based playlist statistics, but we're focusing only on frequent tracks display

// 6. SCHEDULER ROUTES
const AutoPlayScheduler = require('./utils/scheduler');
const scheduler = new AutoPlayScheduler();

app.get('/scheduler/start', (req, res) => {
  const interval = parseInt(req.query.interval) || 30; // default 30 minutes
  scheduler.start(interval);
  res.send(`✅ Scheduler started (runs every ${interval} minutes)`);
});

app.get('/scheduler/stop', (req, res) => {
  scheduler.stop();
  res.send('⏹️ Scheduler stopped');
});

app.get('/scheduler/status', (req, res) => {
  res.json(scheduler.getStatus());
});

app.get('/scheduler/run-now', async (req, res) => {
  try {
    await scheduler.fetchAndProcessRecentTracks();
    res.send('✅ Manual run completed');
  } catch (error) {
    res.status(500).send('Failed to run manual task');
  }
});
