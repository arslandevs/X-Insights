import { describe, expect, it } from "vitest";
import { categoryLift, outliers } from "../src/metrics/outliers";
import { T } from "./helpers";

const mk = (id: string, views: number, likes: number, extra: object = {}) => T({ id, views, likes, replies: 0, retweets: 0, quotes: 0, bookmarks: 0, kind: "post", ...extra });

describe("outliers", () => {
  const set = [mk("a", 1000, 10), mk("b", 1100, 11), mk("c", 900, 9), mk("d", 1000, 10), mk("e", 1200, 12),
    mk("star", 10000, 400), mk("reach", 12000, 1), mk("gem", 300, 80)];
  it("finds high-reach stars, reach-without-response and low-reach gems", () => {
    const r = outliers(set, "likes");
    const zone = (id: string) => r.points.find((p) => p.t.id === id)!.zone;
    expect(zone("star")).toBe("star");
    expect(zone("reach")).toBe("reach");
    expect(zone("gem")).toBe("gem");
    expect(zone("a")).toBe("normal");
  });
  it("skips posts with no views and retweets", () => {
    const r = outliers([...set, mk("nv", 0, 5), mk("rt", 500, 5, { kind: "retweet" })], "likes");
    expect(r.points.find((p) => p.t.id === "nv")).toBeUndefined();
    expect(r.points.find((p) => p.t.id === "rt")).toBeUndefined();
  });
  it("compares each content kind to the typical post", () => {
    const vids = [1, 2, 3].map((i) => mk(`v${i}`, 5000, 100, { hasVideo: true, hasMedia: true }));
    const lift = categoryLift([...set, ...vids]);
    const v = lift.find((l) => l.key === "video")!;
    expect(v.n).toBe(3);
    expect(v.liftViews!).toBeGreaterThan(2);
    expect(lift.find((l) => l.key === "reply")).toBeUndefined();
  });
});
