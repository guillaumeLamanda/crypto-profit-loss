const colors = require("colors")
const _ = require("lodash")
const mongoose = require("./models")
const exchanges = ["binance"]
const ClosedOrder = mongoose.model("ClosedOrder")
const Assets = mongoose.model("Assets")
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
  .option("--positive", "Show positive only")
  .option("--negative", "Show negative only")
  .parse(process.argv)

function update() {
  return Promise.all(
    exchanges.map(exchange => {
      const client = helpers.getClient(exchange)
      return client
        .fetch_balance()
        .then(balances => {
          return helpers
            .updateBalance(exchange, balances, client)
            .then(() => {
              return Promise.all(
                client.symbols.map(pair => {
                  const asset = balances[pair.split("/")[0]]
                  if (asset && asset.total > 0) {
                    return client.fetchMyTrades(pair).then(trades => {
                      if (trades.length > 0)
                        console.log(`${pair} : ${trades.length} trades`)
                      return helpers
                        .updateTrades(trades, pair)
                        .catch(err => console.log(err))
                    })
                  }
                })
              )
            })
            .catch(err => {
              console.log("Unable to update balance".red, err.message)
              throw new Error(err)
            })
        })
        .catch(err => {
          console.log(colors.red("unable to fetch balance"), err.message)
          throw new Error(err)
        })
    })
  ).catch(err => {
    console.log("exchange err".red, err.message)
    throw new Error(err)
  })
}

function calculate(pair) {
  return ClosedOrder.find().then(orders => {
    orders.sort()
    const grouped = _.groupBy(orders, "symbol")
    let keys
    if (pair) {
      keys = [pair]
    } else {
      keys = Object.keys(grouped)
    }

    let resume = {}

    return Promise.all(
      keys.map(key => {
        const orders = _.sortBy(grouped[key], "timestamp")

        let res = {
          pair: key,
          exchange: "binance",
          nb: 0,
          profit: BigNumber(0),
          loss: BigNumber(0)
        }
        orders.map(order => {
          if (order.side === "buy")
            res.loss = res.loss.plus(order.cost.toString())

          if (order.side === "sell")
            res.profit = res.profit.plus(order.cost.toString())
        })
        res.profit = res.profit.minus(res.loss).toString()
        resume[res.pair] = res

        const assetName = res.pair.split("/")[0]
        if (assetName)
          return Assets.findOne({ name: assetName, exchange: res.exchange })
            .then(asset => {
              if (!asset) throw Error(assetName + " balance does not exist")
              res.balance = asset.amount
              res.equivalentBtc = asset.amountBtc
              helpers.display(res)
            })
            .catch(err => {
              console.log(err.message.red)
            })
      })
    ).then(() => {
      let paired = _.groupBy(resume, item => {
        if (item.pair.includes("/BTC")) return "BTC"
        else if (item.pair.includes("/USDT")) return "USDT"
        else if (item.pair.includes("/ETH")) return "ETH"
      })
      let btcprofit = BigNumber(0)
      let usdtprofit = BigNumber(0)
      let ethprofit = BigNumber(0)

      paired.BTC &&
        paired.BTC.map(btcitem => {
          btcprofit = btcprofit.plus(btcitem.profit)
        })
      paired.USDT &&
        paired.USDT.map(btcitem => {
          usdtprofit = usdtprofit.plus(btcitem.profit)
        })
      paired.ETH &&
        paired.ETH.map(btcitem => {
          ethprofit = ethprofit.plus(btcitem.profit)
        })
      console.log(
        "BTC".blue,
        btcprofit.toString() + "\n",
        "ETH".blue,
        ethprofit.toString() + "\n",
        "USDT".blue,
        usdtprofit.toString()
      )
    })
  })
}

function balance() {
  return Assets.find().then(assets => {
    let res = {
      totalbtc: new BigNumber(0)
    }
    _.map(assets, asset => {
      asset.display()

      res.totalbtc = res.totalbtc.plus(asset.amountBtc)
    })
    console.log("total BTC".blue, res.totalbtc.toString().blue)
  })
}

if (program.update)
  update().then(() => {
    if (program.calculate) calculate().then(() => process.exit())
    else process.exit()
  })
else if (program.calculate) calculate(program.pair).then(() => process.exit())
else if (program.balance) balance(program.pair).then(() => process.exit())
else {
  program.outputHelp()
  process.exit(1)
}
