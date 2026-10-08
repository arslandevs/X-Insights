import { describe, expect, it } from "vitest";
import { cadence } from "../src/metrics/cadence";
import { dailySeries, engagement, engagementRate, mediaVsText, median, ranked } from "../src/metrics/engagement";
import { buildEvents, between, people, sortPeople } from "../src/metrics/interactions";
import { coverage, windowFor } from "../src/metrics/range";
import { T, U } from "./helpers";

const utc = (y: number, m: number, d: number, h = 12) => Date.UTC(y, m - 1, d, h);
const NOW = utc(2026, 10, 8, 18);

describe("range", () => {
  it("fixed ranges end today and span N days", () => {
    const w = windowFor("7", [], "UTC", NOW);
    expect(w).toEqual({ from: "2026-10-02", to: "2026-10-08", days: 7 });
  });
  it("'all' runs from the first to the last captured post", () => {
    const w = windowFor("all", [T({ createdAt: utc(2026, 9, 1) }), T({ createdAt: utc(2026, 9, 10) })], "UTC", NOW);
    expect(w).toEqual({ from: "2026-09-01", to: "2026-09-10", days: 10 });
  });
  it("coverage warns when the range is wider than what was captured", () => {
    const tweets = [T({ createdAt: utc(2026, 10, 1) })];
    expect(coverage(tweets, "30", "UTC", NOW).widerThanCaptured).toBe(true);
    expect(coverage(tweets, "7", "UTC", NOW).widerThanCaptured).toBe(false);
    expect(coverage([], "all", "UTC", NOW)).toMatchObject({ count: 0, earliest: null, latest: null });
  });
});

describe("cadence", () => {
  const w = windowFor("7", [], "UTC", NOW); // Oct 2..8 2026 (Fri..Thu)
  const tweets = [
    T({ createdAt: utc(2026, 10, 2, 9) }), // Fri
    T({ createdAt: utc(2026, 10, 3, 9) }), // Sat
    T({ createdAt: utc(2026, 10, 3, 21), kind: "reply" }),
    T({ createdAt: utc(2026, 10, 4, 9), kind: "quote" }), // Sun
    T({ createdAt: utc(2026, 10, 8, 9), kind: "retweet" }), // Thu
    T({ createdAt: utc(2026, 9, 1) }), // outside
    T({ createdAt: null }),
  ];
  const c = cadence(tweets, w, "UTC");

  it("counts per day, totals, average and active days", () => {
    expect(c.total).toBe(5);
    expect(c.perDay["2026-10-03"]).toBe(2);
    expect(c.perDay["2026-10-05"]).toBe(0);
    expect(c.avgPerDay).toBeCloseTo(5 / 7);
    expect(c.activeDays).toBe(4);
    expect(c.totalDays).toBe(7);
  });
  it("finds the longest streak of consecutive active days", () => {
    expect(c.longestStreak).toBe(3); // Oct 2,3,4
  });
  it("finds the busiest weekday and hour and fills the weekday x hour matrix", () => {
    expect(c.busiestWeekday).toBe(6); // Saturday has 2
    expect(c.busiestHour).toBe(9);
    expect(c.matrix[6][9]).toBe(1);
    expect(c.matrix[6][21]).toBe(1);
  });
  it("splits originals, replies, quotes and retweets", () => {
    expect(c.split).toEqual({ post: 2, reply: 1, quote: 1, retweet: 1 });
  });
  it("buckets by the chosen timezone (Karachi is UTC+5)", () => {
    const k = cadence([T({ createdAt: utc(2026, 10, 3, 21) })], w, "Asia/Karachi"); // 02:00 on Oct 4
    expect(k.perDay["2026-10-04"]).toBe(1);
    expect(k.perDay["2026-10-03"]).toBe(0);
    expect(k.busiestHour).toBe(2);
  });
  it("handles an empty window without NaN", () => {
    const e = cadence([], w, "UTC");
    expect(e.avgPerDay).toBe(0);
    expect(e.busiestWeekday).toBeNull();
    expect(e.longestStreak).toBe(0);
  });
});

describe("engagement", () => {
  const tweets = [
    T({ id: "a", views: 1000, likes: 30, replies: 10, retweets: 5, quotes: 0, bookmarks: 5, hasVideo: true, createdAt: utc(2026, 10, 7) }),
    T({ id: "b", views: 200, likes: 2, replies: 0, retweets: 0, quotes: 0, bookmarks: 0, createdAt: utc(2026, 10, 7) }),
    T({ id: "c", views: null, likes: 4, createdAt: utc(2026, 10, 8) }),
    T({ id: "rt", kind: "retweet", views: 99999, likes: 99999 }),
  ];

  it("ignores retweets of other people and treats hidden views as missing, not zero", () => {
    const e = engagement(tweets);
    expect(e.posts).toBe(3);
    expect(e.views.total).toBe(1200);
    expect(e.views.avg).toBe(600);
    expect(e.likes.total).toBe(36);
    expect(e.likes.median).toBe(4);
  });
  it("computes the engagement rate, n/a without views", () => {
    expect(engagementRate(tweets[0])).toBeCloseTo(50 / 1000);
    expect(engagementRate(tweets[2])).toBeNull();
    expect(engagementRate(T({ views: 0 }))).toBeNull();
    expect(engagement(tweets).avgRate).not.toBeNaN();
  });
  it("shows the mix of engagement types adding to 1", () => {
    const m = engagement(tweets).mix;
    expect(m.likes + m.replies + m.retweets + m.quotes + m.bookmarks).toBeCloseTo(1);
    expect(engagement([]).mix.likes).toBe(0);
  });
  it("median handles odd, even and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
  it("ranks best and worst by views, skipping posts without views", () => {
    expect(ranked(tweets, "views", "best", 2).map((t) => t.id)).toEqual(["a", "b"]);
    expect(ranked(tweets, "views", "worst", 1).map((t) => t.id)).toEqual(["b"]);
    expect(ranked(tweets, "rate", "best", 3).map((t) => t.id)).toEqual(["a", "b"]);
  });
  it("sums a metric per day over the window", () => {
    const s = dailySeries(tweets, windowFor("7", [], "UTC", NOW), "UTC", "views");
    expect(s).toHaveLength(7);
    expect(s.find((x) => x.day === "2026-10-07")!.value).toBe(1200);
    expect(s.find((x) => x.day === "2026-10-08")!.value).toBe(0);
  });
  it("compares media against text", () => {
    const v = mediaVsText(tweets).find((x) => x.feature === "video")!;
    expect(v.withCount).toBe(1);
    expect(v.withPct).toBeCloseTo(1 / 3);
    expect(v.avgViewsWith).toBe(1000);
    expect(v.avgViewsWithout).toBe(200);
  });
});

describe("interactions", () => {
  const ME = "me";
  const tweets = [
    T({ id: "r1", authorId: "ann", replyToUserId: ME, createdAt: utc(2026, 10, 5) }),
    T({ id: "r2", authorId: "ann", replyToUserId: ME, createdAt: utc(2026, 10, 6) }),
    T({ id: "m1", authorId: "bob", mentions: [ME], createdAt: utc(2026, 10, 6) }),
    T({ id: "q1", authorId: "cat", kind: "quote", quotedAuthorId: ME, quotedId: "mine1", createdAt: utc(2026, 10, 7) }),
    T({ id: "rt1", authorId: "dan", kind: "retweet", retweetOfId: "mine1", retweetOfAuthorId: ME, createdAt: utc(2026, 10, 7) }),
    T({ id: "o1", authorId: ME, replyToUserId: "ann", createdAt: utc(2026, 10, 5) }),
    T({ id: "o2", authorId: ME, mentions: ["bob"], createdAt: utc(2026, 10, 6) }),
    T({ id: "x", authorId: "zed", replyToUserId: "someone", createdAt: utc(2026, 10, 6) }), // unrelated
  ];
  const notifs = [
    { id: "like:ann:mine1", actorId: "ann", targetUserId: "me", tweetId: "mine1", type: "like" as const, at: utc(2026, 10, 7) },
    { id: "retweet:dan:mine1", actorId: "dan", targetUserId: "me", tweetId: "mine1", type: "retweet" as const, at: utc(2026, 10, 7) }, // same event as rt1
    { id: "follow:eve:", actorId: "eve", targetUserId: "me", tweetId: null, type: "follow" as const, at: utc(2026, 10, 7) },
    { id: "reply:ann:r1", actorId: "ann", targetUserId: "me", tweetId: "mine1", type: "reply" as const, at: utc(2026, 10, 7) }, // posts already show replies
  ];
  const events = buildEvents(ME, tweets, notifs);
  const list = people(events, null);
  const by = (id: string) => list.find((p) => p.id === id)!;

  it("counts inbound and outbound events per person", () => {
    expect(by("ann")).toMatchObject({ inbound: 3, outbound: 1, score: 4 }); // 2 replies + 1 like in, 1 reply out
    expect(by("bob")).toMatchObject({ inbound: 1, outbound: 1 });
    expect(by("cat").byType.quote).toBe(1);
  });
  it("does not double count a retweet seen in posts and notifications", () => {
    expect(by("dan").inbound).toBe(1);
  });
  it("adds follows from notifications and ignores unrelated posts", () => {
    expect(by("eve").byType.follow).toBe(1);
    expect(list.find((p) => p.id === "zed")).toBeUndefined();
    expect(list.find((p) => p.id === "someone")).toBeUndefined();
  });
  it("respects the range start", () => {
    const recent = people(events, utc(2026, 10, 7));
    expect(recent.find((p) => p.id === "ann")!.inbound).toBe(1); // only the like
    expect(recent.find((p) => p.id === "bob")).toBeUndefined();
  });
  it("sorts by interactions, followers or recency", () => {
    const users = new Map([["ann", U({ id: "ann", followers: 5 })], ["bob", U({ id: "bob", followers: 500 })], ["cat", U({ id: "cat", followers: 50 })]]);
    expect(sortPeople(list, users, "interactions")[0].id).toBe("ann");
    expect(sortPeople(list, users, "followers")[0].id).toBe("bob");
    expect(sortPeople(list, users, "recent")[0].last).toBeGreaterThanOrEqual(sortPeople(list, users, "recent")[1].last);
  });
  it("summarises exchanges with one person", () => {
    expect(between(events, "ann", null)).toMatchObject({ inbound: 3, outbound: 1 });
    expect(between(events, "nobody", null)).toEqual({ inbound: 0, outbound: 0, byType: {} });
  });
});
