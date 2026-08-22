import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ExpressionAsset } from "@cult/shared";
import { useApi, money, pct } from "../lib/api.js";
import { useCandles } from "../realtime/candles.js";
import { useInstrument } from "../realtime/marketStore.js";
import { CandleChart } from "../components/CandleChart.js";
import { UniverseHeatmap } from "../components/UniverseHeatmap.js";
import { Watchlist } from "../components/Watchlist.js";

interface ExpressionTapeEvent {
  id: number;
  eventTimeNs: string;
  type: string;
  expressionIds: string[];
  engagement: { likes: number; reposts: number; quotes: number; replies: number };
}
interface SignalTapeEvent {
  id: number;
  eventTimeNs: string;
  type: string;
  value: number;
  zScore: number;
}
interface MarketTapeEvent {
  sequence: number;
  exchangeTimeNs: string;
  type: string;
  priceTicks: number;
  quantity: number;
  aggressorSide?: string;
}
interface DepthLevel {
  side: "BID" | "ASK";
  priceTicks: number;
  quantity: number;
}

const nsToClock = (ns: string) => {
  const totalMs = Number(BigInt(ns) / 1_000_000n);
  const s = Math.floor(totalMs / 1000),
    ms = totalMs % 1000;
  return `T+${s}.${String(ms).padStart(3, "0")}s`;
};
const nsToMs = (ns: number) => `${(ns / 1_000_000).toFixed(1)}ms`;

function Panel({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <section className="qpanel">
      <div className="qpanel-title">
        <b>{title}</b>
        {meta && <span>{meta}</span>}
      </div>
      {children}
    </section>
  );
}
function QKpi({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="qkpi">
      <small>{label}</small>
      <b className={tone === "up" ? "term-up" : tone === "down" ? "term-down" : ""}>{value}</b>
    </div>
  );
}

function DepthLadder({ levels }: { levels: DepthLevel[] }) {
  const sorted = [...levels].sort((a, b) => b.priceTicks - a.priceTicks);
  return (
    <div className="depth-ladder">
      <div className="depth-ladder-head">
        <span>BID</span>
        <span>PRICE</span>
        <span>ASK</span>
      </div>
      {sorted.map((level) => (
        <div className="depth-ladder-row" key={`${level.side}-${level.priceTicks}`}>
          <span className="depth-bid">
            {level.side === "BID" ? level.quantity.toLocaleString() : ""}
          </span>
          <span className="depth-price">{level.priceTicks}</span>
          <span className="depth-ask">
            {level.side === "ASK" ? level.quantity.toLocaleString() : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function LiveSection({ assets }: { assets: ExpressionAsset[] }) {
  const { ticker = "CRY" } = useParams();
  const asset = assets.find((a) => a.ticker === ticker);
  const candles = useCandles(asset?.id ?? "", 10);
  const live = useInstrument(asset?.id ?? "");
  return (
    <>
      <div className="qsection-head qsection-live">
        <b>● LIVE</b>
        <span>WEBSOCKET TICK STREAM · 1Hz · ALL 19 EXPRESSIONS</span>
      </div>
      <div className="qgrid">
        <Panel
          title={`${ticker} · CANDLES`}
          meta={candles.length ? `${candles.length} × 10s (session)` : "AWAITING TICKS"}
        >
          {candles.length ? (
            <CandleChart candles={candles} height={220} />
          ) : (
            <p className="fineprint">
              Building candles from live ticks -- no pre-session intraday data
              exists to backfill, so this starts empty by design.
            </p>
          )}
          {live && (
            <div className="qkpis">
              <QKpi label="LAST" value={money(live.price)} />
              <QKpi label="BID" value={money(live.bid)} />
              <QKpi label="ASK" value={money(live.ask)} />
              <QKpi
                label="CHG"
                value={pct(live.changePercent)}
                tone={live.changePercent >= 0 ? "up" : "down"}
              />
            </div>
          )}
        </Panel>
        <Panel title="UNIVERSE HEATMAP" meta="LIVE · DAILY CHANGE">
          <UniverseHeatmap assets={assets} mode="quant" />
        </Panel>
      </div>
    </>
  );
}

export function Quant() {
  const { ticker = "CRY" } = useParams();
  const navigate = useNavigate();
  const { data: assetsRaw } = useApi<{ data?: ExpressionAsset[] } | ExpressionAsset[]>(
    "/assets",
    [],
  );
  const assets = Array.isArray(assetsRaw) ? assetsRaw : (assetsRaw.data ?? []);
  const scenarioTicker = "CRY";
  const hasScenario = ticker.toUpperCase() === scenarioTicker;
  // lib/api.ts's `request` already unwraps a top-level `data` envelope
  // (`j.data ?? j`), so these come back as the inner value directly --
  // except /tape, whose response has no top-level `data` key at all.
  const { data: tape } = useApi<any>(`/quant/assets/${scenarioTicker}/tape`, null);
  const { data: depthLevels } = useApi<DepthLevel[]>(
    `/quant/assets/${scenarioTicker}/depth`,
    [],
  );
  const { data: m } = useApi<any>(`/quant/assets/${scenarioTicker}/flow`, null);
  const { data: r } = useApi<any>("/quant/risk", null);
  const { data: lat } = useApi<any>(`/quant/assets/${scenarioTicker}/latency`, null);
  const { data: quantStateList } = useApi<any[]>("/quant/assets", []);

  const expressionTape = (tape?.expression ?? []) as ExpressionTapeEvent[];
  const signalTape = (tape?.signals ?? []) as SignalTapeEvent[];
  const marketTape = (tape?.market ?? []) as MarketTapeEvent[];
  const state = quantStateList[0];

  return (
    <div className="terminal quant-terminal">
      <header className="term-head">
        <button onClick={() => navigate("/")} className="term-logo">
          CULT//QUANT
        </button>
        <div className="qtopbar">
          <b>{ticker}</b>
          <span>CULT-X</span>
          {m && (
            <>
              <span>MID {m.midpoint?.toFixed(2)}</span>
              <span>μPX {m.microprice?.toFixed(2)}</span>
              <span>SPRD {m.spreadTicks}t</span>
              <span>OFI {m.ofi >= 0 ? "+" : ""}{m.ofi}</span>
            </>
          )}
        </div>
        <div className="system">
          <i /> LIVE + SCENARIO REPLAY
        </div>
      </header>
      <div className="term-workspace">
        <main className="term-main quant-main">
          <LiveSection assets={assets} />

          <div className="qsection-head qsection-scenario">
            <b>◼ FIXED SCENARIO REPLAY</b>
            <span>
              THE GREAT CRY SHOCK · DETERMINISTIC · NOT LIVE · signal → agent →
              latency → pre-trade risk → CULT-X (see docs/architecture/hft-simulator.md)
            </span>
          </div>
          {!hasScenario && (
            <p className="fineprint qscenario-note">
              No Phase 4 scenario tape exists for {ticker} yet -- only CRY has a
              canonical Great Cry Shock run. Showing CRY's scenario data below.
            </p>
          )}
          <div className="qgrid">
            <Panel title="EXPRESSION TAPE" meta={`${expressionTape.length} EVENTS`}>
              <div className="qtape">
                {expressionTape.slice(-40).reverse().map((e) => (
                  <div className="qtape-row" key={e.id}>
                    <span>{nsToClock(e.eventTimeNs)}</span>
                    <b>{e.type}</b>
                    <span>
                      {e.engagement.likes + e.engagement.reposts + e.engagement.quotes + e.engagement.replies > 0
                        ? `+${e.engagement.likes + e.engagement.reposts + e.engagement.quotes + e.engagement.replies}`
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="SIGNAL TAPE" meta={`${signalTape.length} SIGNALS`}>
              <div className="qtape">
                {signalTape.map((s) => (
                  <div className="qtape-row" key={s.id}>
                    <span>{nsToClock(s.eventTimeNs)}</span>
                    <b>{s.type}</b>
                    <span className={s.zScore >= 0 ? "term-up" : "term-down"}>
                      {s.zScore >= 0 ? "+" : ""}
                      {s.zScore.toFixed(2)}σ
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="MARKET TAPE / TIME &amp; SALES" meta={`${marketTape.length} EVENTS`}>
              <div className="qtape">
                {marketTape.slice(-40).reverse().map((e) => (
                  <div className="qtape-row" key={e.sequence}>
                    <span>{nsToClock(e.exchangeTimeNs)}</span>
                    <b
                      className={
                        e.type === "TRADE"
                          ? e.aggressorSide === "BUY"
                            ? "term-up"
                            : "term-down"
                          : ""
                      }
                    >
                      {e.type}
                    </b>
                    <span>
                      {e.priceTicks}t × {e.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="L2 ORDER BOOK" meta="CULT-X · 5 LEVELS">
              {depthLevels.length ? <DepthLadder levels={depthLevels} /> : <p className="fineprint">No depth snapshot.</p>}
            </Panel>
            <Panel title="MICROSTRUCTURE" meta="CULT-MICROSTRUCTURE-1">
              {m && (
                <div className="qkpis qkpis-3">
                  <QKpi label="BID" value={String(m.bid)} />
                  <QKpi label="ASK" value={String(m.ask)} />
                  <QKpi label="MID" value={m.midpoint?.toFixed(2)} />
                  <QKpi label="μPRICE" value={m.microprice?.toFixed(3)} />
                  <QKpi label="SPREAD" value={`${m.spreadTicks}t`} />
                  <QKpi label="L1 IMB" value={m.imbalanceL1?.toFixed(3)} />
                  <QKpi label="L5 IMB" value={m.imbalanceL5?.toFixed(3)} />
                  <QKpi label="TRADE IMB" value={m.tradeImbalance?.toFixed(2)} />
                  <QKpi label="OFI" value={String(m.ofi)} />
                </div>
              )}
            </Panel>
            <Panel title="PRE-TRADE RISK" meta="CULT PreTradeRisk::check">
              {r && (
                <div className="qkpis qkpis-3">
                  <QKpi label="DECISION" value={r.decision} tone={r.decision === "ACCEPT" ? "up" : "down"} />
                  <QKpi label="STATE" value={r.state} />
                  <QKpi label="GROSS EXP" value={money(r.grossExposure)} />
                  <QKpi label="NET EXP" value={money(r.netExposure)} />
                  <QKpi label="LEVERAGE" value={r.leverage?.toFixed(3)} />
                  <QKpi label="MARGIN USE" value={pct(r.marginUtilization * 100)} />
                </div>
              )}
            </Panel>
            <Panel title="LATENCY MODEL" meta="SYNTHETIC_CONFIG">
              {lat && (
                <div className="qkpis qkpis-3">
                  <QKpi label="FEED" value={nsToMs(lat.feedNs)} />
                  <QKpi label="PROCESS" value={nsToMs(lat.processingNs)} />
                  <QKpi label="ORDER" value={nsToMs(lat.orderNs)} />
                  <QKpi label="CANCEL" value={nsToMs(lat.cancelNs)} />
                </div>
              )}
            </Panel>
            <Panel title="BEHAVIOR / CASCADES" meta="CULT-BEHAVIOR-1">
              {state && (
                <div className="qkpis qkpis-3">
                  <QKpi label="AMPLIFICATION" value={state.amplification?.toFixed(1)} />
                  <QKpi label="PROPAGATION" value={state.propagation?.toFixed(2)} />
                  <QKpi label="CASCADE HHI" value={state.cascadeHhi?.toFixed(4)} />
                  <QKpi label="EFF. CASCADES" value={state.effectiveCascades?.toFixed(1)} />
                  <QKpi label="BREADTH" value={String(state.breadth)} />
                  <QKpi label="LIQUIDITY TIER" value={state.dataLiquidityTier} />
                </div>
              )}
            </Panel>
          </div>
        </main>
        <Watchlist selectedTicker={ticker} mode="quant" />
      </div>
      <div className="statusbar">
        <span>CULT-X · DETERMINISTIC EXCHANGE LABORATORY</span>
        <span>SCENARIO: GREAT CRY SHOCK</span>
        <span>LIVE FEED: SYNTHETIC</span>
        <span>AGENT ROUTING: SIGNAL → AGENT → LATENCY → RISK → ORDER</span>
      </div>
    </div>
  );
}
