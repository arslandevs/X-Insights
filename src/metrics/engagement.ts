import type { TweetRow } from "../types";
import { dayKey, eachDay } from "../tz";
import type { Window } from "./range";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);
export function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Engagement rate = (likes + replies + retweets + quotes + bookmarks) / views. Null when views are missing or zero. */
export function engagementRate(t: TweetRow): number | null {
  if (!t.views) return null;
  return (t.likes + t.replies + t.retweets + t.quotes + t.bookmarks) / t.views;
}

/** The user's own posts only: retweets of other people's posts are activity, not engagement. */
export const ownPosts = (tweets: TweetRow[]) => tweets.filter((t) => t.kind !== "retweet");

export interface Stat {
  total: number;
  avg: number | null;
  median: number | null;
}
const stat = (xs: number[]): Stat => ({ total: sum(xs), avg: avg(xs), median: median(xs) });

export interface Engagement {
  posts: number;
  views: Stat; // only posts where X reported views
  likes: Stat;
  replies: Stat;
  retweets: Stat;
  quotes: Stat;
  bookmarks: Stat;
  avgRate: number | null;
  /** share of each engagement type, 0..1 (sums to 1 when there is any engagement) */
  mix: { likes: number; replies: number; retweets: number; quotes: number; bookmarks: number };
}

export function engagement(tweets: TweetRow[]): Engagement {
  const t = ownPosts(tweets);
  const likes = sum(t.map((x) => x.likes));
  const replies = sum(t.map((x) => x.replies));
  const retweets = sum(t.map((x) => x.retweets));
  const quotes = sum(t.map((x) => x.quotes));
  const bookmarks = sum(t.map((x) => x.bookmarks));
  const all = likes + replies + retweets + quotes + bookmarks;
  const share = (n: number) => (all ? n / all : 0);
  const rates = t.map(engagementRate).filter((x): x is number => x !== null);
  return {
    posts: t.length,
    views: stat(t.map((x) => x.views).filter((x): x is number => x !== null)),
    likes: stat(t.map((x) => x.likes)),
    replies: stat(t.map((x) => x.replies)),
    retweets: stat(t.map((x) => x.retweets)),
    quotes: stat(t.map((x) => x.quotes)),
    bookmarks: stat(t.map((x) => x.bookmarks)),
    avgRate: avg(rates),
    mix: { likes: share(likes), replies: share(replies), retweets: share(retweets), quotes: share(quotes), bookmarks: share(bookmarks) },
  };
}

export type SeriesKey = "views" | "likes" | "replies" | "retweets" | "bookmarks";

/** Per-day sums of a metric (posts attributed to the day they were published). */
export function dailySeries(tweets: TweetRow[], w: Window, tz: string, key: SeriesKey): { day: string; value: number }[] {
  const days = eachDay(w.from, w.to);
  const acc: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
  for (const t of ownPosts(tweets)) {
    if (t.createdAt === null) continue;
    const d = dayKey(t.createdAt, tz);
    if (d < w.from || d > w.to) continue;
    acc[d] += t[key] ?? 0;
  }
  return days.map((d) => ({ day: d, value: acc[d] }));
}

export type RankBy = "views" | "rate" | "engagement";
export const interactions = (t: TweetRow) => t.likes + t.replies + t.retweets + t.quotes + t.bookmarks;
const score = (t: TweetRow, by: RankBy) => (by === "views" ? t.views : by === "rate" ? engagementRate(t) : interactions(t));

/** Rate is noisy on tiny reach (1 like on 30 views is 3%). Only posts with at least half the median reach compete, and never fewer than 100 views. */
export function rateFloor(tweets: TweetRow[]): number {
  const m = median(ownPosts(tweets).map((t) => t.views).filter((v): v is number => v !== null && v > 0));
  return Math.max(100, (m ?? 0) / 2);
}

/** Best or worst posts. Posts without a score (hidden views) are left out rather than ranked as zero. */
export function ranked(tweets: TweetRow[], by: RankBy, dir: "best" | "worst", n = 5, pool: TweetRow[] = tweets): TweetRow[] {
  const floor = by === "rate" ? rateFloor(pool) : 0;
  const scored = ownPosts(tweets).filter((t) => score(t, by) !== null && (by !== "rate" || (t.views ?? 0) >= floor));
  scored.sort((a, b) => (dir === "best" ? score(b, by)! - score(a, by)! : score(a, by)! - score(b, by)!));
  return scored.slice(0, n);
}

export type Feature = "video" | "photo" | "link" | "hashtag" | "emoji";
export interface FeatureCompare {
  feature: Feature;
  withCount: number;
  withPct: number;
  avgViewsWith: number | null;
  avgViewsWithout: number | null;
  avgLikesWith: number | null;
  avgLikesWithout: number | null;
}

const has: Record<Feature, (t: TweetRow) => boolean> = {
  video: (t) => t.hasVideo,
  photo: (t) => t.hasPhoto,
  link: (t) => t.hasLink,
  hashtag: (t) => t.hasHashtag,
  emoji: (t) => t.emojiCount > 0,
};

export function mediaVsText(tweets: TweetRow[]): FeatureCompare[] {
  const t = ownPosts(tweets);
  const views = (xs: TweetRow[]) => avg(xs.map((x) => x.views).filter((v): v is number => v !== null));
  return (Object.keys(has) as Feature[]).map((feature) => {
    const w = t.filter(has[feature]);
    const wo = t.filter((x) => !has[feature](x));
    return {
      feature,
      withCount: w.length,
      withPct: t.length ? w.length / t.length : 0,
      avgViewsWith: views(w),
      avgViewsWithout: views(wo),
      avgLikesWith: avg(w.map((x) => x.likes)),
      avgLikesWithout: avg(wo.map((x) => x.likes)),
    };
  });
}
