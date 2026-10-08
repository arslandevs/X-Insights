import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";

interface TipState {
  x: number;
  y: number;
  node: ComponentChildren;
}

/** Instant tooltip that follows the pointer. Native `<title>` tooltips wait about a second and cannot be styled. */
export function useTip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = (e: { clientX: number; clientY: number }, node: ComponentChildren) => setTip({ x: e.clientX, y: e.clientY, node });
  const hide = () => setTip(null);
  const box = tip ? <TipBox {...tip} /> : null;
  return { show, hide, box };
}

function TipBox({ x, y, node }: TipState) {
  const half = 90;
  const left = Math.max(half + 4, Math.min(x, window.innerWidth - half - 4));
  const above = y > 60;
  return (
    <div class="tip" style={{ left: `${left}px`, top: `${above ? y - 12 : y + 18}px`, transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)" }} role="tooltip">
      {node}
    </div>
  );
}
