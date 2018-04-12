const colors = require("colors")
const _ = require("lodash")
const mongoose = require("./models")
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
  .option(
    "-e --exchanges <exchanges>",
    "exchanges to call",
    helpers.getExchanges,
    helpers.getExchanges()
  )
  .option("--positive", "Show positive only")
  .option("--negative", "Show negative only")
  .parse(process.argv)

function update() {
  return Promise.all(
    program.exchanges.map(exchange => {
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
                    return new Promise(
                      resolve => setTimeout(resolve, 3000) // Wait 1s
                    ).then(() => {
                      return client
                        .fetchMyTrades(pair)
                        .then(trades => {
                          if (trades.length > 0)
                            console.log(
                              `${exchange.yellow} - ${pair.green} : ${
                                trades.length
                              } trades`
                            )
                          return helpers
                            .updateTrades(exchange, trades, pair)
                            .catch(err => console.log(err.message.red))
                        })
                        .catch(err => console.log(err.message.red))
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
          return new Error(err)
        })
    })
  ).catch(err => {
    console.log("exchange err".red, err.message)
  })
}

function calculate(pair) {
  let resume = {}
  return Promise.all(
    program.exchanges.map(exchange => {
      return ClosedOrder.find({ exchange: exchange }).then(orders => {
        orders.sort()
        const grouped = _.groupBy(orders, "symbol")
        let keys
        if (pair) {
          keys = [pair]
        } else {
          keys = Object.keys(grouped)
        }

        return Promise.all(
          keys.map(key => {
            const orders = _.sortBy(grouped[key], "timestamp")

            let res = {
              pair: key,
              exchange: exchange,
              nb: 0,
              profit: BigNumber(0),
              loss: BigNumber(0)
            }
            orders.map(order => {
              if (!order.cost)
                throw Error(`order ${order._id} on ${res.pair} have no cost`)
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
                  if (!asset)
                    throw Error(
                      assetName + " balance does not exist on " + res.exchange
                    )
                  res.balance = asset.amount
                  res.equivalentBtc = asset.amountBtc
                  helpers.display(res)
                })
                .catch(err => {
                  console.log(err.message.red)
                })
          })
        )
      })
    })
  )
    .then((/* array */) => {
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
    .catch(err => console.log(err.message.red))
}

function balance() {
  let query = { $or: [] }
  program.exchanges.map(exchange => query.$or.push({ exchange: exchange }))
  return Assets.find(query)
    .then(assets => {
      let res = {
        totalbtc: BigNumber(0),
        totalusd: BigNumber(0)
      }

      program.exchanges.map(exchange => {
        res[exchange] = {}
        res[exchange].totalbtc = BigNumber(0)
        res[exchange].totalusd = BigNumber(0)
      })

      _.map(assets, asset => {
        res.totalbtc = res.totalbtc.plus(asset.amountBtc)
        res[asset.exchange].totalbtc = res[asset.exchange].totalbtc.plus(
          asset.amountBtc
        )
      })

      assets = _.groupBy(assets, "exchange")

      _.map(assets, (assets, exchange) => {
        console.log(`-------------- ${exchange} --------------\n`.yellow)
        assets = _.sortBy(assets, "name")
        _.map(assets, asset => {
          asset.pourcentage = BigNumber(asset.amountBtc)
            .dividedBy(res.totalbtc)
            .multipliedBy(100)
          if (asset.exchange)
            asset.exchangePct = BigNumber(asset.amountBtc)
              .dividedBy(res[asset.exchange].totalbtc.toString())
              .multipliedBy(100)
          if (parseInt(asset.pourcentage) > 1) asset.display(1)
          return asset.save()
        })
      })

      return Promise.all(
        program.exchanges.map(exchange => {
          return helpers
            .getEquivalent(
              helpers.getClient(exchange),
              "BTC",
              "USDT",
              res[exchange].totalbtc
            )
            .then(usd => {
              if (!usd) {
                return helpers
                  .getEquivalent(
                    helpers.getClient(exchange),
                    "BTC",
                    "USD",
                    res[exchange].totalbtc
                  )
                  .then(usd => {
                    res[exchange].totalusd = usd
                    return helpers.displayExchange(res, exchange)
                  })
                  .catch(err => err.message.red)
              } else {
                res[exchange].totalusd = usd
                return helpers.displayExchange(res, exchange)
              }
            })
            .catch(err => err.message.red)
        })
      ).then(() => {
        return helpers
          .getEquivalent(
            helpers.getClient("binance"),
            "BTC",
            "USDT",
            res.totalbtc.toString()
          )
          .then(usd => {
            console.log("\ntotal BTC\t\t".blue, res.totalbtc.toString().blue)
            console.log("total USDT\t\t".blue, usd.toString().blue)
          })
      })
    })
    .catch(err => {
      console.log(`calculate error ${err.message} `.red)
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
