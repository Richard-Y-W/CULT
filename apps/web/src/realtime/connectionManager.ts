import type { FeedEnvelope } from "@cult/hft-engine";

export type ConnectionState =
  | "CONNECTED"
  | "DEGRADED"
  | "RECONNECTING"
  | "DISCONNECTED";

const STALE_AFTER_MS = 8_000;
const DISCONNECT_AFTER_MS = 30_000;
const MAX_BACKOFF_MS = 15_000;

export interface ConnectionManagerOptions {
  url: string;
  onMessage: (envelope: FeedEnvelope<unknown>) => void;
  onStateChange: (state: ConnectionState) => void;
}

/**
 * Owns one WebSocket connection: reconnect with exponential backoff,
 * staleness detection (no message within STALE_AFTER_MS -> DEGRADED, within
 * DISCONNECT_AFTER_MS -> force reconnect), and per-channel sequence-gap
 * detection. Snapshot-replay recovery on a detected gap is not implemented
 * here -- the one channel this drives today ("market") carries full state
 * per tick rather than deltas, so a missed message self-heals on the next
 * tick. Delta channels (e.g. L2 depth) will need real snapshot recovery
 * when they're added; this manager already surfaces the gap so that logic
 * has something to react to.
 */
export class ConnectionManager {
  private socket: WebSocket | null = null;
  private state: ConnectionState = "DISCONNECTED";
  private attempt = 0;
  private lastMessageAt = 0;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private readonly lastSequenceByChannel = new Map<string, number>();

  constructor(private readonly options: ConnectionManagerOptions) {}

  connect() {
    this.closedByUser = false;
    this.open();
  }

  close() {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.socket?.close();
    this.socket = null;
  }

  private setState(state: ConnectionState) {
    if (this.state === state) return;
    this.state = state;
    this.options.onStateChange(state);
  }

  private open() {
    this.setState(this.attempt > 0 ? "RECONNECTING" : this.state);
    const socket = new WebSocket(this.options.url);
    this.socket = socket;
    socket.addEventListener("open", () => {
      this.attempt = 0;
      this.lastMessageAt = Date.now();
      this.setState("CONNECTED");
      this.startStaleWatch();
    });
    socket.addEventListener("message", (event) => {
      this.lastMessageAt = Date.now();
      if (this.state !== "CONNECTED") this.setState("CONNECTED");
      let envelope: FeedEnvelope<unknown>;
      try {
        envelope = JSON.parse(event.data as string) as FeedEnvelope<unknown>;
      } catch {
        return;
      }
      const previous = this.lastSequenceByChannel.get(envelope.channel);
      if (previous !== undefined && envelope.sequence !== previous + 1)
        this.setState("DEGRADED");
      this.lastSequenceByChannel.set(envelope.channel, envelope.sequence);
      this.options.onMessage(envelope);
    });
    socket.addEventListener("close", () => {
      if (this.staleTimer) clearInterval(this.staleTimer);
      if (this.closedByUser) return;
      this.setState("DISCONNECTED");
      this.scheduleReconnect();
    });
    socket.addEventListener("error", () => socket.close());
  }

  private startStaleWatch() {
    if (this.staleTimer) clearInterval(this.staleTimer);
    this.staleTimer = setInterval(() => {
      const silentFor = Date.now() - this.lastMessageAt;
      if (silentFor > DISCONNECT_AFTER_MS) {
        this.socket?.close();
        return;
      }
      if (silentFor > STALE_AFTER_MS) this.setState("DEGRADED");
    }, 2_000);
  }

  private scheduleReconnect() {
    const delay = Math.min(MAX_BACKOFF_MS, 500 * 2 ** this.attempt);
    this.attempt++;
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }
}

export function websocketUrl(apiBaseUrl: string): string {
  const url = new URL(apiBaseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  return url.toString();
}
