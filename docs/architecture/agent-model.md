# Agent model and local strategy boundary

`HftStrategy` receives market events, signal events, and fills through a time-bounded context. It can submit, cancel, or replace through an order sink and can observe only its permitted feed state, inventory, and cash. Baselines include a simple inventory-skewed market maker and reference-arbitrage response. The exchange grants no privileged future reference state.

Background, momentum, event, mean-reversion, reference-arbitrage, and noise agents are configuration concepts; synthetic informed agents are allowed only in explicitly labelled controlled scenarios. The `tanh` response candidate is bounded by design but is not presented as empirical trader behavior.

TWAP and profile-weighted VWAP child schedules preserve parent quantity. Execution quality reports arrival price, average fill, fill ratio, and implementation shortfall. Maker/taker economics remain configurable simulation assumptions.
