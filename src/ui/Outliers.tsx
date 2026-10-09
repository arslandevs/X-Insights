import { useMemo, useState } from "preact/hooks";
import { applyFilter, type FilterKey } from "../metrics/filter";
import { CATEGORIES, categoryLift, outliers, Y_METRICS, type OutlierPoint, type YMetric, type Zone } from "../metrics/outliers";
import { FilterPicker } from "./FilterPicker";
import { Icon, type IconName } from "./Icon";
import { useTip } from "./Tip";
import { useTweetHover } from "./TweetCard";
import { compact, firstLine, pct } from "./format";
import type { TweetRow } from "../types";
import type { Core } from "./load";

const ZONES: { key: Exclude<Zone, "normal">; label: string; hint: string; color: string; icon: IconName }[] = [
  { key: "star", label: "Stars", hint: "Much more views AND much more response than your typical post", color: "#ffd400", icon: "flame" },
  { key: "reach", label: "Reach only", hint: "Lots of views, little response: seen but not acted on", color: "#1d9bf0", icon: "eye" },
  { key: "gem", label: "Hidden gems", hint: "Few views, but far more response than your typical post", color: "#00ba7c", icon: "heart" },
];
const ZONE_COLOR: Record<Zone, string> = { star: "#ffd400", reach: "#1d9bf0", gem: "#00ba7c", normal: "#56626c" };
const CAT_ICON: Record<string, IconName> = { post: "pen", reply: "reply", quote: "quote", photo: "image", video: "video", link: "link", text: "hash" };

const W = 320;
const H = 230;
const L = 34;
const B = 20;
const T = 8;
const R = 8;

const logv = (v: number) => Math.log10(v + 1);
const fmtY = (v: number, m: YMetric) => (m === "rate" ? pct(v) : compact(v));
const lift = (v: number | null) => (v === null ? "–" : `×${v >= 10 ? Math.round(v) : v.toFixed(1)}`);

function Scatter({ res, metric, pick, hover }: { res: ReturnType<typeof outliers>; metric: YMetric; pick: Zone | null; hover: ReturnType<typeof useTweetHover> }) {
  const tip = useTip();
  const pts = res.points;
  const xs = pts.map((p) => logv(p.x));
  const ys = pts.map((p) => logv(metric === "rate" ? p.y * 1000 : p.y));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs, x0 + 0.1);
  const y0 = 0;
  const y1 = Math.max(...ys, 0.1);
  const sx = (v: number) => L + ((logv(v) - x0) / (x1 - x0)) * (W - L - R);
  const sy = (v: number) => H - B - (((logv(metric === "rate" ? v * 1000 : v)) - y0) / (y1 - y0)) * (H - B - T);
  const xTicks = [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7].filter((v) => logv(v) >= x0 && logv(v) <= x1);
  const yTicks = metric === "rate" ? [0.001, 0.01, 0.1].filter((v) => logv(v * 1000) <= y1) : [1, 10, 100, 1e3, 1e4, 1e5].filter((v) => logv(v) <= y1);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} class="chart scatter" role="img" aria-label="Views against response, one dot per post">
        {xTicks.map((v) => (
          <g key={`x${v}`}>
            <line x1={sx(v)} x2={sx(v)} y1={T} y2={H - B} class="grid" />
            <text x={sx(v)} y={H - 6} class="axis" text-anchor="middle">{compact(v)}</text>
          </g>
        ))}
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} class="grid" />
            <text x={L - 3} y={sy(v) + 3} class="axis" text-anchor="end">{fmtY(v, metric)}</text>
          </g>
        ))}
        <line x1={sx(Math.max(res.medX, 1))} x2={sx(Math.max(res.medX, 1))} y1={T} y2={H - B} class="med" />
        {res.medY > 0 && <line x1={L} x2={W - R} y1={sy(res.medY)} y2={sy(res.medY)} class="med" />}
        <text x={W - R} y={H - 6} class="axis" text-anchor="end" />
        {[...pts].sort((a, b) => Number(a.zone !== "normal") - Number(b.zone !== "normal")).map((p) => {
          const dim = pick !== null && p.zone !== pick;
          return (
            <circle
              key={p.t.id}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={p.zone === "normal" ? 3.2 : 4.6}
              fill={ZONE_COLOR[p.zone]}
              opacity={dim ? 0.12 : p.zone === "normal" ? 0.55 : 0.95}
              class="dot-p"
              {...hover.props(p.t)}
              onClick={() => window.open(`https://x.com/i/status/${p.t.id}`, "_blank")}
            />
          );
        })}
      </svg>
      <div class="axis-l"><span><Icon name="eye" size={11} /> views →</span><span>↑ {Y_METRICS.find((m) => m.key === metric)!.label.toLowerCase()}</span></div>
      {tip.box}
    </>
  );
}

function ZoneTable({ zone, points, metric, core, hover }: { zone: (typeof ZONES)[number]; points: OutlierPoint[]; metric: YMetric; core: Core; hover: ReturnType<typeof useTweetHover> }) {
  const rows = [...points].filter((p) => p.zone === zone.key).sort((a, b) => (zone.key === "reach" ? b.rx - a.rx : zone.key === "gem" ? b.ry - a.ry : b.rx * b.ry - a.rx * a.ry)).slice(0, 5);
  if (!rows.length) return null;
  return (
    <div class="ptable">
      <div class="ph" style={{ color: zone.color }} title={zone.hint}><Icon name={zone.icon} size={14} /> {zone.label} <span class="muted small">· {zone.hint}</span></div>
      <table class="tweets compact">
        <thead>
          <tr>
            <th>Post</th>
            <th class="num" title="Views"><Icon name="eye" size={12} title="Views" /></th>
            <th class="num" title={Y_METRICS.find((m) => m.key === metric)!.label}>{metric === "rate" ? <Icon name="percent" size={12} title="Rate" /> : <Icon name={metric === "likes" ? "heart" : metric === "replies" ? "reply" : metric === "retweets" ? "repeat" : metric === "quotes" ? "quote" : "bookmark"} size={12} title={metric} />}</th>
            <th class="num" title="Compared with your typical post">vs median</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.t.id} {...hover.props(p.t)}>
              <td class="content">
                <a href={`https://x.com/${core.handle ?? "i"}/status/${p.t.id}`} target="_blank" rel="noreferrer">
                  {p.t.kind !== "post" && <span class={`kind k-${p.t.kind}`}>{p.t.kind}</span>}
                  {firstLine(p.t.text) || "(no text)"}
                </a>
              </td>
              <td class="num">{compact(p.x)}</td>
              <td class="num">{fmtY(p.y, metric)}</td>
              <td class="num nowrap muted"><Icon name="eye" size={10} />{lift(p.rx)} <Icon name="activity" size={10} />{lift(p.ry)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Outliers({ core, tweets }: { core: Core; tweets: TweetRow[] }) {
  const [ft, setFt] = useState<FilterKey>("all");
  const [metric, setMetric] = useState<YMetric>("rate");
  const [pick, setPick] = useState<Zone | null>(null);
  const hover = useTweetHover(core.user, core.tz);
  const pool = useMemo(() => applyFilter(tweets, ft), [tweets, ft]);
  const res = useMemo(() => outliers(pool, metric), [pool, metric]);
  const cats = useMemo(() => categoryLift(tweets), [tweets]);

  return (
    <div>
      <div class="toolbar">
        <FilterPicker value={ft} onChange={setFt} />
        <select class="range" value={metric} onChange={(e) => setMetric((e.currentTarget as HTMLSelectElement).value as YMetric)} aria-label="Response metric">
          {Y_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>
      {res.points.length < 6 ? (
        <div class="muted pad">Needs at least 6 posts with view counts in this range{pool.length ? ` (found ${res.points.length})` : ""}. Pick a longer range, or press Load older in the Tweets tab.</div>
      ) : (
        <>
          <div class="chips">
            {ZONES.map((z) => (
              <button key={z.key} class={`chip ${pick === z.key ? "on" : ""}`} style={{ borderColor: pick === z.key ? z.color : undefined, color: z.color }} title={z.hint} onClick={() => setPick(pick === z.key ? null : z.key)}>
                <Icon name={z.icon} size={13} /> {z.label} <b>{res.counts[z.key]}</b>
              </button>
            ))}
          </div>
          <div class="card">
            <Scatter res={res} metric={metric} pick={pick} hover={hover} />
            <div class="muted small">Dashed lines are your median post. Hover a dot for the post, click to open it.</div>
          </div>
          {ZONES.filter((z) => !pick || pick === z.key).map((z) => (
            <ZoneTable key={z.key} zone={z} points={res.points} metric={metric} core={core} hover={hover} />
          ))}
        </>
      )}

      {cats.length > 0 && (
        <>
          <div class="sec-head"><span class="sec-t">What works</span><span class="legend small"><i class="dot" style={{ background: "#1d9bf0" }} /> views <i class="dot" style={{ background: "#00ba7c" }} /> engagement</span></div>
          <div class="card">
            {cats.map((c) => {
              const top = Math.max(2, ...cats.flatMap((x) => [x.liftViews ?? 0, x.liftRate ?? 0]));
              const w = (v: number | null) => `${Math.min(100, ((v ?? 0) / top) * 100)}%`;
              return (
                <div class="lift" key={c.key} title={`${CATEGORIES.find((x) => x.key === c.key)!.label}: ${c.n} posts · median ${compact(c.medViews)} views · ${pct(c.medRate)} engagement`}>
                  <span class="lift-l"><Icon name={CAT_ICON[c.key]} size={13} /> {CATEGORIES.find((x) => x.key === c.key)!.label}<span class="muted small"> {c.n}</span></span>
                  <div class="lift-b">
                    <div class="pb"><i style={{ width: w(c.liftViews), background: "#1d9bf0" }} /><span>{lift(c.liftViews)}</span></div>
                    <div class="pb"><i style={{ width: w(c.liftRate), background: "#00ba7c" }} /><span>{lift(c.liftRate)}</span></div>
                  </div>
                  <span class="lift-base" style={{ left: `calc(${((1 / top) * 100).toFixed(1)}% )` }} />
                </div>
              );
            })}
            <div class="muted small">×1 is your typical post. ×2 means twice as many views or twice the engagement rate.</div>
          </div>
        </>
      )}
      {hover.card}
    </div>
  );
}
