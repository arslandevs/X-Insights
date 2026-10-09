import type { TweetRow } from "../types";
import { engagementRate, median, ownPosts } from "./engagement";

export type YMetric = "rate" | "likes" | "replies" | "retweets" | "quotes" | "bookmarks";
export const Y_METRICS: { key: YMetric; label: string }[] = [
  { key: "rate", label: "Engagement rate" },
  { key: "likes", label: "Likes" },
  { key: "replies", label: "Replies" },
  { key: "retweets", label: "Reposts" },
  { key: "quotes", label: "Quotes" },
  { key: "bookmarks", label: "Bookmarks" },
];

/**
 * star  = far more views AND far more response than your median post
 * reach = far more views, but little response (people saw it and did not react)
 * gem   = average or fewer views, but far more response (it resonated with the few who saw it)
 */
export type Zone = "star" | "reach" | "gem" | "normal";

export interface OutlierPoint {
  t: TweetRow;
  /** views */
  x: number;
  /** the chosen response metric */
  y: number;
  /** x and y as multiples of the median post */
  rx: number;
  ry: number;
  zone: Zone;
}

export interface OutlierResult {
  points: OutlierPoint[];
  medX: number;
  medY: number;
  counts: Record<Zone, number>;
}

export const HIGH = 2;
export const LOW = 0.6;

const yOf = (t: TweetRow, m: YMetric): number | null => (m === "rate" ? engagementRate(t) : (t[m] as number));

/** Outliers relative to the median post in the same set. Posts without view counts cannot be placed and are left out. */
export function outliers(tweets: TweetRow[], metric: YMetric): OutlierResult {
  const base = ownPosts(tweets)
    .filter((t) => (t.views ?? 0) > 0)
    .map((t) => ({ t, x: t.views as number, y: yOf(t, metric) }))
    .filter((p): p is { t: TweetRow; x: number; y: number } => p.y !== null);
  const medX = median(base.map((p) => p.x)) ?? 0;
  const medY = median(base.map((p) => p.y)) ?? 0;
  const floorY = metric === "rate" ? Math.max(medY, 0.001) : Math.max(medY, 1);
  const counts: Record<Zone, number> = { star: 0, reach: 0, gem: 0, normal: 0 };
  const points = base.map((p) => {
    const rx = medX ? p.x / medX : 1;
    const ry = p.y / floorY;
    const zone: Zone = rx >= HIGH && ry >= HIGH ? "star" : rx >= HIGH && ry <= LOW ? "reach" : rx <= 1 && ry >= HIGH ? "gem" : "normal";
    counts[zone]++;
    return { ...p, rx, ry, zone };
  });
  return { points, medX, medY, counts };
}

export type Category = "post" | "reply" | "quote" | "photo" | "video" | "link" | "text";
export const CATEGORIES: { key: Category; label: string }[] = [
  { key: "post", label: "Posts" },
  { key: "reply", label: "Replies" },
  { key: "quote", label: "Quotes" },
  { key: "photo", label: "Photo" },
  { key: "video", label: "Video" },
  { key: "link", label: "Link" },
  { key: "text", label: "Text only" },
];

const IN: Record<Category, (t: TweetRow) => boolean> = {
  post: (t) => t.kind === "post",
  reply: (t) => t.kind === "reply",
  quote: (t) => t.kind === "quote",
  photo: (t) => t.hasPhoto,
  video: (t) => t.hasVideo,
  link: (t) => t.hasLink,
  text: (t) => !t.hasMedia && !t.hasLink,
};

export interface CategoryLift {
  key: Category;
  n: number;
  medViews: number | null;
  medRate: number | null;
  /** median views / overall median views (1 = same as your typical post) */
  liftViews: number | null;
  liftRate: number | null;
}

/** How each kind of content performs against your typical post. Needs a few posts per kind to say anything. */
export function categoryLift(tweets: TweetRow[], minPosts = 3): CategoryLift[] {
  const all = ownPosts(tweets);
  const medV = median(all.map((t) => t.views).filter((v): v is number => v !== null && v > 0));
  const medR = median(all.map(engagementRate).filter((v): v is number => v !== null));
  const out: CategoryLift[] = [];
  for (const c of CATEGORIES) {
    const set = all.filter(IN[c.key]);
    if (set.length < minPosts) continue;
    const v = median(set.map((t) => t.views).filter((x): x is number => x !== null && x > 0));
    const r = median(set.map(engagementRate).filter((x): x is number => x !== null));
    out.push({ key: c.key, n: set.length, medViews: v, medRate: r, liftViews: v !== null && medV ? v / medV : null, liftRate: r !== null && medR ? r / medR : null });
  }
  return out;
}
