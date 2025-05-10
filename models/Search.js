const mongoose = require('mongoose');

const searchSchema = new mongoose.Schema({
  city: String,
  lat: Number,
  lon: Number,
  weather: Object
}, { timestamps: true });

module.exports = mongoose.model('Search', searchSchema);
