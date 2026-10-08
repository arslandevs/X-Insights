import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";

interface Props {
  title: string;
  value?: ComponentChildren;
  sub?: ComponentChildren;
  /** Tap the card to reveal the rows behind the number. */
  details?: ComponentChildren;
  children?: ComponentChildren;
  class?: string;
}

export function Card({ title, value, sub, details, children, class: cls }: Props) {
  const [open, setOpen] = useState(false);
  const interactive = !!details;
  return (
    <div class={`card ${interactive ? "tap" : ""} ${cls ?? ""}`} onClick={interactive ? () => setOpen(!open) : undefined} role={interactive ? "button" : undefined} aria-expanded={interactive ? open : undefined}>
      <div class="card-head">
        <span class="muted">{title}</span>
        {interactive && <span class="muted chev">{open ? "▾" : "▸"}</span>}
      </div>
      {value !== undefined && <div class="big">{value}</div>}
      {sub && <div class="muted small">{sub}</div>}
      {children}
      {open && details && (
        <div class="details" onClick={(e) => e.stopPropagation()}>
          {details}
        </div>
      )}
    </div>
  );
}
