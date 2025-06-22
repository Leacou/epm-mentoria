const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/proxy-avatar', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing url');
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.send(response.data);
  } catch (err) {
    res.status(500).send('Error fetching image');
  }
});

module.exports = router;