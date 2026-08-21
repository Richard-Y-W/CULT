# Signal dictionary

Every signal is derived and carries `CULT-RESEARCH-1` unless stated otherwise. Missing history returns `N/A`, not a fabricated value.

| Code         | Formula / frequency                                   | Minimum history                      | Interpretation and limitations                     |
| ------------ | ----------------------------------------------------- | ------------------------------------ | -------------------------------------------------- |
| RET          | `log(p_t)-log(p_t-k)`                                 | 2 boundaries                         | Smoothed prevalence change; not a monetary return  |
| VEL          | one-boundary RET                                      | 2                                    | Log-prevalence velocity                            |
| ACC          | `VEL_t-VEL_t-1`                                       | 3                                    | Change in velocity; noisy at low counts            |
| MOM-k        | sum of non-overlapping boundary log changes           | k+1                                  | Prevalence continuation candidate                  |
| EW-MOM       | exponentially weighted RET                            | k+1                                  | Half-life and weights explicit                     |
| RAMOM        | MOM / max(RV,floor)                                   | k+1                                  | Floor is a versioned parameter                     |
| RV-W         | `sqrt(scale*sum(r^2))`                                | W                                    | Scale explicit; default raw-window, not 252-day    |
| VOV          | standard deviation of RV                              | 2 RV windows                         | Volatility regime instability                      |
| BREADTH-MKT  | rising eligible expressions / eligible expressions    | 2 per asset                          | Cross-expression participation                     |
| BREADTH-SRC  | fixed source weight with positive return              | 2 per source                         | Unavailable with one source                        |
| DISP         | weighted cross-sectional deviation from market return | 2 assets                             | Idiosyncratic versus common movement               |
| MKT          | weighted mean expression RET                          | 2 assets                             | Weight method must accompany value                 |
| BETA         | covariance(asset,MKT)/variance(MKT)                   | 30 preferred                         | Sensitivity, not economic beta                     |
| RESID        | asset RET minus fitted market component               | regression window                    | Expression-specific innovation                     |
| PREM         | market/reference - 1                                  | concurrent marks                     | Simulated trader dislocation                       |
| OFI          | `(buy-sell)/(buy+sell)`                               | active market interval               | Trader flow only; never source expression activity |
| SEAS-Z       | hour-of-week log prevalence surprise                  | >=8 observations/cell; 30d preferred | `INSUFFICIENT_HISTORY` otherwise                   |
| ROBUST-Z     | `0.67449*(x-median)/MAD`                              | 5 preferred                          | Zero when MAD is zero                              |
| IC / RANK-IC | cross-sectional correlation(signal, forward RET)      | 3 assets; repeated dates preferred   | Must be walk-forward and cost-aware                |
| AD           | cumulative advances minus declines                    | 2 assets                             | Broad expression-market internal                   |
| HHI / NEFF   | sum shares squared / reciprocal                       | 1                                    | Attention concentration                            |
| ENTROPY      | normalized Shannon expression-share entropy           | 2                                    | Diversity, not semantic entropy                    |

Leakage controls: signals computed at close execute no earlier than the next configured bar. Overlapping labels require purging/embargo. Current-universe membership must not be retrojected.
