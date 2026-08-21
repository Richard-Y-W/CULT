# CULT HFT challenges

Local challenges run the same tape, starting capital, venue, latency, risk, and fee configuration for every trusted strategy. Rankings report net P&L, Sharpe-like/Sortino where a sufficient return series exists, drawdown, inventory variance, spread capture, adverse selection, fees, turnover, messages, margin violations, and kills—not raw P&L alone.

Initial challenge families are market making, reference arbitrage, parent-order execution, and multi-expression risk. `run_market_making_challenge` is a deterministic native baseline harness; it is not evidence of performance on live expression data. Configuration and output hash belong in every run manifest.
