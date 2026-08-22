import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ASSETS } from "@cult/shared";
import { ensureRealtimeConnected, useConnectionState } from "../realtime/marketStore.js";
import type { ConnectionState } from "../realtime/connectionManager.js";

const MODES = [
  { path: "/trade", label: "Trade" },
  { path: "/analyst", label: "Analyst" },
  { path: "/quant", label: "Quant" },
] as const;

function ConnectionIndicator() {
  const state = useConnectionState();
  const label: Record<ConnectionState, string> = {
    CONNECTED: "LIVE FEED",
    DEGRADED: "FEED DEGRADED",
    RECONNECTING: "RECONNECTING",
    DISCONNECTED: "DISCONNECTED",
  };
  return (
    <div className={`connection-indicator connection-${state.toLowerCase()}`}>
      <i />
      <span>{label[state]}</span>
    </div>
  );
}

function AssetSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);
  if (!open) return null;
  const q = query.trim().toLowerCase();
  const matches = q
    ? ASSETS.filter(
        (a) =>
          a.ticker.toLowerCase().includes(q) ||
          a.canonicalExpression.toLowerCase().includes(q) ||
          a.displayName.toLowerCase().includes(q),
      ).slice(0, 8)
    : ASSETS.slice(0, 8);
  const go = (ticker: string) => {
    navigate(`/trade/${ticker}`);
    onClose();
  };
  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-panel" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && matches[0]) go(matches[0].ticker);
          }}
          placeholder="Search CRY, 😭, crying face..."
          aria-label="Search expressions"
        />
        <div className="search-results">
          {matches.map((a) => (
            <button key={a.id} onClick={() => go(a.ticker)}>
              <span>{a.canonicalExpression}</span>
              <b>{a.ticker}</b>
              <small>{a.displayName}</small>
            </button>
          ))}
          {!matches.length && <p className="search-empty">No expressions match.</p>}
        </div>
      </div>
    </div>
  );
}

export function Shell() {
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    ensureRealtimeConnected();
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if ((event.key === "/" && !typing) || ((event.metaKey || event.ctrlKey) && event.key === "k")) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <div className="shell cult-numeric">
      <header className="shell-nav">
        <NavLink to="/" className="brand" end>
          CULT<span>®</span>
        </NavLink>
        <nav className="mode-switcher">
          {MODES.map((mode) => (
            <NavLink key={mode.path} to={mode.path}>
              {mode.label}
            </NavLink>
          ))}
        </nav>
        <button className="search-trigger" onClick={() => setSearchOpen(true)}>
          Search <kbd>/</kbd>
        </button>
        <ConnectionIndicator />
      </header>
      <AssetSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Outlet />
      <footer>
        <b>CULT</b>
        <span>Simulated markets for internet expression.</span>
        <span>No cash value. No prizes. No dignity compromised.</span>
      </footer>
    </div>
  );
}
