import { WEEKDAYS, WEEKDAYS_LONG, hourLabel } from "./format";

const CELL = 12;
const GAP = 2;
const LEFT = 30;

/** 7 weekdays x 24 hours in the chosen timezone. */
export function WeekHourHeatmap({ matrix }: { matrix: number[][] }) {
  const max = Math.max(1, ...matrix.flat());
  const width = LEFT + 24 * (CELL + GAP);
  return (
    <svg viewBox={`0 0 ${width} ${7 * (CELL + GAP) + 16}`} class="whm" role="img" aria-label="Posting by weekday and hour">
      {WEEKDAYS.map((d, r) => (
        <text key={d} x={0} y={r * (CELL + GAP) + CELL - 2} class="axis">
          {d}
        </text>
      ))}
      {matrix.map((row, r) =>
        row.map((n, h) => {
          const level = n === 0 ? 0 : Math.min(4, Math.ceil((4 * n) / max));
          return (
            <rect key={`${r}-${h}`} x={LEFT + h * (CELL + GAP)} y={r * (CELL + GAP)} width={CELL} height={CELL} rx={2} class={`hm hm${level}`}>
              <title>{`${n} on ${WEEKDAYS_LONG[r]}s around ${hourLabel(h)}`}</title>
            </rect>
          );
        }),
      )}
      {[0, 6, 12, 18].map((h) => (
        <text key={h} x={LEFT + h * (CELL + GAP)} y={7 * (CELL + GAP) + 11} class="axis">
          {hourLabel(h)}
        </text>
      ))}
    </svg>
  );
}
