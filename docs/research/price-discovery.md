# Expression-to-market price discovery

The reference `R_t` comes from expression measurement. The simulated market midpoint `M_t` comes from orders. Basis is `M-R`; percentage basis is `M/R-1`. CULT does not force the book back to reference after an update.

Research asks whether basis forecasts future reference innovation, compared out of sample against no-change, EWMA, and reference momentum. In synthetic runs possessing `F_true`, market-efficiency diagnostics may use RMSE, bias, and convergence time. Live runs have no magical true fair value.

Association, temporal prediction, and causal effect remain distinct. Simulator results establish mechanics, not empirical internet-market efficiency.
