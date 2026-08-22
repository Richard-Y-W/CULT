import { pct } from "../lib/api.js";

export function Change({ value }: { value: number }) {
  return <span className={value >= 0 ? "up" : "down"}>{pct(value)}</span>;
}
