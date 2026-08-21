"""Transparent econometric primitives for versioned CULT research datasets."""
from __future__ import annotations

from dataclasses import dataclass
import numpy as np
from scipy import stats
from statsmodels.regression.linear_model import OLS
from statsmodels.tools.tools import add_constant
from statsmodels.tsa.stattools import adfuller, acf


@dataclass(frozen=True)
class CointegrationResult:
    hedge_ratio: float
    intercept: float
    adf_statistic: float
    p_value: float
    half_life: float | None


def engle_granger(left: np.ndarray, right: np.ndarray) -> CointegrationResult:
    """Two-step Engle-Granger diagnostic; association is not causation."""
    if len(left) != len(right) or len(left) < 30:
        raise ValueError("cointegration requires equal series with at least 30 observations")
    fit = OLS(np.log(left), add_constant(np.log(right))).fit()
    residual = np.asarray(fit.resid)
    statistic, p_value, *_ = adfuller(residual, regression="n", autolag="AIC")
    delta = np.diff(residual)
    lagged = residual[:-1]
    speed = float(OLS(delta, lagged).fit().params[0])
    half_life = float(np.log(0.5) / np.log1p(speed)) if -1 < speed < 0 else None
    return CointegrationResult(float(fit.params[1]), float(fit.params[0]), float(statistic), float(p_value), half_life)


def lead_lag(x: np.ndarray, y: np.ndarray, max_lag: int) -> list[tuple[int, float]]:
    if len(x) != len(y) or max_lag < 0 or len(x) <= max_lag + 2:
        raise ValueError("invalid lead/lag inputs")
    result = []
    for lag in range(-max_lag, max_lag + 1):
        left, right = (x[-lag:], y[:lag]) if lag < 0 else ((x[:-lag], y[lag:]) if lag else (x, y))
        result.append((lag, float(stats.pearsonr(left, right).statistic)))
    return result


def newey_west_mean(values: np.ndarray, max_lags: int) -> tuple[float, float, float]:
    fit = OLS(values, np.ones((len(values), 1))).fit(cov_type="HAC", cov_kwds={"maxlags": max_lags})
    return float(fit.params[0]), float(fit.bse[0]), float(fit.tvalues[0])


def autocorrelation(values: np.ndarray, lags: int) -> np.ndarray:
    return np.asarray(acf(values, nlags=lags, fft=True, missing="drop"))


def benjamini_hochberg(p_values: np.ndarray) -> np.ndarray:
    if np.any((p_values < 0) | (p_values > 1)):
        raise ValueError("p-values must be in [0,1]")
    order = np.argsort(p_values)
    adjusted = np.empty_like(p_values, dtype=float)
    running = 1.0
    count = len(p_values)
    for rank in range(count - 1, -1, -1):
        idx = order[rank]
        running = min(running, float(p_values[idx]) * count / (rank + 1))
        adjusted[idx] = running
    return adjusted

