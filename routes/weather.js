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
  const city = req.body.city ? req.body.city.trim() : '';
  if (!city) return res.status(400).send('City required');

  try {
    // Get weather from WeatherAPI.com
    const apiKey = process.env.WEATHER_API_KEY;
    const weatherResp = await axios.get('http://api.weatherapi.com/v1/current.json', {
      params: {
        key: apiKey,
        q: city
      }
    });
    const weatherData = weatherResp.data;
    const lat = weatherData.location.lat;
    const lon = weatherData.location.lon;

    // Save search to MongoDB
    const search = new Search({ city, lat, lon, weather: weatherData });
    await search.save();

    // Show result
    res.json({ city, lat, lon, weather: weatherData });
  } catch (err) {
    console.error("API error:", err.response ? err.response.data : err.message);
    res.status(500).send('Error fetching weather: ' + (err.response?.data?.error?.message || err.message));
  }
});

// Get recent searches
router.get('/recent', async (req, res) => {
  const recent = await Search.find().sort({ createdAt: -1 }).limit(5);
  res.json(recent);
});

module.exports = router;
