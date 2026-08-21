"""PCA experiment for expression returns. Components remain PC1, PC2, etc."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def run_pca(frame: pd.DataFrame) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    numeric = frame.select_dtypes(include="number").dropna(axis=0)
    if numeric.shape[0] < 2 or numeric.shape[1] < 2:
        raise ValueError("PCA requires at least two complete rows and two numeric expressions")
    values = numeric.to_numpy(dtype=float)
    standard_deviation = values.std(axis=0, ddof=1)
    if np.any(standard_deviation == 0):
        raise ValueError("PCA inputs must have nonzero sample variance")
    standardized = (values - values.mean(axis=0)) / standard_deviation
    _, singular_values, right_vectors = np.linalg.svd(standardized, full_matrices=False)
    explained = singular_values**2 / np.sum(singular_values**2)
    scores = standardized @ right_vectors.T
    return scores, right_vectors, explained


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path, help="Parquet file with timestamp plus expression-return columns")
    parser.add_argument("--output", type=Path, default=Path("python/output/pca"))
    arguments = parser.parse_args()
    data = pd.read_parquet(arguments.input)
    if "timestamp" in data.columns:
        data = data.drop(columns=["timestamp"])
    scores, loadings, explained = run_pca(data)
    arguments.output.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(scores, columns=[f"PC{i + 1}" for i in range(scores.shape[1])]).to_parquet(
        arguments.output / "scores.parquet", index=False
    )
    pd.DataFrame(loadings, columns=data.select_dtypes(include="number").columns).to_parquet(
        arguments.output / "loadings.parquet", index=False
    )
    pd.DataFrame({"component": [f"PC{i + 1}" for i in range(len(explained))], "explained_variance": explained}).to_csv(
        arguments.output / "explained-variance.csv", index=False
    )


if __name__ == "__main__":
    main()
