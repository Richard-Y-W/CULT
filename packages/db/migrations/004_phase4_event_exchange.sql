CREATE TYPE cult_data_mode AS ENUM ('SYNTHETIC','REPLAY','LIVE_SHADOW','LIVE_MARKET');
CREATE TYPE expression_event_type AS ENUM ('CREATE','LIKE','REPOST','REPLY','QUOTE','DELETE','OTHER');
CREATE TYPE sim_instrument_state AS ENUM ('PREOPEN','OPEN','HALTED','AUCTION','CLOSED');
CREATE TYPE sim_order_side AS ENUM ('BUY','SELL');
CREATE TYPE sim_order_type AS ENUM ('LIMIT','MARKET');
CREATE TYPE sim_time_in_force AS ENUM ('GTC','IOC','FOK');
CREATE TYPE sim_order_status AS ENUM ('PENDING','ACCEPTED','PARTIAL','FILLED','CANCELLED','REJECTED');

INSERT INTO methodology_versions(id,kind,status,effective_from,specification_uri)
VALUES
  ('CULT-BEHAVIOR-1','BEHAVIOR','EXPERIMENTAL','2026-08-21','docs/methodology/engagement.md'),
  ('CULT-X-1','EXCHANGE','EXPERIMENTAL','2026-08-21','docs/architecture/limit-order-book.md'),
  ('CULT-HFT-1','SIMULATION','EXPERIMENTAL','2026-08-21','docs/architecture/hft-simulator.md')
ON CONFLICT DO NOTHING;

CREATE TABLE expression_events (
  id bigint PRIMARY KEY,
  event_time_ns bigint NOT NULL,
  receive_time_ns bigint NOT NULL CHECK(receive_time_ns >= event_time_ns OR is_backfill),
  source_id text NOT NULL,
  event_type expression_event_type NOT NULL,
  content_type text NOT NULL,
  language_bucket text NOT NULL,
  cascade_id bigint NOT NULL,
  parent_cascade_id bigint,
  expression_ids jsonb NOT NULL,
  like_delta bigint NOT NULL DEFAULT 0 CHECK(like_delta >= 0),
  repost_delta bigint NOT NULL DEFAULT 0 CHECK(repost_delta >= 0),
  quote_delta bigint NOT NULL DEFAULT 0 CHECK(quote_delta >= 0),
  reply_delta bigint NOT NULL DEFAULT 0 CHECK(reply_delta >= 0),
  is_backfill boolean NOT NULL DEFAULT false,
  methodology_version text NOT NULL,
  source_version text NOT NULL,
  expression_registry_version text NOT NULL,
  dataset_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expression_events_time_idx ON expression_events(event_time_ns,source_id);
CREATE INDEX expression_events_cascade_idx ON expression_events(cascade_id,event_time_ns);

CREATE TABLE expression_event_links (
  event_id bigint NOT NULL REFERENCES expression_events(id) ON DELETE CASCADE,
  expression_id text NOT NULL REFERENCES expressions(id),
  attribution_weight numeric(20,12) NOT NULL CHECK(attribution_weight > 0 AND attribution_weight <= 1),
  PRIMARY KEY(event_id,expression_id)
);

CREATE TABLE cascade_snapshots (
  cascade_id bigint NOT NULL,
  expression_id text NOT NULL REFERENCES expressions(id),
  snapshot_time_ns bigint NOT NULL,
  root_id bigint NOT NULL,
  size bigint NOT NULL,
  depth bigint NOT NULL,
  breadth bigint NOT NULL,
  attention numeric(24,10) NOT NULL,
  methodology_version text NOT NULL,
  dataset_version text NOT NULL,
  PRIMARY KEY(cascade_id,expression_id,snapshot_time_ns,methodology_version)
);

CREATE TABLE expression_state_snapshots (
  expression_id text NOT NULL REFERENCES expressions(id),
  snapshot_time_ns bigint NOT NULL,
  prevalence numeric(24,12),
  post_breadth bigint NOT NULL,
  engagement_breadth bigint NOT NULL,
  cascade_breadth bigint NOT NULL,
  amplification numeric(24,10) NOT NULL,
  propagation_ratio numeric(24,10) NOT NULL,
  cascade_hhi numeric(20,12) NOT NULL,
  effective_cascades numeric(24,10) NOT NULL,
  data_quality jsonb NOT NULL,
  methodology_version text NOT NULL,
  source_version text NOT NULL,
  expression_registry_version text NOT NULL,
  dataset_version text NOT NULL,
  PRIMARY KEY(expression_id,snapshot_time_ns,methodology_version)
);

CREATE TABLE signal_events (
  id bigint PRIMARY KEY,
  event_time_ns bigint NOT NULL,
  expression_id text NOT NULL REFERENCES expressions(id),
  signal_type text NOT NULL,
  value numeric(24,12) NOT NULL,
  z_score numeric(20,10),
  methodology_version text NOT NULL,
  dataset_version text NOT NULL
);
CREATE INDEX signal_events_time_idx ON signal_events(event_time_ns,expression_id);

CREATE TABLE simulation_runs (
  id uuid PRIMARY KEY,
  data_mode cult_data_mode NOT NULL,
  scenario text NOT NULL,
  seed bigint NOT NULL,
  git_sha text NOT NULL,
  expression_dataset_version text NOT NULL,
  signal_methodology_version text NOT NULL,
  exchange_config_version text NOT NULL,
  agent_config_version text NOT NULL,
  config jsonb NOT NULL,
  output_sha256 text,
  started_at timestamptz NOT NULL,
  ended_at timestamptz
);

CREATE TABLE sim_venues (id text PRIMARY KEY,name text NOT NULL,config_version text NOT NULL,config jsonb NOT NULL);
CREATE TABLE sim_instruments (
  run_id uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
  venue_id text NOT NULL REFERENCES sim_venues(id),
  expression_id text NOT NULL REFERENCES expressions(id),
  state sim_instrument_state NOT NULL,
  tick_size bigint NOT NULL CHECK(tick_size > 0),
  lot_size bigint NOT NULL CHECK(lot_size > 0),
  PRIMARY KEY(run_id,venue_id,expression_id)
);
CREATE TABLE sim_agents (run_id uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,id bigint NOT NULL,agent_type text NOT NULL,config_version text NOT NULL,config jsonb NOT NULL,PRIMARY KEY(run_id,id));
CREATE TABLE sim_orders (
  run_id uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,
  venue_id text NOT NULL,
  order_id bigint NOT NULL,
  agent_id bigint NOT NULL,
  expression_id text NOT NULL REFERENCES expressions(id),
  side sim_order_side NOT NULL,
  order_type sim_order_type NOT NULL,
  time_in_force sim_time_in_force NOT NULL,
  price_ticks bigint,
  original_quantity bigint NOT NULL CHECK(original_quantity > 0),
  remaining_quantity bigint NOT NULL CHECK(remaining_quantity >= 0),
  status sim_order_status NOT NULL,
  send_time_ns bigint NOT NULL,
  accepted_time_ns bigint,
  exchange_sequence bigint,
  reject_reason text,
  PRIMARY KEY(run_id,venue_id,order_id)
);
CREATE TABLE sim_fills (run_id uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,venue_id text NOT NULL,trade_sequence bigint NOT NULL,maker_order_id bigint NOT NULL,taker_order_id bigint NOT NULL,price_ticks bigint NOT NULL,quantity bigint NOT NULL CHECK(quantity > 0),aggressor_side sim_order_side NOT NULL,exchange_time_ns bigint NOT NULL,PRIMARY KEY(run_id,venue_id,trade_sequence));
CREATE TABLE sim_trades (LIKE sim_fills INCLUDING ALL);
CREATE TABLE sim_book_events (run_id uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,venue_id text NOT NULL,exchange_sequence bigint NOT NULL,event_time_ns bigint NOT NULL,event_type text NOT NULL,expression_id text NOT NULL,price_ticks bigint,quantity bigint,order_id bigint,payload jsonb NOT NULL DEFAULT '{}',PRIMARY KEY(run_id,venue_id,exchange_sequence));
CREATE TABLE sim_book_snapshots (run_id uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,venue_id text NOT NULL,expression_id text NOT NULL,snapshot_time_ns bigint NOT NULL,exchange_sequence bigint NOT NULL,l1 jsonb NOT NULL,l2 jsonb NOT NULL,l3_internal jsonb,PRIMARY KEY(run_id,venue_id,expression_id,snapshot_time_ns));
CREATE TABLE sim_agent_state (run_id uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,agent_id bigint NOT NULL,snapshot_time_ns bigint NOT NULL,cash numeric(24,8) NOT NULL,positions jsonb NOT NULL,equity numeric(24,8) NOT NULL,inventory_pnl numeric(24,8) NOT NULL,fees numeric(24,8) NOT NULL,PRIMARY KEY(run_id,agent_id,snapshot_time_ns));
CREATE TABLE sim_latency_events (run_id uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,id bigint NOT NULL,agent_id bigint NOT NULL,event_time_ns bigint NOT NULL,feed_latency_ns bigint NOT NULL,processing_latency_ns bigint NOT NULL,order_latency_ns bigint NOT NULL,cancel_latency_ns bigint,PRIMARY KEY(run_id,id));
CREATE TABLE sim_risk_events (run_id uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,id bigint NOT NULL,agent_id bigint,event_time_ns bigint NOT NULL,event_type text NOT NULL,reason text NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(run_id,id));
CREATE TABLE sim_halts (run_id uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,id bigint NOT NULL,expression_id text NOT NULL,halt_time_ns bigint NOT NULL,reopen_time_ns bigint,reason text NOT NULL,PRIMARY KEY(run_id,id));
CREATE TABLE simulation_configs (version text PRIMARY KEY,kind text NOT NULL,config jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE simulation_metrics (run_id uuid NOT NULL REFERENCES simulation_runs(id) ON DELETE CASCADE,metric text NOT NULL,expression_id text,value numeric(30,12) NOT NULL,units text NOT NULL,methodology_version text NOT NULL,PRIMARY KEY(run_id,metric,expression_id));

INSERT INTO sim_venues(id,name,config_version,config) VALUES ('CULT-X','CULT Exchange Simulator','CULT-X-1','{"stp":"CANCEL_NEWEST","priority":"PRICE_TIME"}') ON CONFLICT DO NOTHING;
