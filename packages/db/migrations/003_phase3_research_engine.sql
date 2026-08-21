CREATE TYPE data_arrival_mode AS ENUM ('LIVE','BACKFILLED');

INSERT INTO methodology_versions(id,kind,status,effective_from,specification_uri)
VALUES
  ('COIP-1.1','PANEL','PROVISIONAL','2026-08-21','docs/methodology/coip.md'),
  ('STANDARDIZATION-1','STANDARDIZATION','RESEARCH','2026-08-21','docs/methodology/standardization.md'),
  ('CULT-RESEARCH-1','RESEARCH','EXPERIMENTAL','2026-08-21','docs/research/signal-dictionary.md')
ON CONFLICT DO NOTHING;

CREATE TABLE expression_observations_v3 (
  expression_id text NOT NULL REFERENCES expressions(id),
  platform_id text NOT NULL,
  content_bucket text NOT NULL CHECK(content_bucket IN ('ORIGINAL','REPLY','QUOTE')),
  language_bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  observed_at timestamptz NOT NULL,
  arrival_mode data_arrival_mode NOT NULL,
  eligible_documents bigint NOT NULL CHECK(eligible_documents >= 0),
  expression_documents bigint NOT NULL CHECK(expression_documents BETWEEN 0 AND eligible_documents),
  occurrence_count bigint NOT NULL CHECK(occurrence_count >= expression_documents),
  intensity_when_present numeric(20,8) NOT NULL CHECK(intensity_when_present >= 0),
  unique_author_estimate bigint NOT NULL CHECK(unique_author_estimate >= 0),
  raw_prevalence numeric(20,8) NOT NULL,
  smoothed_prevalence numeric(20,8) NOT NULL,
  largest_author_share numeric(12,10) NOT NULL,
  top_ten_author_share numeric(12,10) NOT NULL,
  author_hhi numeric(12,10) NOT NULL,
  effective_authors numeric(20,8) NOT NULL,
  documents_per_effective_author numeric(20,8) NOT NULL,
  source_health source_health_state NOT NULL,
  methodology_version text NOT NULL,
  source_version text NOT NULL,
  expression_registry_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(expression_id,platform_id,content_bucket,language_bucket,window_start,methodology_version,source_version,expression_registry_version)
);
CREATE INDEX expression_observations_v3_time_idx
  ON expression_observations_v3(window_start DESC,platform_id,expression_id,language_bucket);

CREATE TABLE source_health_snapshots_v2 (
  source_id text NOT NULL,
  observed_at timestamptz NOT NULL,
  state source_health_state NOT NULL,
  last_event_at timestamptz,
  last_receive_at timestamptz,
  stream_lag_ms bigint,
  lag_p50_ms bigint,
  lag_p95_ms bigint,
  lag_p99_ms bigint,
  events_per_minute bigint NOT NULL,
  parse_errors bigint NOT NULL,
  duplicate_events bigint NOT NULL,
  reconnect_count bigint NOT NULL,
  source_version text NOT NULL,
  PRIMARY KEY(source_id,observed_at)
);

CREATE TABLE standardization_calibrations (
  id text PRIMARY KEY,
  source_id text NOT NULL,
  calibration_start timestamptz NOT NULL,
  calibration_end timestamptz NOT NULL,
  content_weights jsonb NOT NULL,
  language_weights jsonb NOT NULL,
  minimum_windows integer NOT NULL,
  status text NOT NULL CHECK(status IN ('CALIBRATING','ACTIVE','RETIRED')),
  methodology_version text NOT NULL,
  expression_registry_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE official_expression_closes (
  expression_id text NOT NULL REFERENCES expressions(id),
  close_date date NOT NULL,
  raw_eligible_documents bigint NOT NULL,
  raw_expression_documents bigint NOT NULL,
  raw_prevalence numeric(20,8) NOT NULL,
  smoothed_prevalence numeric(20,8) NOT NULL,
  content_adjusted_prevalence numeric(20,8),
  language_adjusted_prevalence numeric(20,8),
  fully_adjusted_prevalence numeric(20,8),
  index_value numeric(20,8) NOT NULL,
  finalized_at timestamptz NOT NULL,
  is_final boolean NOT NULL,
  revision_number integer NOT NULL DEFAULT 0,
  revision_reason text,
  methodology_version text NOT NULL,
  source_version text NOT NULL,
  expression_registry_version text NOT NULL,
  calibration_id text REFERENCES standardization_calibrations(id),
  PRIMARY KEY(expression_id,close_date,methodology_version,revision_number)
);

CREATE TABLE research_dataset_snapshots (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  source_ids jsonb NOT NULL,
  eligible_documents bigint NOT NULL,
  expression_hits bigint NOT NULL,
  missing_windows bigint NOT NULL,
  methodology_version text NOT NULL,
  source_version text NOT NULL,
  expression_registry_version text NOT NULL,
  git_sha text NOT NULL,
  manifest_sha256 text NOT NULL,
  manifest jsonb NOT NULL
);

ALTER TABLE expressions ADD COLUMN IF NOT EXISTS eligible_from timestamptz;
ALTER TABLE expressions ADD COLUMN IF NOT EXISTS eligible_until timestamptz;
ALTER TABLE expressions ADD COLUMN IF NOT EXISTS selection_reason text;
ALTER TABLE expressions ADD COLUMN IF NOT EXISTS universe_version text;
