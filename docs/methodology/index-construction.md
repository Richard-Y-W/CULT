# Cultural index construction

V0 publishes EMOJI100, BRAINROT20, HUMOR10, DOOM10, EUPHORIA10, and ROMANCE10 with smaller demo baskets. Supported weighting is equal, attention, square-root attention, or custom. Weights normalize to one and iterative redistribution applies the configured cap.

BRAINROT selection is designed around `0.35 momentum + 0.25 attention + 0.20 breadth + 0.10 persistence + 0.10 cross-platform score`, with each input normalized using only information available at selection time. Semantic-factor indexes use inferred exposure for eligibility, not settlement.

Every rebalance writes an immutable effective-dated composition. Historical values use the composition known at that date; current membership is never projected backward. Missing constituents retain the last valid mark for a bounded grace period, then trigger published redistribution at the next rebalance.
