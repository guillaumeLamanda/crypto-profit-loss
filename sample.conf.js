var c = (module.exports = {})

/**
 * You can basically add any exchange supported by ccxt : https://github.com/ccxt/ccxt/wiki/Manual#exchanges
 *
 * Just follow the structure. For exemple, for the exchange "exemple", add :
 * c.exemple = {}
 * c.exemple.key = "THE API KEY"
 * c.exemple.secret = "THE API SECRET"
 */

c.kraken = {}
c.kraken.key = "KRAKEN API KEY"
c.kraken.secret = "KRAKEN SECRET"
// Please read API TOS on https://www.kraken.com/u/settings/api
c.kraken.tosagree = "disagree"

c.binance = {}
c.binance.key = "BINANCE API KEY"
c.binance.secret = "BINANCE SECRET"

c.kucoin = {}
c.kucoin.key = "API KEY"
c.kucoin.secret = "SECRET"

c.cryptopia = {}
c.cryptopia.key = "API KEY"
c.cryptopia.secret = "SECRET"
