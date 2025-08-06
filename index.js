const { handleTrack } = require('./utils/spotify');
const express = require('express');
const app = express();
const fs = require('fs');
const tokens = JSON.parse(fs.readFileSync('tokens.json', 'utf8'));
const path = require('path');

require('dotenv').config();

const PORT = process.env.PORT || 8888;

app.get('/', (req, res) => {
  res.send('AutoPlay server is running!');
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
  const scope = 'user-top-read playlist-modify-public playlist-modify-private';
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
      refresh_token
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
    if (!tokens.refresh_token) {
      return res.status(401).send('Refresh token not found in tokens.json. Please log in at /login.');
    }

    // Refresh token
    const tokenResponse = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
      }
    });

    access_token = tokenResponse.data.access_token;

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

    // Process all tracks
    await Promise.all(tracks.map(item => handleTrack(item, access_token)));

    return res.json(tracks);

  } catch (err) {
    console.error('Error in /recent:', err.response?.data || err.message);
    return res.status(500).send('Failed to fetch recently played tracks.');
  }
});



// filter working or not
const { filterFrequentTracks } = require('./utils/filterTracks');

app.get('/frequent', (req, res) => {
  const frequent = filterFrequentTracks(); // default: >5 in 3 days
  res.json(frequent);
});
