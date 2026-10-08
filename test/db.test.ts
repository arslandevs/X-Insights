import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { bumpCaptureStat, clearAll, counts, getDB, getMeta, mergeRow, resetDBCache, upsertTweets, upsertUsers } from "../src/db";
import type { TweetRow, UserRow } from "../src/types";

const tweet = (over: Partial<TweetRow> = {}): TweetRow => ({
  id: "1", authorId: "9", createdAt: 1, text: "a", views: 100, likes: 5, retweets: 0, replies: 0, quotes: 0, bookmarks: 0, kind: "post",
  replyToUserId: null, retweetOfId: null, hasMedia: false, hasVideo: false, hasPhoto: false, hasLink: false, hasHashtag: false, emojiCount: 0, mentions: [], lastSeen: 1, ...over,
});
const user = (over: Partial<UserRow> = {}): UserRow => ({
  id: "9", handle: "h", name: "N", avatar: null, bio: "bio", createdAt: 1, followers: 10, following: 2, postsCount: 3, verified: false, youFollow: null, followsYou: null, lastSeen: 1, ...over,
});

beforeEach(async () => {
  await resetDBCache();
  await new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase("x-insights");
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
});

describe("db", () => {
  it("upserts by id without duplicates", async () => {
    await upsertTweets([tweet()]);
    await upsertTweets([tweet({ likes: 9, lastSeen: 2 })]);
    expect((await counts()).tweets).toBe(1);
    expect((await (await getDB()).get("tweets", "1"))!.likes).toBe(9);
  });

  it("a later capture with missing views keeps the known value", async () => {
    await upsertTweets([tweet({ views: 100 })]);
    await upsertTweets([tweet({ views: null, likes: 6 })]);
    const row = (await (await getDB()).get("tweets", "1"))!;
    expect(row.views).toBe(100);
    expect(row.likes).toBe(6);
  });

  it("partial users do not erase known fields", async () => {
    await upsertUsers([user()]);
    await upsertUsers([user({ bio: null, followers: 11, youFollow: true })]);
    const row = (await (await getDB()).get("users", "9"))!;
    expect(row).toMatchObject({ bio: "bio", followers: 11, youFollow: true });
  });

  it("indexes handle and createdAt", async () => {
    await upsertUsers([user({ handle: "abc" })]);
    await upsertTweets([tweet({ id: "2", createdAt: 50 })]);
    const db = await getDB();
    expect((await db.getFromIndex("users", "handle", "abc"))!.id).toBe("9");
    expect(await db.getAllFromIndex("tweets", "createdAt", IDBKeyRange.bound(40, 60))).toHaveLength(1);
  });

  it("tracks capture health and can clear everything", async () => {
    await bumpCaptureStat("UserByScreenName", 0, 1, 111);
    await bumpCaptureStat("UserByScreenName", 5, 2, 222);
    expect(await getMeta<Record<string, any>>("captureStats")).toMatchObject({ UserByScreenName: { count: 2, tweets: 5, users: 3, lastAt: 222 } });
    await upsertTweets([tweet()]);
    await clearAll();
    expect(await counts()).toEqual({ users: 0, tweets: 0, interactions: 0 });
  });

  it("mergeRow only overwrites with defined values", () => {
    expect(mergeRow({ a: 1, b: 2 } as any, { a: null, b: 3 } as any)).toEqual({ a: 1, b: 3 });
  });
});
