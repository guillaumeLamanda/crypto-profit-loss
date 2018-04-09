const mongoose = require("mongoose")
require("colors")

const shem = new mongoose.Schema({
  exchange: String,
  exchangePct: String,
  name: String,
  amount: String,
  amountBtc: String,
  free: String,
  pourcentage: String
})

shem.methods.display = function() {
  console.log(this.name.magenta)
  console.log("amount\t\t".green, "\t" + this.amount.grey)
  console.log("amount BTC\t".green, "\t" + this.amountBtc.grey)
  console.log("pct BTC\t\t".green, "\t" + this.pourcentage.grey)
  console.log(`pct ${this.exchange} BTC\t`.green, "\t" + this.exchangePct.grey)
  console.log("\n-----------------------------\n")
}

module.exports = mongoose.model("Assets", shem)
