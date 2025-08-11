const fs = require('fs');
const path = require('path');
const axios = require('axios');

const TOKENS_FILE = path.join(__dirname, '..', 'tokens.json');

function getAccessToken() {
  try {
    if (!fs.existsSync(TOKENS_FILE)) {
      throw new Error('Tokens file not found. Please authenticate first.');
    }

    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    
    if (!tokens.access_token) {
      throw new Error('No access token found. Please authenticate first.');
    }

    return tokens.access_token;
  } catch (error) {
    console.error('Error getting access token:', error.message);
    throw error;
  }
}

function refreshAccessToken() {
  try {
    if (!fs.existsSync(TOKENS_FILE)) {
      throw new Error('Tokens file not found. Please authenticate first.');
    }

    const tokens = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    
    if (!tokens.refresh_token) {
      throw new Error('No refresh token found. Please authenticate first.');
    }

    // This would typically make a request to Spotify to refresh the token
    // For now, we'll just return the existing access token
    return tokens.access_token;
  } catch (error) {
    console.error('Error refreshing access token:', error.message);
    throw error;
  }
}

module.exports = {
  getAccessToken,
  refreshAccessToken
};
