# CULT-X limit order book

`cult_exchange` implements deterministic L3 market-by-order matching with integer price ticks and quantities. Price priority precedes accepted sequence/time. Partial fills preserve the maker's remaining queue priority. A price change or quantity increase on replace resets priority; a same-price reduction retains it.

Supported instructions are limit, market/marketable, GTC, IOC, FOK, post-only, cancel, and cancel-replace. Default self-trade prevention is `CANCEL_NEWEST`; `CANCEL_OLDEST` and `CANCEL_BOTH` are supported. Market and IOC remainders cancel. FOK prechecks executable non-self quantity. Tick, lot, and minimum-size rules are instrument configuration.

Book invariants include positive resting quantity, valid price levels, one locator per active order, no filled order remaining active, volume conservation, and `best bid < best ask` outside transient matching. A deterministic randomized property test exercises 50,000 operations.
