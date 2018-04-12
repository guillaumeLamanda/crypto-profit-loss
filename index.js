require("colors")
const BigNumber = require("bignumber.js")
const program = require("commander")
const helpers = require("./helpers")

BigNumber.config({ DECIMAL_PLACES: 20 })

program
  .version("0.0.1")
  .option("update", "Update trades database")
  .option("calculate", "Calculate profit/loss")
  .option("balance", "Show current balance")
  .option("-p --pair <p>", "Define pair to calculate")
  .option(
    "-e --exchanges <exchanges>",
    "exchanges to call",
    helpers.getExchanges,
    helpers.getExchanges()
  )
  .option("--positive", "Show positive only")
  .option("--negative", "Show negative only")
  .parse(process.argv)

if (program.update)
  helpers.update(program.exchanges).then(() => {
    if (program.calculate)
      helpers.calculate(program.exchanges).then(() => process.exit())
    else process.exit()
  })
else if (program.calculate)
  helpers.calculate(program.exchanges, program.pair).then(() => process.exit())
else if (program.balance)
  helpers.balance(program.exchanges).then(() => process.exit())
else {
  program.outputHelp()
  process.exit(1)
}
