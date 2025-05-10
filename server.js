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
  const city = req.body.city;
  if (!city) return res.status(400).render('error', { message: 'City required' });
  try {
    // 1. Get coordinates from OpenWeatherMap Geocoding API
    const geoResp = await axios.get(`https://api.openweathermap.org/geo/1.0/direct`, {
      params: {
        q: city,
        limit: 1,
        appid: process.env.OWM_API_KEY
      }
    });
    if (!geoResp.data.length) return res.status(404).render('error', { message: 'City not found' });
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
    const record = { city, lat, lon, weather: weatherResp.data, createdAt: new Date() };
    if (searchCol) await searchCol.insertOne(record);

    // 4. Show result
    res.render('result', { city, lat, lon, weather: weatherResp.data });
  } catch (err) {
    res.status(500).render('error', { message: 'Error fetching weather' });
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
