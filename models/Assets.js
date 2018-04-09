const mongoose = require("mongoose")
require("colors")

const shem = new mongoose.Schema({
  exchange: String,
  name: String,
  amount: String,
  amountBtc: String,
  free: String
})

shem.methods.display = function() {
  console.log(this.name.magenta)
  console.log("amount\t".green, "\t" + this.amount.grey)
  console.log("amount BTC".green, "\t" + this.amountBtc.grey)
  console.log("--------------\n")
}

module.exports = mongoose.model("Assets", shem)
