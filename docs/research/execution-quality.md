# Execution quality

Parent execution captures arrival midpoint. Child fills report average fill, fill rate, duration, fees, spread, impact, timing/opportunity cost where observable, and implementation shortfall relative to arrival. TWAP uses equal time slices; VWAP-like execution uses an explicit simulated profile; POV uses simulated venue volume only.

Passive strategy results decompose net P&L into spread capture, inventory movement, fees/rebates, adverse selection/markouts, funding/borrow, and impact where the tape supports each term. Artificial risk penalties are strategy objectives, not accounting P&L.
