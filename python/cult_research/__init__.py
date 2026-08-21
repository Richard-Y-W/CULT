"""Research-only helpers. Production calculations remain in the C++ core."""

try:
    from _cult_quant import (  # type: ignore[import-not-found]
        beta,
        correlation,
        jeffreys_prevalence_per_million,
        log_returns,
        normalized_entropy,
        sample_volatility,
        simple_returns,
    )
except ImportError as error:
    raise ImportError(
        "The CULT C++ research binding is not built. Install with `pip install ./python`."
    ) from error

__all__ = [
    "beta",
    "correlation",
    "jeffreys_prevalence_per_million",
    "log_returns",
    "normalized_entropy",
    "sample_volatility",
    "simple_returns",
]
