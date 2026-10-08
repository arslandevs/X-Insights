// Day, weekday and hour in a chosen timezone. Day keys are "YYYY-MM-DD" strings so they sort and compare as text.
const cache = new Map<string, Intl.DateTimeFormat>();
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const resolveTz = (tz: string): string => (tz === "local" || !tz ? Intl.DateTimeFormat().resolvedOptions().timeZone : tz);

function formatter(tz: string) {
  const key = resolveTz(tz);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: key, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", weekday: "short" });
    cache.set(key, f);
  }
  return f;
}

export interface Parts {
  y: number;
  m: number;
  d: number;
  wd: number; // 0 = Sunday
  h: number;
}

export function parts(ms: number, tz: string): Parts {
  const o: Record<string, string> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, wd: WD.indexOf(o.weekday), h: +o.hour % 24 };
}

const pad = (n: number) => String(n).padStart(2, "0");
export const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
export const dayKey = (ms: number, tz: string) => {
  const p = parts(ms, tz);
  return keyOf(p.y, p.m, p.d);
};

const utcOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const addDays = (key: string, n: number) => {
  const dt = new Date(utcOf(key) + n * 864e5);
  return keyOf(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
};
export const dayDiff = (a: string, b: string) => Math.round((utcOf(b) - utcOf(a)) / 864e5);
export const weekdayOf = (key: string) => new Date(utcOf(key)).getUTCDay();
export const weekdayName = (wd: number) => WD[wd];

/** Every day key from `from` to `to`, inclusive. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from, i = 0; k <= to && i < 20000; k = addDays(k, 1), i++) out.push(k);
  return out;
}

export function prettyDay(key: string) {
  return new Date(utcOf(key)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
