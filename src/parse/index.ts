import type { TweetRow, UserRow } from "../types";
import { normalizeTweet } from "./tweet";
import { normalizeUser } from "./user";
import { walk } from "./walk";

export interface Extracted {
  users: UserRow[];
  tweets: TweetRow[];
}

/** Turn one parsed API response into rows. The same id can appear many times (quoted, retweeted); the last one wins here and the DB merges across captures. */
export function extractAll(json: unknown, now = Date.now()): Extracted {
  const { tweets, users } = walk(json);
  const userMap = new Map<string, UserRow>();
  for (const u of users) {
    const row = normalizeUser(u, now);
    if (row) userMap.set(row.id, row);
  }
  const tweetMap = new Map<string, TweetRow>();
  for (const t of tweets) {
    const row = normalizeTweet(t, now);
    if (row) tweetMap.set(row.id, row);
  }
  // Older REST responses keep users and tweets in flat maps (globalObjects) without __typename.
  const g = (json as any)?.globalObjects;
  if (g && typeof g === "object") {
    for (const [id, u] of Object.entries<any>(g.users ?? {})) {
      const row = normalizeUser({ rest_id: id, legacy: u }, now);
      if (row && !userMap.has(row.id)) userMap.set(row.id, row);
    }
    for (const [id, tw] of Object.entries<any>(g.tweets ?? {})) {
      const row = normalizeTweet({ rest_id: id, legacy: tw }, now);
      if (row && !tweetMap.has(row.id)) tweetMap.set(row.id, row);
    }
  }
  return { users: [...userMap.values()], tweets: [...tweetMap.values()] };
}
