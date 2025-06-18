require('dotenv').config();

const isDev = process.env.NODE_ENV !== 'production';

module.exports = {
  PORT: process.env.PORT || 3000,
  GEMINI_API_KEY: isDev ? process.env.GEMINI_API_KEY_DEV : process.env.GEMINI_API_KEY,
  CONTEXT_PATH: __dirname + '/data/',
  HISTORY_PATH: __dirname + '/data/history/',
  isDev,
};