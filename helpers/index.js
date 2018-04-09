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

  getEquivalent: function(client, asset, amount) {
    const pair = asset + "/BTC"
    const fiat = ["USD", "USDT", "EUR"]
    if (asset === "BTC") return Promise.resolve(amount)

    if (client.symbols.includes(pair))
      return client
        .fetch_ticker(pair)
        .then(ticker => {
          return BigNumber(ticker.close)
            .multipliedBy(amount)
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
      } else
        return Promise.reject(Error(asset + " does not have pair with btc"))
    }
  },

  updateTrades: function(trades, pair) {
    return Promise.all(
      trades.map(trade => {
        return ClosedOrder.findOne({
          timestamp: trade.timestamp,
          symbol: pair
        })
          .then(dataTrade => {
            if (!dataTrade)
              return ClosedOrder.create(trade).then(dataTrade => {
                dataTrade.save()
                return dataTrade
              })
            else return dataTrade
          })
          .catch(err => {
            throw err
            return err
          })
      })
    )
  },

  updateBalance: function(exchange, balances, client) {
    const notAssets = ["info", "free", "used", "total"]
    return Promise.all(
      _.map(balances, (content, asset) => {
        if (notAssets.includes(asset) || content.total === 0) return
        let obj = {
          exchange: exchange,
          name: asset,
          amount: content.total.toString(),
          available: content.free.toString(),
          amountBtc: ""
        }
        return this.getEquivalent(client, asset, content.total)
          .then(eq => {
            obj.amountBtc = eq
            return Assets.findOne({ exchange: exchange, name: asset }).then(
              asset => {
                if (!asset) return Assets.create(obj)
                else return asset.update(obj)
              }
            )
          })
          .catch(err => {
            console.log("Unable to get btc equivalent".red)
            console.log(err)
          })
      })
    ).catch(err => {
      console.log(err)
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
        `\t${resume.profit}`.grey,
        `\nbalance `.green,
        `\t${resume.balance}`.grey,
        `\nequivalent btc `.green,
        `\t${resume.equivalentBtc}`.grey,
        "\n-----------------------\n"
      )
    else if (program.positive && resume.profit > 0)
      console.log(
        "profit/loss ".green,
        `\t${resume.profit}`.grey,
        `\nbalance `.green,
        `\t${resume.balance}`.grey,
        `\nequivalent btc `.green,
        `\t${resume.equivalentBtc}`.grey,
        "\n-----------------------\n"
      )
    else if (program.negative && resume.profit < 0)
      console.log(
        "profit/loss ".green,
        `\t${resume.profit}`.grey,
        `\nbalance `.green,
        `\t${resume.balance}`.grey,
        `\nequivalent btc `.green,
        `\t${resume.equivalentBtc}`.grey,
        "\n-----------------------\n"
      )
  }
}
