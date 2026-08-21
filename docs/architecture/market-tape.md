# Market tape

The market tape is the sequenced output of the simulated venue `CULT-X`. It contains accepts, rejects, cancels, replaces, trades, book changes, halts, and reopens. Venue sequence numbers are monotonic and independent of expression event IDs. Trades record the true aggressor side because the simulator owns matching state.

The expression, signal, and market tapes are persisted separately. Given the same dataset, configuration, code, and RNG seed, deterministic replay must produce the same output hash. Public data products may expose L1/L2 and anonymized trades; private L3 agent orders remain internal.
