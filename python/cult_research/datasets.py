"""Immutable Parquet snapshot manifests for reproducible CULT research."""
from __future__ import annotations
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from hashlib import sha256
import importlib.metadata
import json
from pathlib import Path
import subprocess
import pandas as pd


@dataclass(frozen=True)
class DatasetManifest:
    dataset_id: str
    created_at: str
    git_sha: str
    methodology_version: str
    registry_version: str
    source_version: str
    start: str
    end: str
    tables: dict[str, dict[str, object]]
    dependencies: dict[str, str]


def write_snapshot(root: Path, dataset_id: str, tables: dict[str, pd.DataFrame], *, methodology_version: str, registry_version: str, source_version: str, start: str, end: str) -> DatasetManifest:
    destination = root / dataset_id
    if destination.exists():
        raise FileExistsError(f"immutable snapshot already exists: {destination}")
    destination.mkdir(parents=True)
    table_manifest: dict[str, dict[str, object]] = {}
    for name, frame in sorted(tables.items()):
        path = destination / f"{name}.parquet"
        frame.to_parquet(path, index=False)
        table_manifest[name] = {"rows": len(frame), "sha256": sha256(path.read_bytes()).hexdigest(), "columns": list(frame.columns)}
    try:
        git_sha = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    except (OSError, subprocess.CalledProcessError):
        git_sha = "UNKNOWN"
    dependencies = {name: importlib.metadata.version(name) for name in ("numpy", "pandas", "pyarrow", "scipy", "statsmodels", "scikit-learn")}
    manifest = DatasetManifest(dataset_id, datetime.now(timezone.utc).isoformat(), git_sha, methodology_version, registry_version, source_version, start, end, table_manifest, dependencies)
    (destination / "manifest.json").write_text(json.dumps(asdict(manifest), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest

