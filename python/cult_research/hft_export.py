"""Export a deterministic Phase 4 JSON run to versioned Parquet tapes."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq


def _write(path: Path, rows: list[dict]) -> str:
    table = pa.Table.from_pylist(rows)
    pq.write_table(table, path, compression="zstd")
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export(source: Path, destination: Path) -> dict:
    run = json.loads(source.read_text(encoding="utf-8"))
    destination.mkdir(parents=True, exist_ok=True)
    tables = {
        "expression_events.parquet": run["expressionTape"],
        "signal_events.parquet": run["signalTape"],
        "market_events.parquet": run["marketTape"],
        "book_snapshots.parquet": [
            {
                "timestamp": run["heatmaps"]["depth"]["timestamp"],
                "sequence": run["marketTape"][-1]["sequence"],
                "depth_json": json.dumps(run["microstructure"]["depth"]),
            }
        ],
        "agent_states.parquet": [run["risk"]],
    }
    hashes = {name: _write(destination / name, rows) for name, rows in tables.items()}
    manifest = {
        **run["manifest"],
        "sourceJsonSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "tables": hashes,
        "schemaVersion": "CULT-HFT-PARQUET-1",
    }
    (destination / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    print(json.dumps(export(args.source, args.destination)))


if __name__ == "__main__":
    main()
