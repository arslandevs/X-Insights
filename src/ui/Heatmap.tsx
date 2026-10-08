import { useEffect, useRef } from "preact/hooks";
import { addDays, prettyDay, weekdayOf } from "../tz";

const GAP = 3;
const MAX_WEEKS = 53;
const WIDTH = 340;

interface Props {
  days: string[];
  perDay: Record<string, number>;
  noun?: string;
}

/** GitHub-style calendar: columns are weeks, rows Sunday to Saturday, shade is the count that day. */
export function Heatmap({ days, perDay, noun = "activities" }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const first = days[0];
  const last = days[days.length - 1];
  const lastWeekStart = addDays(last, -weekdayOf(last));
  const weeks = Math.min(MAX_WEEKS, Math.round((Date.parse(lastWeekStart) - Date.parse(addDays(first, -weekdayOf(first)))) / (7 * 864e5)) + 1);
  const start = addDays(lastWeekStart, -(weeks - 1) * 7);
  // Short ranges get bigger cells so the grid fills the card; long ones scroll sideways.
  const CELL = Math.max(11, Math.min(26, Math.floor((WIDTH - (weeks - 1) * GAP) / weeks)));
  const max = Math.max(1, ...days.map((d) => perDay[d] ?? 0));
  const inRange = new Set(days);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [days.length, last]);

  const cells = [];
  for (let w = 0; w < weeks; w++) {
    for (let r = 0; r < 7; r++) {
      const key = addDays(start, w * 7 + r);
      if (key > last) continue;
      const n = perDay[key] ?? 0;
      const used = inRange.has(key);
      const level = !used ? -1 : n === 0 ? 0 : Math.min(4, Math.ceil((4 * n) / max));
      cells.push(
        <rect key={key} x={w * (CELL + GAP)} y={r * (CELL + GAP)} width={CELL} height={CELL} rx={2} class={`hm hm${level}`}>
          <title>{used ? `${n} ${n === 1 ? noun.replace(/ies$/, "y").replace(/s$/, "") : noun} on ${prettyDay(key)}` : prettyDay(key)}</title>
        </rect>,
      );
    }
  }
  const width = weeks * (CELL + GAP);
  return (
    <div class="hm-wrap" ref={scroller}>
      <svg width={width} height={7 * (CELL + GAP)} role="img" aria-label="Daily activity">
        {cells}
      </svg>
    </div>
  );
}
