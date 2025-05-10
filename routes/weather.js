const express = require('express');
const axios = require('axios');
const Search = require('../models/Search');
const router = express.Router();

// Home page: show form and recent searches
router.get('/', async (req, res) => {
  res.sendFile('index.html', { root: './public' });
});

// Handle form submission
router.post('/weather', async (req, res) => {
  const city = req.body.city;
  if (!city) return res.status(400).send('City required');

  try {
    // 1. Get coordinates from OpenWeatherMap Geocoding API
    const geoResp = await axios.get(`https://api.openweathermap.org/geo/1.0/direct`, {
      params: {
        q: city,
        limit: 1,
        appid: process.env.OWM_API_KEY
      }
    });
    if (!geoResp.data.length) return res.status(404).send('City not found');
    const { lat, lon } = geoResp.data[0];

    // 2. Get weather from One Call API
    const weatherResp = await axios.get('https://api.openweathermap.org/data/3.0/onecall', {
      params: {
        lat,
        lon,
        units: 'metric',
        appid: process.env.OWM_API_KEY
      }
    });

    // 3. Save search to MongoDB
    const search = new Search({ city, lat, lon, weather: weatherResp.data });
    await search.save();

    // 4. Show result
    res.json({ city, lat, lon, weather: weatherResp.data });
  } catch (err) {
    res.status(500).send('Error fetching weather');
  }
});

// Get recent searches
router.get('/recent', async (req, res) => {
  const recent = await Search.find().sort({ createdAt: -1 }).limit(5);
  res.json(recent);
});

module.exports = router;
