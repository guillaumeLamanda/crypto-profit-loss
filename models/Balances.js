const mongoose = require("mongoose")

const shem = new mongoose.Schema({
  exchange: String,
  assets: Object
})
module.exports = mongoose.model("Balances", shem)
