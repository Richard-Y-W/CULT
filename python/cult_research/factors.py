"""Cross-sectional research functions. All fits require explicit as-of data."""
from __future__ import annotations
import numpy as np
from sklearn.decomposition import PCA
from sklearn.linear_model import LinearRegression
from scipy.stats import rankdata


def pca_returns(returns: np.ndarray, components: int = 3) -> dict[str, np.ndarray]:
    if returns.ndim != 2 or returns.shape[0] < 2:
        raise ValueError("PCA expects a T x N return matrix")
    scale = returns.std(axis=0, ddof=1)
    standardized = (returns - returns.mean(axis=0)) / np.where(scale > 0, scale, 1)
    model = PCA(n_components=min(components, *standardized.shape)).fit(standardized)
    return {"scores": model.transform(standardized), "loadings": model.components_.T, "explained_variance_ratio": model.explained_variance_ratio_}


def information_coefficient(signal: np.ndarray, forward: np.ndarray, rank: bool = False) -> float:
    if signal.shape != forward.shape or signal.size < 3:
        raise ValueError("IC requires matching arrays with at least three observations")
    left, right = (rankdata(signal), rankdata(forward)) if rank else (signal, forward)
    return float(np.corrcoef(left, right)[0, 1])


def neutralize(signal: np.ndarray, controls: np.ndarray) -> np.ndarray:
    if controls.ndim == 1:
        controls = controls[:, None]
    if len(signal) != len(controls):
        raise ValueError("signal/control length mismatch")
    return signal - LinearRegression().fit(controls, signal).predict(controls)


def quantile_forward_returns(signal: np.ndarray, forward: np.ndarray, quantiles: int = 5) -> np.ndarray:
    if quantiles < 2 or len(signal) < quantiles:
        raise ValueError("insufficient observations for quantiles")
    ranks = np.argsort(np.argsort(signal))
    buckets = np.minimum((ranks * quantiles) // len(signal), quantiles - 1)
    return np.asarray([forward[buckets == bucket].mean() for bucket in range(quantiles)])

