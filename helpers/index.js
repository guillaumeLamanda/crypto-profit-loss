const mongoose = require("../models")
const ClosedOrder = mongoose.model("ClosedOrder")
const Assets = mongoose.model("Assets")
const conf = require("../conf")
const ccxt = require("ccxt")
const program = require("commander")
const _ = require("lodash")
const BigNumber = require("bignumber.js")

module.exports = {
  update: function(exchanges) {
    return Promise.all(
      exchanges.map(exchange => {
        const client = this.getClient(exchange)
        return client
          .fetch_balance()
          .then(balances => {
            return this.updateBalance(exchange, balances, client)
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
                            return this.updateTrades(
                              exchange,
                              trades,
                              pair
                            ).catch(err => console.log(err.message.red))
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
            console.log(`unable to fetch balance ${err.message}`)
            return new Error(err)
          })
      })
    ).catch(err => {
      console.log("exchange err".red, err.message)
    })
  },

  calculate: function(exchanges, pair) {
    let resume = {}
    return Promise.all(
      exchanges.map(exchange => {
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
                return Assets.findOne({
                  name: assetName,
                  exchange: res.exchange
                })
                  .then(asset => {
                    if (!asset)
                      throw Error(
                        assetName + " balance does not exist on " + res.exchange
                      )
                    res.balance = asset.amount
                    res.equivalentBtc = asset.amountBtc
                    this.display(res)
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
  },

  balance: function(exchanges) {
    let query = { $or: [] }
    exchanges.map(exchange => query.$or.push({ exchange: exchange }))
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
            return this.getEquivalent(
              this.getClient(exchange),
              "BTC",
              "USDT",
              res[exchange].totalbtc
            )
              .then(usd => {
                if (!usd) {
                  return this.getEquivalent(
                    this.getClient(exchange),
                    "BTC",
                    "USD",
                    res[exchange].totalbtc
                  )
                    .then(usd => {
                      res[exchange].totalusd = usd
                      return this.displayExchange(res, exchange)
                    })
                    .catch(err => err.message.red)
                } else {
                  res[exchange].totalusd = usd
                  return this.displayExchange(res, exchange)
                }
              })
              .catch(err => err.message.red)
          })
        ).then(() => {
          return this.getEquivalent(
            this.getClient("binance"),
            "BTC",
            "USDT",
            res.totalbtc.toString()
          ).then(usd => {
            console.log("\ntotal BTC\t\t".blue, res.totalbtc.toString().blue)
            console.log("total USDT\t\t".blue, usd.toString().blue)
          })
        })
      })
      .catch(err => {
        console.log(`calculate error ${err.message} `.red)
      })
  },

  getClient: function(exchange) {
    const ex = ccxt[exchange]
    const client = new ex({
      apiKey: conf[exchange].key,
      secret: conf[exchange].secret
    })
    return client
  },

  getExchanges: function(val) {
    let exchanges = []
    if (val) exchanges = val.split(",")
    else {
      const keys = Object.keys(conf)
      keys.map(key => {
        if (conf[key].key && conf[key].secret) exchanges.push(key)
      })
    }
    return exchanges
  },

  getEquivalent: async function(client, asset, base, amount) {
    const pair = asset + "/" + base
    const fiat = ["USD", "USDT", "EUR"]
    if (asset === base) return Promise.resolve(amount)
    if (!client.symbols) {
      await client.load_markets()
    }
    if (client.symbols.includes(pair))
      return client
        .fetch_ticker(pair)
        .then(ticker => {
          return BigNumber(ticker.close)
            .multipliedBy(amount.toString())
            .toString()
        })
        .catch(err => {
          console.log(err.message.red)
        })
    else {
      if (fiat.includes(asset)) {
        // turn pair
        const pair2 = pair
          .split("/")
          .reverse()
          .join("/")
        return client
          .fetch_ticker(pair2)
          .then(ticker => {
            return BigNumber(amount)
              .dividedBy(ticker.close)
              .toString()
          })
          .catch(err => {
            console.log(err.message.red)
          })
      }
    }
  },
  updateTrades: function(exchange, trades, pair) {
    return Promise.all(
      trades.map(trade => {
        return ClosedOrder.findOne({
          timestamp: trade.timestamp,
          symbol: pair
        })
          .then(dataTrade => {
            const obj = Object.assign({}, trade, {
              exchange: exchange,
              cost: trade.cost || trade.info.cost
            })
            if (!dataTrade)
              return ClosedOrder.create(obj).then(dataTrade => {
                dataTrade.save()
                return dataTrade
              })
            else {
              if (obj === dataTrade) return dataTrade
              else return dataTrade.update(obj)
            }
          })
          .catch(err => {
            throw err
          })
      })
    )
  },

  updateBalance: function(exchange, balances, client) {
    const notAssets = ["info", "free", "used", "total"]
    return Promise.all(
      _.map(balances, (content, asset) => {
        if (notAssets.includes(asset)) return
        if ((!content.free || !content.total) && content.free !== 0) return
        let obj = {
          exchange: exchange,
          name: asset,
          amount: content.total.toString(),
          available: content.free.toString(),
          amountBtc: "0"
        }
        return this.getEquivalent(client, asset, "BTC", content.total)
          .then(eq => {
            if (eq) obj.amountBtc = eq
            return Assets.findOne({ exchange: exchange, name: asset }).then(
              asset => {
                if (!asset) return Assets.create(obj)
                else return asset.update(obj)
              }
            )
          })
          .catch(err => {
            console.log(`Unable to get btc equivalent ${err.message}`.red)
          })
      })
    ).catch(err => {
      console.log(err.message.red)
    })
  },

  getBalance: function(asset, exchange) {
    return Assets.findOne({ exchange: exchange, name: asset }).then(asset => {
      return asset.amount
    })
  },

  display: function(resume) {
    console.log(resume.pair.magenta)

    if (!program.positive && !program.negative)
      console.log(
        "profit/loss ".green,
        `\t\t${resume.profit}`.grey,
        `\nbalance `.green,
        `\t\t${resume.balance}`.grey,
        `\nequivalent btc `.green,
        `\t${resume.equivalentBtc}\n`.grey,
        "\n-----------------------\n"
      )
    else if (program.positive && resume.profit > 0)
      console.log(
        "profit/loss ".green,
        `\t\t${resume.profit}`.grey,
        `\nbalance `.green,
        `\t\t${resume.balance}`.grey,
        `\nequivalent btc `.green,
        `\t${resume.equivalentBtc}\n`.grey,
        "\n-----------------------\n"
      )
    else if (program.negative && resume.profit < 0)
      console.log(
        "profit/loss ".green,
        `\t\t${resume.profit}`.grey,
        `\nbalance `.green,
        `\t\t${resume.balance}`.grey,
        `\nequivalent btc `.green,
        `\t${resume.equivalentBtc}\n`.grey,
        "\n-----------------------\n"
      )
  },

  displayExchange: function(res, exchange) {
    console.log(`${exchange}`.yellow)
    console.log(`total BTC\t`.blue, res[exchange].totalbtc.toString().blue)
    console.log(`total USDT\t`.blue, res[exchange].totalusd.toString().blue)
    console.log("-------------")
  }
}
