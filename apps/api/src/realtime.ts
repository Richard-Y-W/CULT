import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { ASSETS } from "@cult/shared";
import { VirtualLiquidityProvider } from "@cult/market-engine";
import type { CultDataMode, FeedEnvelope, MarketTickPayload } from "@cult/hft-engine";

interface TickerState {
  reference: number;
  logPremium: number;
  referenceVolatility: number;
  dataQuality: number;
  virtualLiquidity: number;
  inventory: number;
  previousClose: number;
}

/**
 * Drives each asset's price forward with the same tested
 * VirtualLiquidityProvider used by the (currently static) SimulatedMarket
 * primitive -- the frontend never invents price movement itself. Always
 * SYNTHETIC in this dev/default configuration; a live-shadow/live-market
 * deployment would drive `orderFlow`/`shock` from real order flow and
 * measured reference shocks instead of the deterministic PRNG below.
 */
export class MarketTickEngine {
  // Tuned so the price/reference basis stays in a believable band
  // regardless of how long the process has been running: meanReversion is
  // strong enough that logPremium is a stationary (bounded-variance)
  // process rather than an effectively-unbounded random walk over a long
  // session. Order-flow noise and shocks are deliberately small -- this is
  // a believable simulated market, not a stress test.
  private readonly provider = new VirtualLiquidityProvider({
    meanReversion: 0.08,
    orderFlowImpact: 0.006,
    shockVolatility: 0.015,
    baseHalfSpread: 0.0008,
    volatilitySpread: 0.01,
    illiquiditySpread: 0.05,
    dataRiskSpread: 0.01,
    inventorySkew: 0,
  });
  private readonly states = new Map<string, TickerState>();
  private rngState: number;

  constructor(seed = 20260821) {
    this.rngState = seed >>> 0;
    for (const asset of ASSETS)
      this.states.set(asset.id, {
        reference: asset.marketPrice,
        logPremium: 0,
        referenceVolatility: 0.15,
        dataQuality: 0.95,
        virtualLiquidity: 50_000,
        inventory: 0,
        previousClose: asset.previousClose,
      });
  }

  // Deterministic PRNG (mulberry32) so a fixed seed replays identically;
  // this is explicitly a SYNTHETIC driver, not a claim about real order flow.
  private random(): number {
    this.rngState = (this.rngState + 0x6d2b79f5) | 0;
    let t = this.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  tick(dataMode: CultDataMode): MarketTickPayload[] {
    const output: MarketTickPayload[] = [];
    for (const asset of ASSETS) {
      const state = this.states.get(asset.id);
      if (!state) continue;
      const buyVolume = this.random() * 100,
        sellVolume = this.random() * 100,
        shock = this.random() < 0.004 ? (this.random() - 0.5) * 2 : 0,
        result = this.provider.update(state, buyVolume, sellVolume, shock);
      state.logPremium = result.logPremium;
      output.push({
        assetId: asset.id,
        ticker: asset.ticker,
        price: Number(result.mid.toFixed(2)),
        bid: Number(result.bid.toFixed(2)),
        ask: Number(result.ask.toFixed(2)),
        changePercent: Number(
          (((result.mid - state.previousClose) / state.previousClose) * 100).toFixed(2),
        ),
        dataMode,
      });
    }
    return output;
  }
}

const HEARTBEAT_INTERVAL_MS = 15_000;
const TICK_INTERVAL_MS = 1_000;

/** Attaches a `/ws` WebSocket endpoint to an existing http.Server. */
export function attachRealtimeServer(
  server: HttpServer,
  getDataMode: () => CultDataMode,
) {
  const wss = new WebSocketServer({ noServer: true }),
    engine = new MarketTickEngine();
  let sequence = 0;

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (socket) => {
    let alive = true;
    socket.on("pong", () => {
      alive = true;
    });
    const heartbeat = setInterval(() => {
      if (!alive) {
        socket.terminate();
        return;
      }
      alive = false;
      socket.ping();
    }, HEARTBEAT_INTERVAL_MS);
    socket.once("close", () => clearInterval(heartbeat));
  });

  const broadcast = (envelope: FeedEnvelope<MarketTickPayload>) => {
    const message = JSON.stringify(envelope);
    for (const client of wss.clients)
      if (client.readyState === WebSocket.OPEN) client.send(message);
  };

  const tickTimer = setInterval(() => {
    if (!wss.clients.size) return;
    const dataMode = getDataMode();
    for (const payload of engine.tick(dataMode))
      broadcast({
        schemaVersion: "CULT-FEED-1",
        channel: "market",
        sequence: ++sequence,
        publishedTimeNs: (BigInt(Date.now()) * 1_000_000n).toString(),
        payload,
      });
  }, TICK_INTERVAL_MS);

  return {
    close: () => {
      clearInterval(tickTimer);
      wss.close();
    },
  };
}
