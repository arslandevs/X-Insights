import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractAll } from "../src/parse";
import { normalizeTweet } from "../src/parse/tweet";
import { normalizeUser } from "../src/parse/user";
import { walk } from "../src/parse/walk";

const fx = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const profile = fx("UserByScreenName.json");
const timeline = fx("UserTimeline.json");

describe("walk", () => {
  it("finds tweets and users at any depth, including quoted tweets", () => {
    const { tweets, users } = walk(timeline);
    expect(tweets.length).toBeGreaterThanOrEqual(3);
    expect(users.length).toBeGreaterThanOrEqual(1);
    const ids = tweets.map((t) => t.rest_id);
    expect(new Set(ids).size).toBeGreaterThan(3); // outer posts plus embedded quoted ones
  });

  it("finds the user in a profile response", () => {
    expect(walk(profile).users).toHaveLength(1);
  });

  it("tolerates junk", () => {
    expect(walk(null)).toEqual({ tweets: [], users: [] });
    expect(walk({ a: [1, "x", null, { b: undefined }] })).toEqual({ tweets: [], users: [] });
  });
});

describe("user", () => {
  it("normalises the current response shape", () => {
    const [u] = extractAll(profile).users;
    expect(u.handle).toBe("levelsio");
    expect(u.id).toMatch(/^\d+$/);
    expect(u.createdAt).toBeGreaterThan(Date.UTC(2005, 0, 1));
    expect(u.followers).toBeGreaterThan(1000);
    expect(u.following).not.toBeNull();
    expect(u.postsCount).toBeGreaterThan(1000);
    expect(typeof u.bio).toBe("string");
    expect(u.avatar).toMatch(/^https:/);
    expect(typeof u.youFollow).toBe("boolean");
  });

  it("falls back to the older legacy shape", () => {
    const u = normalizeUser({
      __typename: "User",
      rest_id: "42",
      legacy: { screen_name: "old", name: "Old", created_at: "Wed Oct 08 12:00:00 +0000 2025", followers_count: 5, friends_count: 6, statuses_count: 7, description: "hi", profile_image_url_https: "https://x/y.jpg" },
    });
    expect(u).toMatchObject({ id: "42", handle: "old", followers: 5, following: 6, postsCount: 7, bio: "hi", createdAt: Date.UTC(2025, 9, 8, 12) });
  });

  it("skips objects that are not real users (no id or handle)", () => {
    expect(normalizeUser({ __typename: "User", badge_counts: { total_unread_count: 3 } })).toBeNull();
  });
});

describe("tweet", () => {
  it("extracts counts, time, views, author and media from a real response", () => {
    const { tweets } = extractAll(timeline);
    expect(tweets.length).toBeGreaterThanOrEqual(3);
    for (const t of tweets) {
      expect(t.id).toMatch(/^\d+$/);
      expect(t.createdAt).toBeGreaterThan(Date.UTC(2006, 0, 1));
      expect(typeof t.text).toBe("string");
      for (const k of ["likes", "retweets", "replies", "quotes", "bookmarks"] as const) expect(Number.isFinite(t[k])).toBe(true);
      expect(t.views === null || t.views >= 0).toBe(true);
      expect(t.authorId).toMatch(/^\d+$/);
    }
    expect(tweets.some((t) => t.hasMedia)).toBe(true);
    expect(tweets.some((t) => t.kind === "quote")).toBe(true);
    expect(tweets.some((t) => t.views !== null && t.views > 0)).toBe(true);
  });

  it("unwraps TweetWithVisibilityResults", () => {
    const wrapped: string[] = [];
    const stack: unknown[] = [timeline];
    while (stack.length) {
      const c = stack.pop();
      if (c && typeof c === "object") {
        const o = c as Record<string, any>;
        if (o.__typename === "TweetWithVisibilityResults" && o.tweet?.rest_id) wrapped.push(o.tweet.rest_id);
        stack.push(...Object.values(o));
      }
    }
    expect(wrapped.length).toBeGreaterThan(0);
    const ids = new Set(extractAll(timeline).tweets.map((t) => t.id));
    for (const id of wrapped) expect(ids.has(id)).toBe(true);
  });

  const base = { __typename: "Tweet", rest_id: "1", core: { user_results: { result: { rest_id: "9" } } }, legacy: { created_at: "Wed Oct 08 12:00:00 +0000 2025", full_text: "hello #x 😀😀", favorite_count: 3, entities: { hashtags: [{ text: "x" }] } } };

  it("keeps missing views as null, never 0", () => {
    const t = normalizeTweet(base)!;
    expect(t.views).toBeNull();
    expect(t).toMatchObject({ likes: 3, retweets: 0, replies: 0, bookmarks: 0, kind: "post", authorId: "9", hasHashtag: true, emojiCount: 2, createdAt: Date.UTC(2025, 9, 8, 12) });
  });

  it("classifies replies, retweets and quotes", () => {
    const reply = normalizeTweet({ ...base, legacy: { ...base.legacy, in_reply_to_status_id_str: "5", in_reply_to_user_id_str: "7" } })!;
    expect(reply).toMatchObject({ kind: "reply", replyToUserId: "7" });
    const rt = normalizeTweet({ ...base, legacy: { ...base.legacy, retweeted_status_result: { result: { __typename: "Tweet", rest_id: "55" } } } })!;
    expect(rt).toMatchObject({ kind: "retweet", retweetOfId: "55" });
    const quote = normalizeTweet({ ...base, legacy: { ...base.legacy, is_quote_status: true } })!;
    expect(quote.kind).toBe("quote");
  });

  it("prefers the long-post text and reads views", () => {
    const t = normalizeTweet({ ...base, views: { count: "1234" }, note_tweet: { note_tweet_results: { result: { text: "long form" } } } })!;
    expect(t.text).toBe("long form");
    expect(t.views).toBe(1234);
  });

  it("ignores bare stub tweets that have no data", () => {
    expect(normalizeTweet({ __typename: "Tweet", rest_id: "2107715824307867650" })).toBeNull();
    expect(extractAll({ a: { __typename: "Tweet", rest_id: "1" } }).tweets).toEqual([]);
  });

  it("returns null without an id and does not throw on junk", () => {
    expect(normalizeTweet({ __typename: "Tweet" })).toBeNull();
    expect(() => normalizeTweet({ __typename: "Tweet", rest_id: "1", legacy: null, core: 5 } as any)).not.toThrow();
  });
});
