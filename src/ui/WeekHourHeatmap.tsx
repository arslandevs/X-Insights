import { useTip } from "./Tip";
import { WEEKDAYS, WEEKDAYS_LONG, hourLabel } from "./format";

const CELL = 12;
const GAP = 2;
const LEFT = 30;

/** 7 weekdays x 24 hours in the chosen timezone. */
export function WeekHourHeatmap({ matrix }: { matrix: number[][] }) {
  const tip = useTip();
  const max = Math.max(1, ...matrix.flat());
  const width = LEFT + 24 * (CELL + GAP);
  return (
    <>
    <svg
      viewBox={`0 0 ${width} ${7 * (CELL + GAP) + 16}`}
      class="whm"
      role="img"
      aria-label="Posting by weekday and hour"
      onPointerMove={(e) => {
        const d = (e.target as Element).getAttribute?.("data-tip");
        if (!d) return tip.hide();
        const [a, b] = d.split("|");
        tip.show(e, <><b>{a}</b><div class="muted">{b}</div></>);
      }}
      onPointerLeave={tip.hide}
    >
      {WEEKDAYS.map((d, r) => (
        <text key={d} x={0} y={r * (CELL + GAP) + CELL - 2} class="axis">
          {d}
        </text>
      ))}
      {matrix.map((row, r) =>
        row.map((n, h) => {
          const level = n === 0 ? 0 : Math.min(4, Math.ceil((4 * n) / max));
          return (
            <rect key={`${r}-${h}`} x={LEFT + h * (CELL + GAP)} y={r * (CELL + GAP)} width={CELL} height={CELL} rx={2} class={`hm hm${level}`} data-tip={`${n} ${n === 1 ? "post" : "posts"}|${WEEKDAYS_LONG[r]}s, ${hourLabel(h)}`} />
          );
        }),
      )}
      {[0, 6, 12, 18].map((h) => (
        <text key={h} x={LEFT + h * (CELL + GAP)} y={7 * (CELL + GAP) + 11} class="axis">
          {hourLabel(h)}
        </text>
      ))}
    </svg>
    {tip.box}
    </>
  );
}
