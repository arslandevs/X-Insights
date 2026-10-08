import type { UserRow } from "../types";
import { asObj, bool, first, num, parseDate, str } from "./util";

/** Normalise a User object. Handles the current shape (core / avatar / relationship_counts) and the older `legacy` one. */
export function normalizeUser(u: Record<string, any>, now = Date.now()): UserRow | null {
  const legacy = asObj(u.legacy) ?? {};
  const core = asObj(u.core) ?? {};
  const id = str(u.rest_id) ?? str(legacy.id_str);
  const handle = str(core.screen_name) ?? str(legacy.screen_name);
  if (!id || !handle) return null; // partial objects (badge counts, wrappers) are not users

  const counts = asObj(u.relationship_counts) ?? {};
  const tweetCounts = asObj(u.tweet_counts) ?? {};
  const persp = asObj(u.relationship_perspectives) ?? {};
  const verification = asObj(u.verification) ?? {};

  return {
    id,
    handle,
    name: first(str(core.name), str(legacy.name)),
    avatar: first(str(asObj(u.avatar)?.image_url), str(legacy.profile_image_url_https)),
    bio: first(str(asObj(u.profile_bio)?.description), str(legacy.description)),
    createdAt: first(parseDate(core.created_at), parseDate(legacy.created_at)),
    followers: first(num(counts.followers), num(legacy.followers_count)),
    following: first(num(counts.following), num(legacy.friends_count)),
    postsCount: first(num(tweetCounts.tweets), num(legacy.statuses_count)),
    verified: first(bool(u.is_blue_verified), bool(verification.verified), bool(legacy.verified)),
    youFollow: first(bool(persp.following), bool(legacy.following)),
    followsYou: first(bool(persp.followed_by), bool(legacy.followed_by)),
    lastSeen: now,
  };
}
