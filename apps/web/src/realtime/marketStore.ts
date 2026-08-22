import { create } from "zustand";
import type { CultDataMode, FeedEnvelope, MarketTickPayload } from "@cult/hft-engine";
import {
  ConnectionManager,
  websocketUrl,
  type ConnectionState,
} from "./connectionManager.js";

export interface InstrumentTick {
  assetId: string;
  ticker: string;
  price: number;
  bid: number;
  ask: number;
  changePercent: number;
  dataMode: CultDataMode;
  updatedAtMs: number;
}

export interface PricePoint {
  timeSec: number;
  value: number;
}

interface MarketStoreState {
  connectionState: ConnectionState;
  // The most recently received tick's `dataMode` -- distinct from
  // `connectionState`, which only reflects whether the WebSocket itself is
  // connected. A connected socket says nothing about whether the data it
  // carries is synthetic, replayed, or derived from live-shadow collection;
  // conflating the two is exactly the "LIVE FEED just because WS connected"
  // mislabeling a pre-live audit must catch. `null` until the first tick.
  dataMode: CultDataMode | null;
  instrumentsById: Record<string, InstrumentTick>;
  historyByAssetId: Record<string, PricePoint[]>;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4100/api/v1";
// 10 minutes at the server's 1s tick cadence -- bounded so the browser
// session's memory does not grow without bound (spec §142).
const MAX_HISTORY_POINTS = 600;

export const useMarketStore = create<MarketStoreState>(() => ({
  connectionState: "DISCONNECTED",
  dataMode: null,
  instrumentsById: {},
  historyByAssetId: {},
}));

let manager: ConnectionManager | null = null;

/** Idempotent: safe to call from multiple components mounting concurrently. */
export function ensureRealtimeConnected() {
  if (manager) return;
  manager = new ConnectionManager({
    url: websocketUrl(API_BASE),
    onStateChange: (connectionState) =>
      useMarketStore.setState({ connectionState }),
    onMessage: (envelope) => {
      if (envelope.channel !== "market") return;
      const tick = (envelope as FeedEnvelope<MarketTickPayload>).payload,
        nowMs = Date.now();
      useMarketStore.setState((state) => {
        const priorHistory = state.historyByAssetId[tick.assetId] ?? [],
          nextHistory = [
            ...priorHistory,
            { timeSec: Math.floor(nowMs / 1000), value: tick.price },
          ].slice(-MAX_HISTORY_POINTS);
        return {
          dataMode: tick.dataMode,
          instrumentsById: {
            ...state.instrumentsById,
            [tick.assetId]: {
              assetId: tick.assetId,
              ticker: tick.ticker,
              price: tick.price,
              bid: tick.bid,
              ask: tick.ask,
              changePercent: tick.changePercent,
              dataMode: tick.dataMode,
              updatedAtMs: nowMs,
            },
          },
          historyByAssetId: {
            ...state.historyByAssetId,
            [tick.assetId]: nextHistory,
          },
        };
      });
    },
  });
  manager.connect();
}

export function useInstrument(assetId: string): InstrumentTick | undefined {
  return useMarketStore((state) => state.instrumentsById[assetId]);
}

export function useConnectionState(): ConnectionState {
  return useMarketStore((state) => state.connectionState);
}

/** The live tick feed's own data provenance -- see MarketStoreState.dataMode. */
export function useMarketDataMode(): CultDataMode | null {
  return useMarketStore((state) => state.dataMode);
}

const EMPTY_HISTORY: PricePoint[] = [];
export function usePriceHistory(assetId: string): PricePoint[] {
  return useMarketStore(
    (state) => state.historyByAssetId[assetId] ?? EMPTY_HISTORY,
  );
}
