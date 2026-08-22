import { useEffect, useState } from "react";

export const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:4100/api/v1";

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json" },
    ...init,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Request failed");
  return j.data ?? j;
}

export function useApi<T>(path: string, initial: T) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  useEffect(() => {
    request<T>(path)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [path]);
  return { data, error, reload: () => request<T>(path).then(setData) };
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
export const pct = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "N/A" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
