"""Export immutable raw/derived research tables from PostgreSQL."""
from __future__ import annotations
import argparse, os
from pathlib import Path
import pandas as pd
import psycopg
from .datasets import write_snapshot


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset_id"); parser.add_argument("start"); parser.add_argument("end")
    parser.add_argument("--output", default="data/research")
    args = parser.parse_args()
    connection = os.environ.get("DATABASE_URL", "postgresql://cult:cult@localhost:5432/cult")
    with psycopg.connect(connection) as db:
        prevalence = pd.read_sql_query("""SELECT expression_id,platform_id,content_bucket,language_bucket,window_start,window_end,eligible_documents,expression_documents,occurrence_count,unique_author_estimate,raw_prevalence,smoothed_prevalence,intensity_when_present,largest_author_share,top_ten_author_share,author_hhi,effective_authors,documents_per_effective_author,source_health,arrival_mode,methodology_version,source_version,expression_registry_version FROM expression_observations_v3 WHERE window_start >= %(start)s AND window_start < %(end)s ORDER BY window_start,expression_id,content_bucket,language_bucket""", db, params={"start":args.start,"end":args.end})
        closes = pd.read_sql_query("""SELECT * FROM official_expression_closes WHERE close_date >= %(start)s::date AND close_date < %(end)s::date ORDER BY close_date,expression_id,revision_number""", db, params={"start":args.start,"end":args.end})
    if prevalence.empty:
        raise SystemExit("Refusing empty research snapshot")
    manifest = write_snapshot(Path(args.output), args.dataset_id, {"expression_prevalence":prevalence,"official_closes":closes}, methodology_version="REF-JEFFREYS-1", registry_version="EMOJI-17.0-CULT-V1", source_version="BLUESKY-JETSTREAM-1", start=args.start, end=args.end)
    print(manifest)


if __name__ == "__main__":
    main()
