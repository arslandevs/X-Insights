import { useMemo, useState } from "preact/hooks";
import { cadence } from "../metrics/cadence";
import { dailySeries, engagement, engagementRate, mediaVsText, ranked, type Feature, type RankBy, type SeriesKey } from "../metrics/engagement";
import { coverage, inWindow, windowFor, type RangeKey } from "../metrics/range";
import type { TweetRow } from "../types";
import { Card } from "./Card";
import { Heatmap } from "./Heatmap";
import { LineChart, Sparkline } from "./LineChart";
import { CoverageBanner, ProfileHeader } from "./ProfileHeader";
import { WeekHourHeatmap } from "./WeekHourHeatmap";
import { YouAnd } from "./YouAnd";
import { WEEKDAYS_LONG, compact, hourLabel, pct } from "./format";
import type { Core } from "./load";

interface Props {
  core: Core;
  range: RangeKey;
  now: number;
}

const FEATURE_LABEL: Record<Feature, string> = { video: "Video", photo: "Photo", link: "Link", hashtag: "Hashtag", emoji: "Emoji" };

function PostRow({ t, handle, metric }: { t: TweetRow; handle: string; metric?: string }) {
  return (
    <a class="post-row" href={`https://x.com/${handle}/status/${t.id}`} target="_blank" rel="noreferrer" title={t.text}>
      <span class="post-text">{t.text || "(no text)"}</span>
      <span class="muted nowrap">{metric}</span>
    </a>
  );
}

const topBy = (tweets: TweetRow[], key: SeriesKey) =>
  tweets
    .filter((t) => t.kind !== "retweet")
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .slice(0, 5);

export function Overview({ core, range, now }: Props) {
  const { tz, tweets, handle } = core;
  const win = useMemo(() => windowFor(range, tweets, tz, now), [range, tweets, tz, now]);
  const inRange = useMemo(() => tweets.filter((t) => inWindow(t, win, tz)), [tweets, win, tz]);
  const cad = useMemo(() => cadence(tweets, win, tz), [tweets, win, tz]);
  const eng = useMemo(() => engagement(inRange), [inRange]);
  const cov = useMemo(() => coverage(tweets, range, tz, now), [tweets, range, tz, now]);
  const [rankBy, setRankBy] = useState<RankBy>("views");

  const series = (key: SeriesKey) => dailySeries(inRange, win, tz, key);
  const views = series("views");
  const h = handle ?? "";

  const split = cad.split;
  const splitTotal = Math.max(1, cad.total);
  const splitItems = [
    { k: "post", label: "Originals", n: split.post },
    { k: "reply", label: "Replies", n: split.reply },
    { k: "quote", label: "Quotes", n: split.quote },
    { k: "retweet", label: "Retweets", n: split.retweet },
  ];

  const typeCards: { key: SeriesKey; label: string; total: number; share: number; color: string }[] = [
    { key: "likes", label: "Likes", total: eng.likes.total, share: eng.mix.likes, color: "#f91880" },
    { key: "replies", label: "Replies", total: eng.replies.total, share: eng.mix.replies, color: "#1d9bf0" },
    { key: "retweets", label: "Retweets", total: eng.retweets.total, share: eng.mix.retweets, color: "#00ba7c" },
    { key: "bookmarks", label: "Bookmarks", total: eng.bookmarks.total, share: eng.mix.bookmarks, color: "#ffd400" },
  ];

  return (
    <div>
      <ProfileHeader core={core} now={now} />
      <CoverageBanner cov={cov} range={range} handle={handle} tz={tz} />
      {!core.isMe && core.user && core.me && <YouAnd core={core} />}

      {cov.count > 0 && (
        <>
          <h2>Posting cadence</h2>
          <div class="grid3">
            <Card title="Activity" value={cad.total} sub={`${cad.activeDays} of ${cad.totalDays} days active`} />
            <Card title="Per day" value={cad.avgPerDay >= 10 ? Math.round(cad.avgPerDay) : cad.avgPerDay.toFixed(1)} sub="average" />
            <Card title="Longest streak" value={`${cad.longestStreak}d`} sub="days in a row" />
          </div>
          <div class="grid2">
            <Card title="Busiest day" value={cad.busiestWeekday === null ? "–" : WEEKDAYS_LONG[cad.busiestWeekday]} />
            <Card title="Busiest hour" value={cad.busiestHour === null ? "–" : hourLabel(cad.busiestHour)} sub={tz} />
          </div>
          <div class="card">
            <div class="muted">Originals vs replies</div>
            <div class="split">
              {splitItems.map((s) => (
                <span key={s.k} class={`seg seg-${s.k}`} style={{ width: `${(s.n / splitTotal) * 100}%` }} title={`${s.label}: ${s.n}`} />
              ))}
            </div>
            <div class="legend">
              {splitItems.map((s) => (
                <span key={s.k}>
                  <i class={`dot seg-${s.k}`} /> {s.label} {s.n} <span class="muted">({pct(s.n / splitTotal, 0)})</span>
                </span>
              ))}
            </div>
          </div>
          <div class="card">
            <div class="muted">Daily activity</div>
            <Heatmap days={cad.days} perDay={cad.perDay} />
          </div>
          <div class="card">
            <div class="muted">When they post (weekday and hour, {tz})</div>
            <WeekHourHeatmap matrix={cad.matrix} />
          </div>

          <h2>Engagement</h2>
          {eng.posts === 0 ? (
            <div class="muted pad">No original posts in this range.</div>
          ) : (
            <>
              <div class="grid2">
                <Card
                  title="Impressions"
                  value={compact(eng.views.total)}
                  sub={`avg ${compact(eng.views.avg)} · median ${compact(eng.views.median)} per post`}
                  details={ranked(inRange, "views", "best", 5).map((t) => <PostRow key={t.id} t={t} handle={h} metric={compact(t.views)} />)}
                />
                <Card
                  title="Engagement rate"
                  value={pct(eng.avgRate)}
                  sub="average per post, of views"
                  details={ranked(inRange, "rate", "best", 5).map((t) => <PostRow key={t.id} t={t} handle={h} metric={pct(engagementRate(t))} />)}
                />
              </div>
              <div class="card">
                <div class="muted">Impressions per day</div>
                <LineChart data={views} />
              </div>
              <div class="grid2">
                {typeCards.map((c) => {
                  const daily = series(c.key).map((x) => x.value);
                  const stat = eng[c.key as "likes" | "replies" | "retweets" | "bookmarks"];
                  return (
                    <Card
                      key={c.key}
                      title={c.label}
                      value={compact(c.total)}
                      sub={`${pct(c.share, 0)} of engagement · avg ${compact(stat.avg)}`}
                      details={topBy(inRange, c.key).map((t) => <PostRow key={t.id} t={t} handle={h} metric={compact(t[c.key] as number)} />)}
                    >
                      <Sparkline data={daily} color={c.color} />
                    </Card>
                  );
                })}
              </div>

              <div class="card">
                <div class="row-gap">
                  <span class="muted">Best and worst posts</span>
                  <select class="mini" value={rankBy} onChange={(e) => setRankBy((e.currentTarget as HTMLSelectElement).value as RankBy)} aria-label="Rank by">
                    <option value="views">By views</option>
                    <option value="rate">By engagement rate</option>
                  </select>
                </div>
                <div class="muted small">Best 5</div>
                {ranked(inRange, rankBy, "best").map((t) => (
                  <PostRow key={t.id} t={t} handle={h} metric={rankBy === "views" ? compact(t.views) : pct(engagementRate(t))} />
                ))}
                <div class="muted small spaced">Worst 5</div>
                {ranked(inRange, rankBy, "worst").map((t) => (
                  <PostRow key={t.id} t={t} handle={h} metric={rankBy === "views" ? compact(t.views) : pct(engagementRate(t))} />
                ))}
                {ranked(inRange, rankBy, "best").length === 0 && <div class="muted small">No posts with view counts yet.</div>}
              </div>

              <h2>Media vs text</h2>
              <div class="grid2">
                {mediaVsText(inRange).map((f) => (
                  <Card key={f.feature} title={FEATURE_LABEL[f.feature]} value={pct(f.withPct, 0)} sub="of posts">
                    <div class="small">
                      Views with <b>{compact(f.avgViewsWith)}</b> · without <b>{compact(f.avgViewsWithout)}</b>
                    </div>
                    <div class="small">
                      Likes with <b>{compact(f.avgLikesWith)}</b> · without <b>{compact(f.avgLikesWithout)}</b>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
