"""Transparent lead/lag correlation utility; interpretation requires multiplicity control."""

from __future__ import annotations

import pandas as pd


def lead_lag_correlations(left: pd.Series, right: pd.Series, maximum_lag: int) -> pd.Series:
    if maximum_lag < 0:
        raise ValueError("maximum_lag must be nonnegative")
    return pd.Series(
        {lag: left.corr(right.shift(-lag)) for lag in range(-maximum_lag, maximum_lag + 1)},
        name="correlation",
    )
