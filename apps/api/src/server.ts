import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { ASSETS, PLATFORMS } from "@cult/shared";
import {
  generateSynthetic,
  jeffreysPrevalence,
  logPrevalenceReturn,
  phase2Signals,
} from "@cult/expression-engine";
import { INDEXES } from "@cult/index-engine";
import { SimulatedMarket } from "@cult/market-engine";
import {
  beta,
  correlation,
  logReturns,
  momentum,
  runBacktest,
  momentumStrategy,
  zScore,
  volatility,
} from "@cult/analytics";
import { z } from "zod";
import pg from "pg";
import {
  marketFactors,
  pairDiagnostics,
  priceDiscoveryRegression,
  spearman,
} from "@cult/research-engine";
import { createPhase4Demo, resolveDataMode } from "@cult/hft-engine";
const port = Number(process.env.PORT ?? 4100),
  data = generateSynthetic(),
  prices = Object.fromEntries(ASSETS.map((a) => [a.id, a.marketPrice])),
  market = new SimulatedMarket(1_000_000n, prices),
  started = Date.now();
const dataMode = resolveDataMode(process.env),
  empiricalMode = dataMode === "live-shadow" || dataMode === "live-market",
  livePool =
    empiricalMode && process.env.DATABASE_URL
      ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
      : null;
const phase4Demo = createPhase4Demo("great-cry");
const user = {
  id: "user_demo",
  username: "cryingcapital",
  email: "demo@cult.local",
  subscriptionTier: "ANALYST",
  bankruptcies: 2,
  bailoutsReceived: 1,
  tradesCompleted: 0,
  createdAt: "2026-01-01T00:00:00Z",
};
const orderSchema = z.object({
  assetId: z.string().min(1),
  side: z.enum(["BUY", "SELL", "SHORT", "COVER"]),
  quantity: z.number().positive().max(10000),
});
const authSchema = z.object({
  email: z.string().email(),
  username: z.string().min(2).optional(),
});
const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin":
      process.env.WEB_ORIGIN ?? "http://localhost:5173",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "x-content-type-options": "nosniff",
  });
  res.end(
    JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
};
const readBody = async (req: IncomingMessage) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (body.length > 100_000) throw new Error("Payload too large");
  return JSON.parse(body || "{}");
};
const assetByTicker = (ticker: string) =>
  ASSETS.find((a) => a.ticker === ticker.toUpperCase());
function assetAnalytics(id: string) {
  const points = data.history[id] ?? [],
    values = points.map((x) => x.indexValue),
    rets = logReturns(values),
    benchmark = data.history.expr_heart!.map((x) => x.indexValue);
  return {
    momentum: {
      d1: momentum(values, 1),
      d7: momentum(values, 7),
      d30: momentum(values, 30),
      d90: momentum(values, 90),
    },
    volatility: {
      d7: volatility(rets.slice(-7)) * Math.sqrt(365),
      d30: volatility(rets.slice(-30)) * Math.sqrt(365),
      d90: volatility(rets.slice(-90)) * Math.sqrt(365),
    },
    betaHeart: beta(rets.slice(-90), logReturns(benchmark).slice(-90)),
    drawdown: Math.min(
      ...values.map((x, i) => x / Math.max(...values.slice(0, i + 1)) - 1),
    ),
  };
}
function syntheticReferenceMetrics(id: string) {
  const rows = data.observations.filter(
      (observation) => observation.expressionId === id,
    ),
    latestByPlatform = PLATFORMS.map((platform) =>
      rows.filter((row) => row.platform === platform).slice(-2),
    ),
    current = latestByPlatform.map((pair) => pair.at(-1)!).filter(Boolean),
    returns = latestByPlatform.map((pair) => {
      const previous = pair.at(-2),
        next = pair.at(-1);
      if (!previous || !next) return 0;
      return logPrevalenceReturn(
        jeffreysPrevalence(next.usageCount, next.eligibleDocumentCount)
          .smoothedProbability,
        jeffreysPrevalence(previous.usageCount, previous.eligibleDocumentCount)
          .smoothedProbability,
      );
    }),
    signals = phase2Signals(
      returns,
      returns.map(() => 1),
      returns.slice(-4),
      0,
    ),
    eligible = current.reduce((sum, row) => sum + row.eligibleDocumentCount, 0),
    expressed = current.reduce((sum, row) => sum + row.usageCount, 0),
    prevalence = jeffreysPrevalence(expressed, eligible);
  return {
    mode: "SYNTHETIC",
    status: "PROVISIONAL",
    coipSources: 4,
    rawPrevalence: prevalence.rawPerMillion,
    smoothedPrevalence: prevalence.smoothedPerMillion,
    velocity: signals.velocity,
    acceleration: signals.acceleration,
    breadth: signals.breadth,
    signedBreadth: signals.signedBreadth,
    persistence: signals.persistence,
    dataQualityScore: null,
    dataQualityComponents: {
      sampleAdequacy: null,
      sourceCoverage: null,
      sourceHealth: null,
      crossSourceAgreement: null,
      authorConcentration: null,
      missingness: null,
    },
    sourceHealth: "SYNTHETIC",
    seasonalAdjustmentStatus: "INSUFFICIENT_HISTORY",
    methodologyVersion: "REF-JEFFREYS-1",
    sourceVersion: "SYNTHETIC-20260821",
    expressionRegistryVersion: "EMOJI-17.0-CULT-V1",
  };
}
async function liveReferenceMetrics(id: string) {
  if (!livePool) return null;
  const result = await livePool.query(
    `SELECT expression_id,sum(eligible_documents)::bigint eligible,sum(expression_documents)::bigint expressed,sum(occurrence_count)::bigint occurrences,sum(unique_author_estimate)::bigint authors,avg(largest_author_share) largest_author_share,avg(effective_authors) effective_authors,max(window_end) window_end,min(source_health::text) source_health FROM expression_observations_v3 WHERE expression_id=$1 AND language_bucket='ALL' AND window_start=(SELECT max(window_start) FROM expression_observations_v3 WHERE expression_id=$1 AND language_bucket='ALL') GROUP BY expression_id`,
    [id],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0],
    prevalence = jeffreysPrevalence(
      Number(row.expressed),
      Number(row.eligible),
    );
  return {
    mode: "LIVE",
    status: "PROVISIONAL",
    coipSources: 1,
    rawPrevalence: prevalence.rawPerMillion,
    smoothedPrevalence: prevalence.smoothedPerMillion,
    velocity: null,
    acceleration: null,
    breadth: null,
    signedBreadth: null,
    persistence: null,
    dataQualityScore: null,
    dataQualityComponents: {
      sampleAdequacy: Number(row.eligible),
      sourceCoverage: 1,
      sourceHealth: row.source_health,
      crossSourceAgreement: null,
      authorConcentration: {
        largestAuthorShare: Number(row.largest_author_share),
        effectiveAuthors: Number(row.effective_authors),
      },
      missingness: null,
    },
    sourceHealth: row.source_health,
    seasonalAdjustmentStatus: "INSUFFICIENT_HISTORY",
    methodologyVersion: "REF-JEFFREYS-1",
    sourceVersion: "BLUESKY-JETSTREAM-1",
    expressionRegistryVersion: "EMOJI-17.0-CULT-V1",
    windowEnd: row.window_end,
  };
}
const routes = async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === "OPTIONS") return json(res, 204, null);
  const url = new URL(req.url ?? "/", "http://localhost"),
    path = url.pathname;
  if (path === "/health")
    return json(res, 200, {
      status: "ok",
      uptimeSeconds: Math.floor((Date.now() - started) / 1000),
      datasetSeed: data.seed,
      dataMode,
      methodologyVersion: "REF-JEFFREYS-1",
    });
  if (path === "/api/v1/data/status") {
    if (empiricalMode && livePool) {
      const result = await livePool.query(
        `SELECT source_id,state,last_event_at,last_receive_at,stream_lag_ms,lag_p50_ms,lag_p95_ms,lag_p99_ms,events_per_minute,parse_errors,duplicate_events,reconnect_count,source_version,observed_at FROM source_health_snapshots_v2 ORDER BY observed_at DESC LIMIT 1`,
      );
      return json(res, 200, {
        data: {
          mode: dataMode === "live-shadow" ? "LIVE_SHADOW" : "LIVE_MARKET",
          panel: "COIP-1.1",
          coverageSources: 1,
          status: "PROVISIONAL",
          registryVersion: "EMOJI-17.0-CULT-V1",
          referenceMethodology: "REF-JEFFREYS-1",
          source: result.rows[0] ?? {
            source_id: "BLUESKY",
            state: "DISCONNECTED",
          },
        },
      });
    }
    return json(res, 200, {
      data: {
        mode: "SYNTHETIC",
        panel: "COIP-1.1",
        coverageSources: 0,
        status: "SYNTHETIC",
        registryVersion: "EMOJI-17.0-CULT-V1",
        referenceMethodology: "REF-JEFFREYS-1",
        source: {
          source_id: "SYNTHETIC",
          state: "HEALTHY",
          events_per_minute: null,
          stream_lag_ms: null,
          parse_errors: 0,
          duplicate_events: 0,
        },
        note: "Synthetic product dataset; no empirical source is represented.",
      },
    });
  }
  if (path === "/api/v1/auth/session") return json(res, 200, { user });
  if (path === "/api/v1/auth/login" || path === "/api/v1/auth/register") {
    const parsed = authSchema.safeParse(await readBody(req));
    if (!parsed.success)
      return json(res, 400, {
        error: "Invalid account details",
        issues: parsed.error.issues,
      });
    res.setHeader(
      "set-cookie",
      "cult_session=demo; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000",
    );
    return json(res, 200, { user: { ...user, ...parsed.data } });
  }
  if (path === "/api/v1/assets" && req.method === "GET")
    return json(res, 200, { data: ASSETS });
  const match = path.match(
    /^\/api\/v1\/assets\/([^/]+)(?:\/(history|platforms|semantics))?$/,
  );
  if (match) {
    const asset = assetByTicker(match[1]!);
    if (!asset) return json(res, 404, { error: "Expression not listed" });
    const part = match[2];
    if (part === "history")
      return json(res, 200, {
        data: data.history[asset.id],
        events: data.events.filter((e) => e.assets.includes(asset.id)),
      });
    if (part === "platforms") {
      const latest = Object.fromEntries(
        PLATFORMS.map((p) => [
          p,
          data.observations
            .filter((o) => o.expressionId === asset.id && o.platform === p)
            .at(-1),
        ]),
      );
      return json(res, 200, { data: latest });
    }
    if (part === "semantics")
      return json(res, 200, { data: data.semantics[asset.id] });
    return json(res, 200, {
      data: {
        ...asset,
        analytics: assetAnalytics(asset.id),
        latestSemantics: data.semantics[asset.id]?.at(-1),
        referenceMetrics:
          (empiricalMode ? await liveReferenceMetrics(asset.id) : null) ??
          syntheticReferenceMetrics(asset.id),
      },
    });
  }
  if (path === "/api/v1/indexes") return json(res, 200, { data: INDEXES });
  const im = path.match(/^\/api\/v1\/indexes\/([^/]+)$/);
  if (im) {
    const index = INDEXES.find((x) => x.ticker === im[1]!.toUpperCase());
    if (!index) return json(res, 404, { error: "Index not found" });
    const hist = data.history[index.constituents[0]!.assetId]!.map((p, i) => ({
      timestamp: p.timestamp,
      value:
        index.currentValue *
        index.constituents.reduce(
          (s, c) =>
            s +
            (c.weight * (data.history[c.assetId]?.[i]?.indexValue ?? 1)) /
              (data.history[c.assetId]?.at(-1)?.indexValue ?? 1),
          0,
        ),
    }));
    return json(res, 200, { data: { ...index, history: hist } });
  }
  if (path === "/api/v1/portfolio")
    return json(res, 200, {
      data: {
        ...market.portfolio(),
        user,
        bankruptcies: user.bankruptcies,
        achievements: ["DIAMOND HANDS", "DIVERSIFICATION IS FOR COWARDS"],
        orders: market.orders.slice(-10).reverse(),
      },
    });
  if (path === "/api/v1/orders" && req.method === "GET")
    return json(res, 200, { data: market.orders });
  if (path === "/api/v1/orders" && req.method === "POST") {
    const parsed = orderSchema.safeParse(await readBody(req));
    if (!parsed.success)
      return json(res, 400, {
        error: "Invalid order",
        issues: parsed.error.issues,
      });
    try {
      const order = market.submitOrder({ ...parsed.data, userId: user.id });
      user.tradesCompleted++;
      return json(res, 201, { data: order, portfolio: market.portfolio() });
    } catch (error) {
      return json(res, 422, {
        error: error instanceof Error ? error.message : "Order rejected",
      });
    }
  }
  if (path === "/api/v1/leaderboard")
    return json(res, 200, {
      data: [
        ["syntaxerror", 84.2, 18420, 0, 421],
        [
          "cryingcapital",
          41.8,
          market.portfolio().value,
          2,
          user.tradesCompleted,
        ],
        ["doomresearch", 26.4, 12640, 4, 88],
        ["hearthedge", 18.1, 11810, 0, 37],
        ["bruhmoment", -8.2, 9180, 7, 612],
      ].map(([username, twr, value, bankruptcies, trades], i) => ({
        rank: i + 1,
        username,
        twr,
        value,
        bankruptcies,
        trades,
      })),
    });
  if (path === "/api/v1/analytics/pair") {
    const a = assetByTicker(url.searchParams.get("a") ?? "CRY"),
      b = assetByTicker(url.searchParams.get("b") ?? "SKULL");
    if (!a || !b) return json(res, 400, { error: "Unknown pair" });
    const ah = data.history[a.id]!,
      bh = data.history[b.id]!,
      ratio = ah.map((x, i) => x.indexValue / bh[i]!.indexValue),
      ar = logReturns(ah.map((x) => x.indexValue)),
      br = logReturns(bh.map((x) => x.indexValue));
    return json(res, 200, {
      data: {
        a,
        b,
        series: ah.map((x, i) => ({
          timestamp: x.timestamp,
          ratio: ratio[i],
          spread: x.indexValue - bh[i]!.indexValue,
        })),
        correlation: correlation(ar.slice(-90), br.slice(-90)),
        relativeMomentum:
          momentum(
            ah.map((x) => x.indexValue),
            30,
          ) -
          momentum(
            bh.map((x) => x.indexValue),
            30,
          ),
        zScore: zScore(ratio.at(-1)!, ratio.slice(-90)),
        relativeVolatility:
          volatility(ar.slice(-30)) - volatility(br.slice(-30)),
      },
    });
  }
  if (path === "/api/v1/analytics/correlation") {
    const ids = ASSETS.slice(0, 10);
    return json(res, 200, {
      data: ids.map((a) => ({
        ticker: a.ticker,
        values: ids.map((b) =>
          correlation(
            logReturns(data.history[a.id]!.map((x) => x.indexValue)).slice(-90),
            logReturns(data.history[b.id]!.map((x) => x.indexValue)).slice(-90),
          ),
        ),
      })),
    });
  }
  if (path === "/api/v1/backtests" && req.method === "POST") {
    const bars = data.history.expr_crying_face!.map((p, i) => ({
        timestamp: p.timestamp,
        prices: Object.fromEntries(
          ASSETS.map((a) => [
            a.id,
            data.history[a.id]?.[i]?.marketPrice ?? a.marketPrice,
          ]),
        ),
      })),
      result = runBacktest(
        bars,
        momentumStrategy(
          ASSETS.map((a) => a.id),
          30,
        ),
        { initialCash: 10000, feeRate: 0.001, rebalanceEvery: 7 },
      );
    return json(res, 201, {
      data: {
        id: "bt_demo",
        strategy: "Top 3 / 30-day momentum",
        ...result,
        limitations: [
          "Synthetic daily closes",
          "No market impact",
          "No short borrow costs",
        ],
      },
    });
  }
  if (path === "/api/v1/events") return json(res, 200, { data: data.events });
  if (path === "/api/v1/research/series") {
    const asset = assetByTicker(url.searchParams.get("ticker") ?? "CRY");
    if (!asset) return json(res, 400, { error: "Unknown expression" });
    return json(res, 200, {
      data: data.history[asset.id],
      provenance: {
        mode: dataMode.toUpperCase(),
        methodologyVersion: "REF-JEFFREYS-1",
        sourceVersion: empiricalMode
          ? "BLUESKY-JETSTREAM-1"
          : "SYNTHETIC-20260821",
        expressionRegistryVersion: "EMOJI-17.0-CULT-V1",
      },
    });
  }
  if (path === "/api/v1/research/factors") {
    const assets = ASSETS.filter((asset) => data.history[asset.id]?.length),
      latestReturns = assets.map(
        (asset) =>
          logReturns(
            data.history[asset.id]!.map((point) => point.indexValue),
          ).at(-1) ?? 0,
      ),
      weights = assets.map((asset) =>
        Math.sqrt(data.history[asset.id]!.at(-1)!.indexValue),
      ),
      factors = marketFactors(latestReturns, weights);
    return json(res, 200, {
      data: factors,
      classification: "EXPERIMENTAL",
      methodologyVersion: "CULT-RESEARCH-1",
    });
  }
  if (path === "/api/v1/research/correlation") {
    const left = assetByTicker(url.searchParams.get("a") ?? "CRY"),
      right = assetByTicker(url.searchParams.get("b") ?? "SKULL");
    if (!left || !right) return json(res, 400, { error: "Unknown expression" });
    const x = logReturns(
        data.history[left.id]!.map((point) => point.indexValue),
      ),
      y = logReturns(data.history[right.id]!.map((point) => point.indexValue));
    return json(res, 200, {
      data: {
        pearson: correlation(x, y),
        spearman: spearman(x, y),
        observations: x.length,
      },
      methodologyVersion: "CULT-RESEARCH-1",
    });
  }
  if (path === "/api/v1/research/pairs") {
    const left = assetByTicker(url.searchParams.get("a") ?? "CRY"),
      right = assetByTicker(url.searchParams.get("b") ?? "SKULL");
    if (!left || !right) return json(res, 400, { error: "Unknown expression" });
    return json(res, 200, {
      data: pairDiagnostics(
        data.history[left.id]!.map((point) => point.indexValue),
        data.history[right.id]!.map((point) => point.indexValue),
      ),
      warning: "Pair diagnostics do not establish stationarity or causality.",
    });
  }
  if (path === "/api/v1/research/price-discovery") {
    const asset = assetByTicker(url.searchParams.get("ticker") ?? "CRY");
    if (!asset) return json(res, 400, { error: "Unknown expression" });
    const history = data.history[asset.id]!,
      premiums = history
        .slice(0, -1)
        .map((point) => point.marketPrice / point.indexValue - 1),
      future = history
        .slice(1)
        .map((point, index) =>
          Math.log(point.indexValue / history[index]!.indexValue),
        );
    return json(res, 200, {
      data: priceDiscoveryRegression(premiums, future),
      classification: "EXPERIMENTAL",
      warning:
        "In-sample synthetic diagnostic; not evidence of predictive power.",
    });
  }
  if (path === "/api/v1/quant/market-monitor")
    return json(res, 200, {
      data: [
        {
          ticker: "CRY",
          reference: phase4Demo.state.reference,
          market: phase4Demo.state.market,
          basisPercent: phase4Demo.state.basisPercent,
          spreadTicks: phase4Demo.microstructure.spreadTicks,
          eventRate: phase4Demo.state.creationFlow,
          quality: "SYNTHETIC_SCENARIO",
        },
      ],
      classification: "EXPERIMENTAL",
      venue: "CULT-X",
    });
  if (path === "/api/v1/quant/assets")
    return json(res, 200, { data: [{ ticker: "CRY", ...phase4Demo.state }] });
  const quantAsset = path.match(
    /^\/api\/v1\/quant\/assets\/([^/]+)\/(state|tape|depth|flow|cascades|microstructure|execution|latency)$/,
  );
  if (quantAsset) {
    if (quantAsset[1]!.toUpperCase() !== "CRY")
      return json(res, 404, {
        error: "No Phase 4 scenario tape for expression",
      });
    const part = quantAsset[2];
    if (part === "state")
      return json(res, 200, {
        data: phase4Demo.state,
        manifest: phase4Demo.manifest,
      });
    if (part === "tape")
      return json(res, 200, {
        expression: phase4Demo.expressionTape,
        signals: phase4Demo.signalTape,
        market: phase4Demo.marketTape,
        manifest: phase4Demo.manifest,
      });
    if (part === "depth")
      return json(res, 200, {
        data: phase4Demo.microstructure.depth,
        sequence: phase4Demo.marketTape.at(-1)?.sequence,
        venue: "CULT-X",
      });
    if (part === "flow" || part === "microstructure")
      return json(res, 200, {
        data: phase4Demo.microstructure,
        methodologyVersion: "CULT-MICROSTRUCTURE-1",
      });
    if (part === "cascades")
      return json(res, 200, {
        data: {
          cascadeHhi: phase4Demo.state.cascadeHhi,
          effectiveCascades: phase4Demo.state.effectiveCascades,
          breadth: phase4Demo.state.breadth,
        },
        methodologyVersion: "CULT-BEHAVIOR-1",
      });
    if (part === "execution")
      return json(res, 200, {
        data: {
          trades: phase4Demo.marketTape.filter(
            (event) => event.type === "TRADE",
          ),
          note: "Synthetic deterministic exchange tape; markout horizons require a longer replay.",
        },
      });
    return json(res, 200, {
      data: {
        feedNs: 1_000_000,
        processingNs: 1_000_000,
        orderNs: 3_000_000,
        cancelNs: 3_000_000,
      },
      classification: "SYNTHETIC_CONFIG",
    });
  }
  if (path === "/api/v1/quant/heatmaps")
    return json(res, 200, { data: phase4Demo.heatmaps });
  if (path === "/api/v1/quant/risk")
    return json(res, 200, { data: phase4Demo.risk });
  if (path === "/api/v1/quant/factors")
    return json(res, 200, {
      data: {
        behavior: phase4Demo.signalTape,
        market: phase4Demo.microstructure,
      },
      classification: "EXPERIMENTAL",
    });
  if (path === "/api/v1/research")
    return json(res, 200, {
      data: [
        {
          title: "Initiating Coverage: 😂 — UNDERPERFORM",
          author: "CULT Research",
          summary:
            "Legacy laughter remains under pressure as humor share migrates toward 💀 and 😭.",
          publishedAt: "2026-08-18T14:00:00Z",
          assetsCovered: ["JOY", "SKULL", "CRY"],
          views: 1842,
          likes: 211,
        },
      ],
    });
  return json(res, 404, { error: "Route not found" });
};
createServer((req, res) => {
  const requestId = crypto.randomUUID();
  const began = Date.now();
  routes(req, res)
    .catch((error) =>
      json(res, 500, { error: "Internal server error", requestId }),
    )
    .finally(() =>
      console.log(
        JSON.stringify({
          level: "info",
          requestId,
          method: req.method,
          path: req.url,
          status: res.statusCode,
          durationMs: Date.now() - began,
        }),
      ),
    );
}).listen(port, () =>
  console.log(
    JSON.stringify({ level: "info", message: "CULT API ready", port }),
  ),
);
