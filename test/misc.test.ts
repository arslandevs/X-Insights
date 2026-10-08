import { describe, expect, it } from "vitest";
import { handleFromUrl } from "../src/profileUrl";
import { addDays, dayDiff, dayKey, eachDay, parts, weekdayOf } from "../src/tz";
import { notificationTime, notificationType, parseNotifications } from "../src/parse/notifications";
import { extractAll } from "../src/parse";

describe("profile url", () => {
  it("finds the handle on profile and status pages", () => {
    expect(handleFromUrl("https://x.com/levelsio")).toBe("levelsio");
    expect(handleFromUrl("https://x.com/levelsio/status/123?s=20")).toBe("levelsio");
    expect(handleFromUrl("https://twitter.com/Jack/with_replies")).toBe("Jack");
  });
  it("returns null for non-profile pages", () => {
    for (const u of ["https://x.com/home", "https://x.com/explore", "https://x.com/i/bookmarks", "https://x.com/notifications", "https://x.com/search?q=a", "https://x.com/", "https://example.com/levelsio", "not a url", ""])
      expect(handleFromUrl(u)).toBeNull();
  });
});

describe("tz helpers", () => {
  it("reads weekday, hour and day in a timezone", () => {
    const t = Date.UTC(2026, 9, 8, 22, 30); // Thu 22:30 UTC = Fri 03:30 in Karachi
    expect(parts(t, "UTC")).toMatchObject({ d: 8, wd: 4, h: 22 });
    expect(parts(t, "Asia/Karachi")).toMatchObject({ d: 9, wd: 5, h: 3 });
    expect(dayKey(t, "Asia/Karachi")).toBe("2026-10-09");
  });
  it("does day arithmetic on keys", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(dayDiff("2026-10-01", "2026-10-08")).toBe(7);
    expect(weekdayOf("2026-10-08")).toBe(4);
    expect(eachDay("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });
});

describe("notifications", () => {
  const user = (id: string, handle: string) => ({ __typename: "User", rest_id: id, core: { screen_name: handle, name: handle, created_at: "Wed Oct 08 12:00:00 +0000 2025" }, relationship_perspectives: { following: true, followed_by: false } });
  const item = (icon: string, text: string, ts: string, from: any[], tweet?: any) => ({
    entryId: "notification-1",
    content: { itemContent: { __typename: "TimelineNotification", notification_icon: icon, rich_message: { text }, timestamp_ms: ts, template: { __typename: "TimelineNotificationAggregateUserActions", from_users: from.map((u) => ({ __typename: "TimelineNotificationUserRef", user_results: { result: u } })), target_objects: tweet ? [{ __typename: "TimelineNotificationTweetRef", tweet_results: { result: tweet } }] : [] } } },
  });
  const myTweet = { __typename: "Tweet", rest_id: "T1", core: { user_results: { result: user("ME", "me") } }, legacy: { created_at: "Wed Oct 08 12:00:00 +0000 2025", full_text: "hi", favorite_count: 2 } };
  const json = { data: { viewer_v2: { user_results: { result: { timeline: { instructions: [{ entries: [
    item("heart_icon", "ann and bob liked your post", "2026-10-08T17:56:12.804Z", [user("A", "ann"), user("B", "bob")], myTweet),
    item("person_icon", "cat followed you", "1790000000000", [user("C", "cat")]),
    item("communities_icon", "A new community post", "2026-09-19T19:42:53.054Z", [], myTweet),
    item("bird_icon", "dan replied to you", "2026-10-08T10:00:00Z", [user("D", "dan")], myTweet),
  ] }] } } } } } };

  it("reads likes, follows and replies with actor, target and time; skips communities", () => {
    const rows = parseNotifications(json);
    const keyed = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(rows).toHaveLength(4);
    expect(keyed["like:A:T1"]).toMatchObject({ actorId: "A", targetUserId: "ME", type: "like", at: Date.parse("2026-10-08T17:56:12.804Z") });
    expect(keyed["like:B:T1"]).toBeDefined();
    expect(keyed["follow:C:"]).toMatchObject({ targetUserId: "me", at: 1790000000000 });
    expect(keyed["reply:D:T1"]).toBeDefined();
  });

  it("maps icons and falls back to the message text", () => {
    expect(notificationType("heart_icon", null)).toBe("like");
    expect(notificationType("retweet_icon", null)).toBe("retweet");
    expect(notificationType("weird_icon", "Ann reposted your post")).toBe("retweet");
    expect(notificationType("communities_icon", "A new community post")).toBeNull();
    expect(notificationTime("2026-10-08T17:56:12.804Z")).toBe(Date.parse("2026-10-08T17:56:12.804Z"));
    expect(notificationTime("1790000000000")).toBe(1790000000000);
    expect(notificationTime(null)).toBeNull();
  });

  it("the same response also yields the users and my tweet for the database", () => {
    const { users, tweets } = extractAll(json);
    expect(users.map((u) => u.handle).sort()).toEqual(["ann", "bob", "cat", "dan", "me"]);
    expect(tweets.map((t) => t.id)).toEqual(["T1"]);
    expect(users.find((u) => u.handle === "ann")!.youFollow).toBe(true);
  });

  it("reads the older globalObjects shape", () => {
    const old = { globalObjects: {
      users: { "7": { id_str: "7", screen_name: "oldann", name: "Old Ann", followers_count: 3 } },
      tweets: { "50": { id_str: "50", user_id_str: "ME", full_text: "mine", created_at: "Wed Oct 08 12:00:00 +0000 2025", favorite_count: 1 } },
      notifications: { n1: { timestampMs: "1790000000000", icon: { id: "heart_icon" }, message: { text: "liked" }, template: { aggregateUserActionsV1: { targetObjects: [{ tweet: { id: "50" } }], fromUsers: [{ user: { id: "7" } }] } } } },
    } };
    expect(parseNotifications(old)).toEqual([{ id: "like:7:50", actorId: "7", targetUserId: "ME", tweetId: "50", type: "like", at: 1790000000000 }]);
    const e = extractAll(old);
    expect(e.users[0].handle).toBe("oldann");
    expect(e.tweets[0].id).toBe("50");
  });
});

import { decodeEntities } from "../src/parse/tweet";
import { it as it2, expect as expect2 } from "vitest";
it2("decodes the HTML entities X puts in tweet text", () => {
  expect2(decodeEntities("a &gt; b &amp; c &lt;d&gt; &quot;q&quot; it&#39;s")).toBe("a > b & c <d> \"q\" it's");
});
