import { useMemo, useState } from "preact/hooks";
import { cadence } from "../metrics/cadence";
import { dailySeries, engagement, engagementRate, mediaVsText, ranked, type Feature, type RankBy, type SeriesKey } from "../metrics/engagement";
import { coverage, inWindow, windowFor, type RangeKey } from "../metrics/range";
import type { TweetRow } from "../types";
import { Heatmap } from "./Heatmap";
import { Icon, type IconName } from "./Icon";
import { LineChart, Sparkline } from "./LineChart";
import { CoverageBar } from "./ProfileHeader";
import { useTip } from "./Tip";
import { useTweetHover } from "./TweetCard";
import { WeekHourHeatmap } from "./WeekHourHeatmap";
import { YouAnd } from "./YouAnd";
import { WEEKDAYS_LONG, compact, firstLine, hourLabel, pct, timeStr } from "./format";
import type { ActiveTab } from "./hooks";
import type { Core } from "./load";

interface Props {
  core: Core;
  range: RangeKey;
  now: number;
  active: ActiveTab;
  untilMs: number | null;
}

const FEATURE: Record<Feature, { icon: IconName; label: string }> = {
  video: { icon: "video", label: "Video" },
  photo: { icon: "image", label: "Photo" },
  link: { icon: "link", label: "Link" },
  hashtag: { icon: "hash", label: "Hashtag" },
  emoji: { icon: "smile", label: "Emoji" },
};

const SERIES: { key: SeriesKey; icon: IconName; label: string; color: string }[] = [
  { key: "views", icon: "eye", label: "Impressions", color: "#1d9bf0" },
  { key: "likes", icon: "heart", label: "Likes", color: "#f91880" },
  { key: "retweets", icon: "repeat", label: "Reposts", color: "#00ba7c" },
  { key: "replies", icon: "reply", label: "Replies", color: "#7856ff" },
  { key: "bookmarks", icon: "bookmark", label: "Bookmarks", color: "#ffd400" },
];

/** A number with an icon above a one-word caption. */
function Tile({ icon, value, label, color, hint }: { icon: IconName; value: string | number; label: string; color?: string; hint?: string }) {
  return (
    <div class="tile" title={hint ?? label}>
      <Icon name={icon} size={15} class="tile-ico" />
      <div class="tile-v" style={color ? { color } : undefined}>{value}</div>
      <div class="tile-l">{label}</div>
    </div>
  );
}

/** Best/worst posts as a compact table; hover a row for the post as it looks on X. */
function PostsTable({ title, icon, tweets, by, core, now }: { title: string; icon: IconName; tweets: TweetRow[]; by: RankBy; core: Core; now: number }) {
  const hover = useTweetHover(core.user, core.tz);
  if (!tweets.length) return null;
  return (
    <div class="ptable">
      <div class="ph"><Icon name={icon} size={14} /> {title}</div>
      <table class="tweets compact">
        <thead>
          <tr>
            <th>Post</th>
            <th title="Posted"><Icon name="clock" size={12} title="Posted" /></th>
            <th class="num" title="Views"><Icon name="eye" size={12} title="Views" /></th>
            <th class="num" title="Likes"><Icon name="heart" size={12} title="Likes" /></th>
            <th class="num" title="Engagement rate"><Icon name="percent" size={12} title="Engagement rate" /></th>
          </tr>
        </thead>
        <tbody>
          {tweets.map((t) => (
            <tr key={t.id} {...hover.props(t)}>
              <td class="content">
                <a href={`https://x.com/${core.handle ?? ""}/status/${t.id}`} target="_blank" rel="noreferrer">{firstLine(t.text) || "(no text)"}</a>
              </td>
              <td class="nowrap muted" title={t.createdAt ? timeStr(t.createdAt, core.tz) : ""}>{t.createdAt ? timeStr(t.createdAt, core.tz).replace(/, /, " · ") : "–"}</td>
              <td class={`num ${by === "views" ? "hl" : ""}`}>{compact(t.views)}</td>
              <td class="num">{compact(t.likes)}</td>
              <td class={`num ${by === "rate" ? "hl" : ""}`}>{pct(engagementRate(t))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hover.card}
      <span hidden>{now}</span>
    </div>
  );
}

/** Two bars on one scale: with the feature (color) and without (grey). */
function PairBar({ icon, a, b, color }: { icon: IconName; a: number | null; b: number | null; color: string }) {
  const max = Math.max(1, a ?? 0, b ?? 0);
  return (
    <div class="pair">
      <Icon name={icon} size={11} />
      <div class="pair-bars">
        <div class="pb"><i style={{ width: `${((a ?? 0) / max) * 100}%`, background: color }} /><span>{a === null ? "–" : compact(a)}</span></div>
        <div class="pb"><i style={{ width: `${((b ?? 0) / max) * 100}%`, background: "#56626c" }} /><span>{b === null ? "–" : compact(b)}</span></div>
      </div>
    </div>
  );
}

export function Overview({ core, range, now, active, untilMs }: Props) {
  const { tz, tweets } = core;
  const win = useMemo(() => windowFor(range, tweets, tz, now), [range, tweets, tz, now]);
  const inRange = useMemo(() => tweets.filter((t) => inWindow(t, win, tz)), [tweets, win, tz]);
  const cad = useMemo(() => cadence(tweets, win, tz), [tweets, win, tz]);
  const eng = useMemo(() => engagement(inRange), [inRange]);
  const cov = useMemo(() => coverage(tweets, range, tz, now), [tweets, range, tz, now]);
  const [rankBy, setRankBy] = useState<RankBy>("views");
  const [metric, setMetric] = useState<SeriesKey>("views");
  const splitTip = useTip();

  const days = useMemo(() => dailySeries(inRange, win, tz, "views").map((d) => d.day), [inRange, win, tz]);
  const series = (key: SeriesKey) => dailySeries(inRange, win, tz, key);
  const m = SERIES.find((s) => s.key === metric)!;

  const split = cad.split;
  const splitTotal = Math.max(1, cad.total);
  const splitItems = [
    { k: "post", label: "Originals", n: split.post },
    { k: "reply", label: "Replies", n: split.reply },
    { k: "quote", label: "Quotes", n: split.quote },
    { k: "retweet", label: "Reposts", n: split.retweet },
  ];

  const mixItems: { key: "likes" | "retweets" | "replies" | "bookmarks"; share: number }[] = [
    { key: "likes", share: eng.mix.likes },
    { key: "retweets", share: eng.mix.retweets },
    { key: "replies", share: eng.mix.replies },
    { key: "bookmarks", share: eng.mix.bookmarks },
  ];

  return (
    <div>
      <CoverageBar cov={cov} handle={core.handle} tz={tz} active={active} untilMs={untilMs} />
      {!core.isMe && core.user && core.me && <YouAnd core={core} />}

      {cov.count > 0 && (
        <>
          <div class="tiles">
            <Tile icon="pen" value={cad.total} label="Posts" hint={`${cad.activeDays} of ${cad.totalDays} days active`} color="var(--accent)" />
            <Tile icon="zap" value={cad.avgPerDay >= 10 ? Math.round(cad.avgPerDay) : cad.avgPerDay.toFixed(1)} label="Per day" />
            <Tile icon="flame" value={`${cad.longestStreak}d`} label="Streak" hint="Longest run of days with a post" color="#ff7a00" />
            <Tile icon="calendar" value={cad.busiestWeekday === null ? "–" : WEEKDAYS_LONG[cad.busiestWeekday].slice(0, 3)} label="Best day" hint="Day of the week with the most posts" />
            <Tile icon="clock" value={cad.busiestHour === null ? "–" : hourLabel(cad.busiestHour)} label="Best hour" hint={`Most posts around this hour (${tz})`} />
            <Tile icon="activity" value={`${cad.activeDays}/${cad.totalDays}`} label="Active days" />
          </div>

          <div class="card">
            <div class="split" onPointerLeave={splitTip.hide}>
              {splitItems.map((s) => (
                <span key={s.k} class={`seg seg-${s.k}`} style={{ width: `${(s.n / splitTotal) * 100}%` }} onPointerMove={(e) => splitTip.show(e, <><b>{s.n}</b> {s.label}<div class="muted">{pct(s.n / splitTotal, 0)}</div></>)} />
              ))}
            </div>
            <div class="legend">
              {splitItems.map((s) => (
                <span key={s.k}><i class={`dot seg-${s.k}`} /> {s.label} <b>{s.n}</b></span>
              ))}
            </div>
            {splitTip.box}
          </div>

          <div class="card">
            <Heatmap days={cad.days} perDay={cad.perDay} />
          </div>
          <div class="card">
            <WeekHourHeatmap matrix={cad.matrix} />
          </div>

          {eng.posts === 0 ? (
            <div class="muted pad">No original posts in this range.</div>
          ) : (
            <>
              <div class="tiles two">
                <Tile icon="eye" value={compact(eng.views.total)} label="Impressions" hint={`avg ${compact(eng.views.avg)} · median ${compact(eng.views.median)} per post`} color="#1d9bf0" />
                <Tile icon="percent" value={pct(eng.avgRate)} label="Engagement" hint="Average engagement rate per post (interactions / views)" color="#00ba7c" />
              </div>

              <div class="card">
                <div class="chips" role="tablist" aria-label="Metric">
                  {SERIES.map((s) => (
                    <button key={s.key} class={`chip ${metric === s.key ? "on" : ""}`} style={metric === s.key ? { borderColor: s.color, color: s.color } : undefined} onClick={() => setMetric(s.key)} title={s.label} aria-label={s.label} aria-pressed={metric === s.key}>
                      <Icon name={s.icon} size={14} />
                      <span>{compact(s.key === "views" ? eng.views.total : eng[s.key].total)}</span>
                    </button>
                  ))}
                </div>
                <LineChart data={series(metric)} color={m.color} unit={m.label.toLowerCase()} />
              </div>

              <div class="card mix">
                <div class="mixbar">
                  {mixItems.map((x) => {
                    const s = SERIES.find((q) => q.key === x.key)!;
                    return <span key={x.key} style={{ width: `${x.share * 100}%`, background: s.color }} title={`${s.label} ${pct(x.share, 0)}`} />;
                  })}
                </div>
                <div class="legend">
                  {mixItems.map((x) => {
                    const s = SERIES.find((q) => q.key === x.key)!;
                    return (
                      <span key={x.key} style={{ color: s.color }} title={`${s.label}: ${pct(x.share, 0)} of engagement`}>
                        <Icon name={s.icon} size={12} /> <b>{pct(x.share, 0)}</b>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div class="sec-head">
                <span class="sec-t">Best and worst posts</span>
                <select class="mini" value={rankBy} onChange={(e) => setRankBy((e.currentTarget as HTMLSelectElement).value as RankBy)} aria-label="Rank by">
                  <option value="views">By views</option>
                  <option value="rate">By engagement rate</option>
                </select>
              </div>
              <div class="card">
                <PostsTable title="Best" icon="up" tweets={ranked(inRange, rankBy, "best")} by={rankBy} core={core} now={now} />
                <PostsTable title="Worst" icon="down" tweets={ranked(inRange, rankBy, "worst")} by={rankBy} core={core} now={now} />
                {ranked(inRange, rankBy, "best").length === 0 && <div class="muted small">No posts with view counts yet.</div>}
              </div>

              <div class="sec-head">
                <span class="sec-t">With vs without</span>
                <span class="legend small"><i class="dot" style={{ background: "var(--accent)" }} /> with <i class="dot" style={{ background: "#56626c" }} /> without</span>
              </div>
              <div class="tiles feat">
                {mediaVsText(inRange).map((f) => (
                  <div key={f.feature} class="tile ft" title={`${FEATURE[f.feature].label}: ${f.withCount} posts`}>
                    <div class="ft-top">
                      <Icon name={FEATURE[f.feature].icon} size={14} />
                      <span class="tile-v">{pct(f.withPct, 0)}</span>
                    </div>
                    <PairBar icon="eye" a={f.avgViewsWith} b={f.avgViewsWithout} color="#1d9bf0" />
                    <PairBar icon="heart" a={f.avgLikesWith} b={f.avgLikesWithout} color="#f91880" />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
