-- Phase 4.1 hardening: durable post -> expression attribution.
--
-- Keys are HMAC-SHA256 digests of the underlying Bluesky record/cascade-root
-- URI (see apps/worker/src/attribution.ts), never the raw at:// URI itself,
-- consistent with the existing privacy-conscious identifier philosophy used
-- for the JSONL behavior tape. Rows outlive a single worker process so that
-- engagement referencing a post created before this worker started (or in a
-- prior process) can still be attributed after a restart.
CREATE TABLE post_attribution_map (
  record_id text PRIMARY KEY,
  expression_ids text[] NOT NULL,
  cascade_root_id text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('ORIGINAL','REPLY','QUOTE')),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX post_attribution_map_expires_idx ON post_attribution_map(expires_at);
CREATE INDEX post_attribution_map_cascade_idx ON post_attribution_map(cascade_root_id);

-- Engagement attribution coverage: how many observed engagement events
-- (like/repost/reply/quote) could be resolved to an expression-bearing post,
-- versus how many were eligible for resolution. Exposed via
-- GET /api/v1/data/status as mappedEngagementRate.
ALTER TABLE source_health_snapshots_v2
  ADD COLUMN mapped_engagement_events bigint NOT NULL DEFAULT 0,
  ADD COLUMN eligible_engagement_events bigint NOT NULL DEFAULT 0;
