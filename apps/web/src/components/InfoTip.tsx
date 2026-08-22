import { useState } from "react";

/**
 * Small self-explaining tooltip for a specialized metric/term -- one or two
 * sentences, not an essay (spec §94/§29). Keyboard accessible: focusable,
 * shows on focus as well as hover.
 */
export function InfoTip({ children }: { children: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="info-tip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button type="button" aria-label="Explain this metric" tabIndex={0}>
        ?
      </button>
      {open && <span className="info-tip-bubble">{children}</span>}
    </span>
  );
}
