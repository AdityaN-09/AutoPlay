const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const TOKENS_FILE = path.join(__dirname, '..', 'tokens.json');
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;

async function getAccessToken() {
  try {
    if (!fs.existsSync(TOKENS_FILE)) {
      throw new Error('Tokens file not found. Please authenticate first.');
    }

    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    
    if (!tokens.access_token) {
      throw new Error('No access token found. Please authenticate first.');
    }

    // Check if token is expired (tokens typically last 1 hour)
    const tokenAge = Date.now() - (tokens.timestamp || 0);
    const tokenExpiry = 3600000; // 1 hour in milliseconds
    
    if (tokenAge > tokenExpiry) {
      console.log('🔄 Access token expired, refreshing...');
      return await refreshAccessToken();
    }

    return tokens.access_token;
  } catch (error) {
    console.error('Error getting access token:', error.message);
    throw error;
  }
}

async function refreshAccessToken() {
  try {
    if (!fs.existsSync(TOKENS_FILE)) {
      throw new Error('Tokens file not found. Please authenticate first.');
    }

    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    
    if (!tokens.refresh_token) {
      throw new Error('No refresh token found. Please authenticate first.');
    }

    // Make request to Spotify to refresh the token
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(client_id + ':' + client_secret).toString('base64')
      }
    });

    // Update tokens with new access token
    const newTokens = {
      ...tokens,
      access_token: response.data.access_token,
      timestamp: Date.now()
    };

    // Save updated tokens
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(newTokens, null, 2));
    
    console.log('✅ Access token refreshed successfully');
    return newTokens.access_token;

  } catch (error) {
    console.error('Error refreshing access token:', error.response?.data || error.message);
    
    // If refresh fails, remove the tokens file to force re-authentication
    if (fs.existsSync(TOKENS_FILE)) {
      fs.unlinkSync(TOKENS_FILE);
      console.log('🗑️ Removed expired tokens file. Please re-authenticate.');
    }
    
    throw new Error('Failed to refresh access token. Please re-authenticate.');
  }
}

module.exports = {
  getAccessToken,
  refreshAccessToken
};
