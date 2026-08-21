# Simulated CULT microstructure

For best bid `b`, ask `a`, bid size `B`, and ask size `A`:

```text
mid = (b+a)/2
spread = a-b
microprice = (aB+bA)/(A+B)
L1 imbalance = (B-A)/(B+A)
```

Depth-K imbalance uses summed depth. Trade imbalance uses known aggressive buy/sell quantity. Order-flow imbalance (OFI) is separately computed from best-price/size changes; it is not the earlier signed-trade ratio and never means internet engagement flow.

Effective spread is `2D(P-mid_t)`, realized spread is `2D(P-mid_t+Δ)`, and impact is `2D(mid_t+Δ-mid_t)`. Buy-fill markout is `future_mid-fill`; sell-fill markout reverses sign. Horizons require a sufficiently long market tape. All prices are ticks internally.
