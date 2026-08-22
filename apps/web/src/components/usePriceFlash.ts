import { useEffect, useRef, useState } from "react";

/**
 * Returns a brief "flash-up"/"flash-down" class for ~250ms after `value`
 * changes direction, then clears -- a tint, not a permanent highlight (spec
 * §9). Never fires on the first render (nothing "changed" yet).
 */
export function usePriceFlash(value: number): "" | "flash-up" | "flash-down" {
  const [flash, setFlash] = useState<"" | "flash-up" | "flash-down">("");
  const previous = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (previous.current !== null && value !== previous.current) {
      setFlash(value > previous.current ? "flash-up" : "flash-down");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(""), 250);
    }
    previous.current = value;
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value]);

  return flash;
}
