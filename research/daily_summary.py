"""Produce a deterministic structured daily summary from Parquet signals."""
from __future__ import annotations
import argparse, json
from pathlib import Path
import pandas as pd

parser = argparse.ArgumentParser(); parser.add_argument("dataset"); parser.add_argument("output"); args = parser.parse_args()
root = Path(args.dataset); signals = root / "expression_signals.parquet"
if not signals.exists():
    payload = {"status":"INSUFFICIENT_DATA","largest_reference_moves":[],"largest_surprises":[],"quality_warnings":["expression_signals.parquet unavailable"]}
else:
    frame = pd.read_parquet(signals)
    latest = frame[frame["timestamp"] == frame["timestamp"].max()]
    def top(column: str) -> list[dict[str, object]]:
        if column not in latest: return []
        return latest.reindex(latest[column].abs().sort_values(ascending=False).index).head(5)[["expression_id", column]].to_dict("records")
    payload = {"status":"OK","as_of":str(latest["timestamp"].max()),"largest_reference_moves":top("return"),"largest_surprises":top("seasonal_z"),"highest_volatility":top("volatility"),"largest_premium":top("premium"),"quality_warnings":latest.loc[latest.get("quality_composite", pd.Series(index=latest.index, dtype=float)) < .5, "expression_id"].tolist()}
Path(args.output).write_text(json.dumps(payload, indent=2, default=str, sort_keys=True) + "\n", encoding="utf-8")
