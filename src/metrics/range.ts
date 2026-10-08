import type { TweetRow } from "../types";
import { addDays, dayDiff, dayKey } from "../tz";

export type RangeKey = "7" | "30" | "90" | "all";
export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "all", label: "All captured" },
];

export interface Window {
  /** inclusive day keys (YYYY-MM-DD in the chosen timezone) */
  from: string;
  to: string;
  days: number;
}

/** The day window for a range. Fixed ranges end today; "all" runs from the first to the last captured post. */
export function windowFor(range: RangeKey, tweets: TweetRow[], tz: string, now: number): Window {
  const today = dayKey(now, tz);
  if (range !== "all") {
    const n = Number(range);
    return { from: addDays(today, -(n - 1)), to: today, days: n };
  }
  const times = tweets.map((t) => t.createdAt).filter((x): x is number => x !== null);
  if (!times.length) return { from: today, to: today, days: 1 };
  const from = dayKey(Math.min(...times), tz);
  const to = dayKey(Math.max(...times), tz);
  return { from, to, days: dayDiff(from, to) + 1 };
}

export function inWindow(t: TweetRow, w: Window, tz: string): boolean {
  if (t.createdAt === null) return false;
  const k = dayKey(t.createdAt, tz);
  return k >= w.from && k <= w.to;
}

export interface Coverage {
  count: number;
  earliest: number | null;
  latest: number | null;
  /** The chosen range reaches back further than what was captured. */
  widerThanCaptured: boolean;
}

export function coverage(allTweets: TweetRow[], range: RangeKey, tz: string, now: number): Coverage {
  const times = allTweets.map((t) => t.createdAt).filter((x): x is number => x !== null);
  const earliest = times.length ? Math.min(...times) : null;
  const latest = times.length ? Math.max(...times) : null;
  let wider = false;
  if (range !== "all" && earliest !== null) wider = dayKey(earliest, tz) > addDays(dayKey(now, tz), -(Number(range) - 1));
  return { count: allTweets.length, earliest, latest, widerThanCaptured: wider };
}
