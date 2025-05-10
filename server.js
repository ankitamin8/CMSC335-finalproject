// Main Express server setup
require('dotenv').config();
const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));

const dbClient = new MongoClient(process.env.MONGO_CONNECTION_STRING);
let dbConn, searchCol;

// Home page: show form and recent searches
app.get('/', async (req, res) => {
  let recent = [];
  try {
    if (searchCol) {
      recent = await searchCol.find().sort({ createdAt: -1 }).limit(5).toArray();
    }
  } catch (e) {}
  res.render('index', { recent });
});

// Handle form submission
app.post('/weather', async (req, res) => {
  const city = req.body.city ? req.body.city.trim() : '';
  if (!city) return res.status(400).render('error', { message: 'City required' });
  try {
    // 1. Get weather from WeatherAPI.com
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

    // 2. Save search to MongoDB
    const record = { city, lat, lon, weather: weatherData, createdAt: new Date() };
    if (searchCol) await searchCol.insertOne(record);

    // 3. Show result
    res.render('result', { city, lat, lon, weather: weatherData });
  } catch (err) {
    // Log detailed error for debugging
    console.error("API error:", err.response ? err.response.data : err.message);
    res.status(500).render('error', { message: 'Error fetching weather: ' + (err.response?.data?.error?.message || err.message) });
  }
});

// Get recent searches (AJAX endpoint)
app.get('/recent', async (req, res) => {
  let recent = [];
  try {
    if (searchCol) {
      recent = await searchCol.find().sort({ createdAt: -1 }).limit(5).toArray();
    }
  } catch (e) {}
  res.json(recent);
});

// Start server and connect to MongoDB
start().catch(err => {
  console.error('Failed to start server:', err);
});

async function start() {
  await dbClient.connect();
  dbConn = dbClient.db(process.env.MONGO_DB_NAME);
  searchCol = dbConn.collection(process.env.MONGO_COLLECTION);
  const server = app.listen(PORT, () => {
    console.log(`Web server started and running at http://localhost:${PORT}`);
    console.log('Stop to shutdown the server:');
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.on('line', async (input) => {
      if (input.trim().toLowerCase() === 'stop') {
        console.log('Shutting Down Server');
        await dbClient.close();
        server.close(() => process.exit(0));
        rl.close();
        
      }
    });
  });
}
