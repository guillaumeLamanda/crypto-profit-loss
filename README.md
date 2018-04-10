# Crypto profit/loss

This programm fetch exchanges api, get your trades/balance and calculate prfit/loss of each pair.  
This bot work with any exchange supported by [ccxt](https://github.com/ccxt/ccxt/wiki/Manual#exchanges)

## Before
Copy `sample.conf.js` to `conf.js` and fill it.  
You can add any exchange in the configuration file. Just follow the structure.

## Usage 
```
Usage: index [options]

  Options:

    -V, --version               output the version number
    update                      Update trades database
    calculate                   Calculate profit/loss
    balance                     Show current balance
    -p --pair <p>               Define pair to calculate
    -e --exchanges <exchanges>  exchanges to call (default: )
    --positive                  Show positive only
    --negative                  Show negative only
    -h, --help                  output usage information
```

## Notice - Contribute

This program doesn't take into account the balance. Next work here. 

## Todo

- [x] Correct wrong btc equivalent
- [x] Take into account the balance
- [x] Test multi exchanges
- [ ] Main devise implementation (BTC or USDT) 
- [ ] Implement multi exchanges
- [ ] Rework calculate function (does not work well)