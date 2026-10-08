import { useState } from "preact/hooks";
import { prettyDay } from "../tz";
import { compact } from "./format";
import { useTip } from "./Tip";

interface Point {
  day: string;
  value: number;
}

const W = 320;

/** Index of the point under the pointer, for a chart whose x range starts at `padL`. */
function nearest(e: PointerEvent, n: number, padL: number): number {
  const svg = e.currentTarget as SVGSVGElement;
  const r = svg.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * W;
  if (n < 2) return 0;
  const step = (W - padL) / (n - 1);
  return Math.max(0, Math.min(n - 1, Math.round((x - padL) / step)));
}

/** Area chart. Move over it for a crosshair and the exact day and value. */
export function LineChart({ data, height = 96, color = "var(--accent)", unit = "" }: { data: Point[]; height?: number; color?: string; unit?: string }) {
  const tip = useTip();
  const [hi, setHi] = useState<number | null>(null);
  if (!data.length) return <div class="muted">No data in this range.</div>;
  const padL = 34;
  const padB = 14;
  const padT = 6;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? (W - padL) / (data.length - 1) : 0;
  const x = (i: number) => padL + i * stepX;
  const y = (v: number) => padT + (height - padT - padB) * (1 - v / max);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${height - padB} L${x(0).toFixed(1)},${height - padB} Z`;
  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        class="chart"
        role="img"
        aria-label="Trend"
        onPointerMove={(e) => {
          const i = nearest(e, data.length, padL);
          setHi(i);
          tip.show(e, <><b>{compact(data[i].value)}</b> {unit}<div class="muted">{prettyDay(data[i].day)}</div></>);
        }}
        onPointerLeave={() => {
          setHi(null);
          tip.hide();
        }}
      >
        <line x1={padL} x2={W} y1={height - padB} y2={height - padB} class="grid" />
        <line x1={padL} x2={W} y1={y(max / 2)} y2={y(max / 2)} class="grid" />
        <text x={0} y={y(max) + 8} class="axis">{compact(max)}</text>
        <text x={0} y={height - padB} class="axis">0</text>
        <path d={area} fill={color} opacity={0.18} />
        <path d={line} fill="none" stroke={color} stroke-width={1.6} stroke-linejoin="round" />
        {hi !== null && (
          <>
            <line x1={x(hi)} x2={x(hi)} y1={padT} y2={height - padB} class="cross" />
            <circle cx={x(hi)} cy={y(data[hi].value)} r={3.5} fill={color} stroke="var(--bg)" stroke-width={1.5} />
          </>
        )}
        <text x={padL} y={height - 2} class="axis">{data[0].day.slice(5)}</text>
        <text x={W} y={height - 2} class="axis" text-anchor="end">{data[data.length - 1].day.slice(5)}</text>
      </svg>
      {tip.box}
    </>
  );
}

/** Small trend line with the same hover behaviour. `days` (same length as `data`) labels the tooltip. */
export function Sparkline({ data, days, color = "var(--accent)", unit = "" }: { data: number[]; days?: string[]; color?: string; unit?: string }) {
  const tip = useTip();
  const [hi, setHi] = useState<number | null>(null);
  if (data.length < 2) return <svg class="spark" viewBox="0 0 80 28" />;
  const max = Math.max(1, ...data);
  const px = (i: number) => (i / (data.length - 1)) * 78 + 1;
  const py = (v: number) => 26 - (v / max) * 24;
  const path = data.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  return (
    <>
      <svg
        class="spark"
        viewBox="0 0 80 28"
        preserveAspectRatio="none"
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.max(0, Math.min(data.length - 1, Math.round(((e.clientX - r.left) / r.width) * (data.length - 1))));
          setHi(i);
          tip.show(e, <><b>{compact(data[i])}</b> {unit}{days?.[i] && <div class="muted">{prettyDay(days[i])}</div>}</>);
        }}
        onPointerLeave={() => {
          setHi(null);
          tip.hide();
        }}
      >
        <path d={`${path} L79,27 L1,27 Z`} fill={color} opacity={0.18} />
        <path d={path} fill="none" stroke={color} stroke-width={1.4} stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        {hi !== null && <line x1={px(hi)} x2={px(hi)} y1={0} y2={28} class="cross" vector-effect="non-scaling-stroke" />}
      </svg>
      {tip.box}
    </>
  );
}
