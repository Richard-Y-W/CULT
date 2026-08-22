import { useEffect, useRef, useState } from "react";

/**
 * Interpolates the *displayed* value toward an authoritative target over
 * `durationMs`, using requestAnimationFrame (never layout-thrashing CSS
 * transitions on the text itself). The authoritative value the caller
 * passed in is never mutated -- this hook only smooths what is rendered.
 * See docs/design/design-system.md#motion.
 */
export function useAnimatedNumber(target: number, durationMs = 250): number {
  const [displayed, setDisplayed] = useState(target);
  const frame = useRef<number | null>(null);
  const from = useRef(target);
  const startedAt = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplayed(target);
      return;
    }
    from.current = displayed;
    startedAt.current = performance.now();
    const step = (now: number) => {
      const elapsed = now - startedAt.current,
        progress = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs),
        eased = 1 - (1 - progress) * (1 - progress);
      setDisplayed(from.current + (target - from.current) * eased);
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs]);

  return displayed;
}
