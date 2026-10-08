export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, "")}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (a >= 1e4) return `${Math.round(n / 1e3)}K`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export const pct = (x: number | null | undefined, digits = 1) => (x === null || x === undefined || !Number.isFinite(x) ? "n/a" : `${(x * 100).toFixed(digits)}%`);

export function dateStr(ms: number | null | undefined, tz?: string) {
  if (!ms) return "–";
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: tz && tz !== "local" ? tz : undefined });
}

export function timeStr(ms: number, tz?: string) {
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz && tz !== "local" ? tz : undefined });
}

/** Relative for the last week, a date after that. */
export function when(ms: number | null, now = Date.now(), tz?: string) {
  if (!ms) return "–";
  const s = Math.round((now - ms) / 1000);
  if (s < 0) return dateStr(ms, tz);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)}d`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: new Date(ms).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric", timeZone: tz && tz !== "local" ? tz : undefined });
}

export function ageStr(createdAt: number | null, now = Date.now()) {
  if (!createdAt) return "–";
  const months = Math.max(0, Math.floor((now - createdAt) / (30.4375 * 864e5)));
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y ? `${y}y${m ? ` ${m}m` : ""}` : `${m}m`;
}

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

import { decodeEntities } from "../parse/tweet";

/** Old rows were stored HTML-escaped; decode again so they read the same as new ones. */
export const cleanText = (s: string) => decodeEntities(s);
/** First line only, for one-line table cells. */
export const firstLine = (s: string) => cleanText(s).split(/\r?\n/).find((l) => l.trim()) ?.trim() ?? "";
/** Full text for the tweet card: unescaped, without the trailing t.co link X adds for attached media. */
export const cardText = (s: string, hasMedia: boolean) => {
  const t = cleanText(s);
  return hasMedia ? t.replace(/\s*https:\/\/t\.co\/\w+\s*$/, "") : t;
};
