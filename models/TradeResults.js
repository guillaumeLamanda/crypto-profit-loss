const mongoose = require("mongoose")

const shem = new mongoose.Schema({
  symbol: String,
  exchange: String,
  profitBtc: Number,
  profitUsd: Number,
  updatedAt: Date
})

shem.pre("save", function(next) {
  this.updatedAt = new Date()
  next()
})

module.exports = mongoose.model("TradeResult", shem)
