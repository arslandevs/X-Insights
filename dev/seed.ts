// Dev harness only: fills IndexedDB with real captured payloads plus synthetic "me" data so every screen can be checked in a normal tab.
import { extractAll } from "../src/parse";
import { parseNotifications } from "../src/parse/notifications";
import { bumpCaptureStat, clearAll, setMeta, upsertInteractions, upsertTweets, upsertUsers } from "../src/db";
import { captureOp } from "../src/captureRules";
import type { InteractionRow, TweetRow, UserRow } from "../src/types";

const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

async function main() {
  await clearAll();
  const real = await (await fetch("./real.json")).json();
  for (const c of real) {
    const op = captureOp(c.url);
    if (!op) continue;
    const json = JSON.parse(c.text);
    const { users, tweets } = extractAll(json);
    await upsertUsers(users);
    await upsertTweets(tweets);
    await bumpCaptureStat(op, tweets.length, users.length);
  }

  const now = Date.now();
  const me: UserRow = { id: "ME1", handle: "arslandvs", handleLower: "arslandvs", name: "Arsalan Amin", avatar: null, bio: "Shipping apps like a machine with vibe", createdAt: Date.UTC(2025, 10, 5), followers: 2, following: 42, postsCount: 15, verified: false, youFollow: null, followsYou: null, lastSeen: now };
  const others: UserRow[] = ["ann", "bob", "cat", "dan", "eve", "fay", "gus", "hal", "ivy", "jon", "kim", "lee"].map((h, i) => ({
    id: `P${i}`, handle: h, handleLower: h, name: h[0].toUpperCase() + h.slice(1) + " Doe", avatar: null, bio: "builder", createdAt: Date.UTC(2018 + (i % 6), i % 12, 3), followers: [12, 840, 53000, 210, 9, 1500, 77, 4300, 120, 33, 9800, 640][i], following: 100 + i * 7, postsCount: 500 + i * 130, verified: i % 5 === 0, youFollow: i % 2 === 0, followsYou: i % 3 === 0, lastSeen: now,
  }));
  await upsertUsers([me, ...others]);

  const tweets: TweetRow[] = [];
  const kinds: TweetRow["kind"][] = ["post", "post", "post", "reply", "reply", "quote", "retweet"];
  for (let i = 0; i < 160; i++) {
    const daysAgo = Math.floor(Math.pow(rnd(), 1.6) * 100);
    const hour = [7, 9, 9, 12, 14, 16, 20, 21, 22, 23][Math.floor(rnd() * 10)];
    const at = now - daysAgo * 864e5 - (24 - hour) * 36e5 + Math.floor(rnd() * 36e5);
    const kind = pick(kinds);
    const views = rnd() < 0.08 ? null : Math.floor(Math.pow(rnd(), 3) * 40000) + 30;
    const v = views ?? 200;
    const target = pick(others);
    tweets.push({
      id: `9${String(1000 + i)}`, authorId: me.id, createdAt: at, text: `${["Shipped", "Learned", "Hot take:", "Today I", "Thread:"][i % 5]} ${["paid ads", "cold email", "SEO landing pages", "Obsidian plugins", "a Chrome extension"][i % 5]} — note ${i} ${i % 4 === 0 ? "🚀" : ""}`,
      views, likes: Math.floor(v * 0.02 * rnd()), retweets: Math.floor(v * 0.002 * rnd()), replies: Math.floor(v * 0.003 * rnd()), quotes: Math.floor(v * 0.0005 * rnd()), bookmarks: Math.floor(v * 0.004 * rnd()),
      kind, replyToUserId: kind === "reply" ? target.id : null, retweetOfId: kind === "retweet" ? `8${i}` : null, retweetOfAuthorId: kind === "retweet" ? target.id : null, quotedId: kind === "quote" ? `7${i}` : null, quotedAuthorId: kind === "quote" ? target.id : null,
      hasMedia: i % 3 === 0, hasVideo: i % 9 === 0, hasPhoto: i % 3 === 0 && i % 9 !== 0, hasLink: i % 4 === 1, hasHashtag: i % 7 === 0, emojiCount: i % 4 === 0 ? 1 : 0, mentions: rnd() < 0.15 ? [pick(others).id] : [], lastSeen: now,
    });
  }
  // people writing to me
  for (let i = 0; i < 40; i++) {
    const p = others[Math.floor(Math.pow(rnd(), 1.8) * others.length)];
    tweets.push({ id: `5${2000 + i}`, authorId: p.id, createdAt: now - Math.floor(rnd() * 60) * 864e5 - Math.floor(rnd() * 8e7), text: "@arslandvs nice one", views: 50, likes: 1, retweets: 0, replies: 0, quotes: 0, bookmarks: 0, kind: "reply", replyToUserId: me.id, retweetOfId: null, retweetOfAuthorId: null, quotedId: null, quotedAuthorId: null, hasMedia: false, hasVideo: false, hasPhoto: false, hasLink: false, hasHashtag: false, emojiCount: 0, mentions: [me.id], lastSeen: now });
  }
  await upsertTweets(tweets);
  const notifs: InteractionRow[] = [];
  for (let i = 0; i < 60; i++) {
    const p = others[Math.floor(Math.pow(rnd(), 1.5) * others.length)];
    const type = pick<InteractionRow["type"]>(["like", "like", "like", "follow", "retweet"]);
    notifs.push({ id: `${type}:${p.id}:${i}`, actorId: p.id, targetUserId: me.id, tweetId: type === "follow" ? null : `9${1000 + i}`, type, at: now - Math.floor(rnd() * 50) * 864e5 });
  }
  await upsertInteractions(notifs);
  await bumpCaptureStat("NotificationsTimeline", 0, others.length);
  await setMeta("meHandleDetected", "arslandvs");
  document.title = "seeded";
}

main().then(() => document.dispatchEvent(new Event("seeded"))).catch((e) => { document.title = "seed failed: " + e; console.error(e); });
