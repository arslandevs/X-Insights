import type { TweetRow } from "../types";
import { addDays, eachDay, parts, dayKey } from "../tz";
import type { Window } from "./range";

export interface Cadence {
  days: string[];
  perDay: Record<string, number>;
  total: number;
  avgPerDay: number;
  activeDays: number;
  totalDays: number;
  longestStreak: number;
  busiestWeekday: number | null;
  busiestHour: number | null;
  /** [weekday 0=Sun][hour 0-23] */
  matrix: number[][];
  split: { post: number; reply: number; quote: number; retweet: number };
}

/** All of a user's activity (posts, replies, quotes and retweets) inside the window, bucketed in the chosen timezone. */
export function cadence(tweets: TweetRow[], w: Window, tz: string): Cadence {
  const days = eachDay(w.from, w.to);
  const perDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
  const matrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const split = { post: 0, reply: 0, quote: 0, retweet: 0 };
  let total = 0;
  for (const t of tweets) {
    if (t.createdAt === null) continue;
    const p = parts(t.createdAt, tz);
    const key = dayKey(t.createdAt, tz);
    if (key < w.from || key > w.to) continue;
    perDay[key]++;
    matrix[p.wd][p.h]++;
    split[t.kind]++;
    total++;
  }

  let activeDays = 0;
  let longest = 0;
  let run = 0;
  for (const d of days) {
    if (perDay[d] > 0) {
      activeDays++;
      run++;
      if (run > longest) longest = run;
    } else run = 0;
  }

  const wdTotals = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const hourTotals = Array.from({ length: 24 }, (_, h) => matrix.reduce((a, row) => a + row[h], 0));
  const argmax = (xs: number[]) => (Math.max(...xs) > 0 ? xs.indexOf(Math.max(...xs)) : null);

  return {
    days,
    perDay,
    total,
    avgPerDay: days.length ? total / days.length : 0,
    activeDays,
    totalDays: days.length,
    longestStreak: longest,
    busiestWeekday: argmax(wdTotals),
    busiestHour: argmax(hourTotals),
    matrix,
    split,
  };
}

export { addDays };
