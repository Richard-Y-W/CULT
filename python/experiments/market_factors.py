"""Experimental CULT-wide market internals and realized expression volatility (CEV)."""

from __future__ import annotations

import numpy as np


def market_factors(returns: np.ndarray, prevalence: np.ndarray) -> dict[str, float]:
    if returns.ndim != 1 or prevalence.ndim != 1 or returns.size != prevalence.size:
        raise ValueError("returns and prevalence must be aligned one-dimensional arrays")
    if returns.size == 0 or np.any(prevalence < 0) or prevalence.sum() <= 0:
        raise ValueError("positive aggregate prevalence is required")
    weights = prevalence / prevalence.sum()
    market_return = float(weights @ returns)
    dispersion = float(np.sqrt(weights @ ((returns - market_return) ** 2)))
    return {
        "expression_market_return": market_return,
        "dispersion": dispersion,
        "breadth": float(np.mean(returns > 0)),
        "concentration_top_5": float(np.sort(weights)[-5:].sum()),
    }


def realized_expression_volatility(market_returns: np.ndarray, periods_per_year: int) -> float:
    """CEV: annualized sample volatility of observed expression-market returns, not implied volatility."""
    if market_returns.size < 2 or periods_per_year <= 0:
        return 0.0
    return float(np.std(market_returns, ddof=1) * np.sqrt(periods_per_year))
