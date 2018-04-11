const mongoose = require("../models")
const ClosedOrder = mongoose.model("ClosedOrder")
const Assets = mongoose.model("Assets")
const conf = require("../conf")
const ccxt = require("ccxt")
const program = require("commander")
const _ = require("lodash")
const BigNumber = require("bignumber.js")

module.exports = {
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
