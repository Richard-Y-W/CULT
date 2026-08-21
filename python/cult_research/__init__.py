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
    native_available = True
except ImportError:
    native_available = False

__all__ = ["native_available"]
if native_available:
    __all__ += ["beta", "correlation", "jeffreys_prevalence_per_million", "log_returns", "normalized_entropy", "sample_volatility", "simple_returns"]
