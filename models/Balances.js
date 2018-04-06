const mongoose = require("mongoose")

const shem = new mongoose.Schema({
  provider: String,
  pairs: Object
})
module.exports = mongoose.model("Balances", shem)
