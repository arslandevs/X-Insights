export type Obj = Record<string, any>;

export const asObj = (v: unknown): Obj | undefined => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : undefined);

export const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

export const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

/** "Wed Oct 08 12:00:00 +0000 2025" -> epoch ms (UTC). */
export const parseDate = (v: unknown): number | null => {
  const s = str(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
};

/** First defined, non-null value. Used for "try the new path, then the old one" accessors. */
export const first = <T>(...vals: (T | null | undefined)[]): T | null => {
  for (const v of vals) if (v !== null && v !== undefined) return v;
  return null;
};
