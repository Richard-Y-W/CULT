# Factor research

Experimental market internals are computed from aligned eligible-expression returns: prevalence-weighted expression market return, realized expression volatility, cross-sectional dispersion, fraction rising, average pairwise correlation, and top-expression prevalence concentration.

`python/experiments/market_factors.py` implements transparent breadth, dispersion, concentration, and **CULT Realized Expression Volatility (CEV)**. CEV is annualized realized sample volatility. It is not option-implied and must not be described as VIX.

`expression_pca.py` standardizes an expression return matrix and uses SVD. Components remain PC1, PC2, and so forth; labels such as “doom” or “hype” require empirical interpretation. `validation/lead_lag.py` computes lagged relationships, but discoveries require out-of-sample validation and multiple-hypothesis correction.

Current BRAINROT, DOOM, HUMOR, EUPHORIA, ROMANCE, and EMOJI baskets are **CURATED** V0 product demonstrations. Rules-based or data-driven successors need separately versioned selection, eligibility, caps, rebalance histories, and—where semantic—measured semantic exposure.
