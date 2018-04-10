const mongoose = require("mongoose")

const shem = new mongoose.Schema({
  exchange: String,
  timestamp: Number,
  amount: Number,
  cost: Number,
  symbol: String,
  side: String,
  id: String,
  price: Number,
  datetime: String,
  fee: Object
})
module.exports = mongoose.model("ClosedOrder", shem)
