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
  return { users: [...userMap.values()], tweets: [...tweetMap.values()] };
}
