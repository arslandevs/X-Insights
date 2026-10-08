import { compact } from "./format";
import { prettyDay } from "../tz";

interface Point {
  day: string;
  value: number;
}

/** Small area chart. Hover any column for the exact day and value. */
export function LineChart({ data, height = 90, color = "var(--accent)" }: { data: Point[]; height?: number; color?: string }) {
  if (!data.length) return <div class="muted">No data in this range.</div>;
  const W = 320;
  const padL = 34;
  const padB = 14;
  const padT = 6;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? (W - padL) / (data.length - 1) : 0;
  const x = (i: number) => padL + i * stepX;
  const y = (v: number) => padT + (height - padT - padB) * (1 - v / max);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${height - padB} L${x(0).toFixed(1)},${height - padB} Z`;
  const colW = data.length > 1 ? stepX : W - padL;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} class="chart" role="img" aria-label="Trend">
      <line x1={padL} x2={W} y1={height - padB} y2={height - padB} class="grid" />
      <line x1={padL} x2={W} y1={y(max / 2)} y2={y(max / 2)} class="grid" />
      <text x={0} y={y(max) + 8} class="axis">
        {compact(max)}
      </text>
      <text x={0} y={height - padB} class="axis">
        0
      </text>
      <path d={area} fill={color} opacity={0.18} />
      <path d={line} fill="none" stroke={color} stroke-width={1.6} stroke-linejoin="round" />
      {data.map((d, i) => (
        <rect key={d.day} x={x(i) - colW / 2} y={0} width={colW} height={height - padB} fill="transparent">
          <title>{`${prettyDay(d.day)}: ${compact(d.value)}`}</title>
        </rect>
      ))}
      <text x={padL} y={height - 2} class="axis">
        {data[0].day.slice(5)}
      </text>
      <text x={W} y={height - 2} class="axis" text-anchor="end">
        {data[data.length - 1].day.slice(5)}
      </text>
    </svg>
  );
}

export function Sparkline({ data, color = "var(--accent)" }: { data: number[]; color?: string }) {
  if (data.length < 2) return <svg class="spark" viewBox="0 0 80 22" />;
  const max = Math.max(1, ...data);
  const path = data.map((v, i) => `${i ? "L" : "M"}${((i / (data.length - 1)) * 78 + 1).toFixed(1)},${(20 - (v / max) * 18).toFixed(1)}`).join(" ");
  return (
    <svg class="spark" viewBox="0 0 80 22" aria-hidden="true">
      <path d={`${path} L79,21 L1,21 Z`} fill={color} opacity={0.18} />
      <path d={path} fill="none" stroke={color} stroke-width={1.4} stroke-linejoin="round" />
    </svg>
  );
}
