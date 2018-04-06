const mongoose = require("../models")
const ClosedOrder = mongoose.model("ClosedOrder")
const Balances = mongoose.model("Balances")
const conf = require("../conf")
const ccxt = require("ccxt")
const program = require("commander")

module.exports = {
  getClient: function(exchange) {
    const ex = ccxt[exchange]
    const client = new ex({
      apiKey: conf[exchange].key,
      secret: conf[exchange].secret
    })
    return client
  },

  getEquivalent: function(client, pair, amount) {
    return client.fetch_ticker(pair).then(ticker => {
      return ticker.close * amount
    })
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

  updateBalance: function(exchange, balances) {
    return Balances.findOne({ provider: exchange })
      .then(balance => {
        if (!balance) {
          return Balances.create({
            provider: exchange,
            pairs: balances
          })
        } else
          return balance.update({
            pairs: balances
          })
      })
      .catch(err => {
        throw err
      })
  },

  getBalance: function(asset, exchange) {
    return Balances.findOne({ provider: exchange }).then(balance => {
      return balance.pairs[asset].total
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
        `\t${resume.equivalentBtc}`.grey
      )
    else if (program.positive && resume.profit > 0)
      console.log(
        "profit/loss ".green,
        `\t${resume.pair}`.green,
        `\t${resume.profit}`.grey
      )
    else if (program.negative && resume.profit < 0)
      console.log(
        "profit/loss ".green,
        `\t${resume.pair}`.green,
        `\t${resume.profit}`.grey
      )
  }
}
