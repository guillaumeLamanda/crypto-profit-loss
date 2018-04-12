const fs = require("fs")
const path = require("path")
const basename = path.basename(__filename)
require("colors")

const mongoose = require("mongoose")
mongoose.connect("mongodb://localhost/crypto").catch(err => {
  console.log(err.message.red)
  console.log("This program need a mongo database".yellow)
  process.exit(1)
})

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf(".") !== 0 && file !== basename && file.slice(-3) === ".js"
    )
  })
  .forEach(file => {
    require(path.join(__dirname, file))
  })

module.exports = mongoose
