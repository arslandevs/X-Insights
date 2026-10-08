import type { InteractionRow, TweetRow, UserRow } from "../types";

export type EventType = InteractionRow["type"];

export interface Event {
  key: string;
  /** "in" = they interacted with me, "out" = I interacted with them */
  dir: "in" | "out";
  otherId: string;
  type: EventType;
  at: number;
}

export interface Person {
  id: string;
  inbound: number;
  outbound: number;
  score: number;
  last: number;
  byType: Partial<Record<EventType, number>>;
}

/**
 * Every interaction we have seen between me and someone else.
 * Sources: captured posts (replies, quotes, retweets, mentions) and my notifications (likes, follows, retweets).
 * Events are keyed by (type, actor, post) so the same event seen twice counts once.
 */
export function buildEvents(meId: string, tweets: TweetRow[], notifications: InteractionRow[]): Event[] {
  const out = new Map<string, Event>();
  const add = (dir: "in" | "out", otherId: string | null, type: EventType, tweetId: string | null, at: number | null) => {
    if (!otherId || otherId === meId || at === null) return;
    const actor = dir === "in" ? otherId : meId;
    const key = `${type}:${actor}:${tweetId ?? ""}${dir === "out" ? `>${otherId}` : ""}`;
    if (!out.has(key)) out.set(key, { key, dir, otherId, type, at });
  };

  for (const t of tweets) {
    const a = t.authorId;
    if (!a) continue;
    if (a !== meId) {
      // they -> me
      if (t.kind === "retweet" && t.retweetOfAuthorId === meId) add("in", a, "retweet", t.retweetOfId, t.createdAt);
      else if (t.replyToUserId === meId) add("in", a, "reply", t.id, t.createdAt);
      else if (t.quotedAuthorId === meId) add("in", a, "quote", t.quotedId, t.createdAt);
      else if (t.mentions.includes(meId)) add("in", a, "mention", t.id, t.createdAt);
    } else {
      // me -> them
      if (t.kind === "retweet") add("out", t.retweetOfAuthorId, "retweet", t.retweetOfId, t.createdAt);
      else if (t.replyToUserId) add("out", t.replyToUserId, "reply", t.id, t.createdAt);
      else if (t.quotedAuthorId) add("out", t.quotedAuthorId, "quote", t.quotedId, t.createdAt);
      for (const m of t.mentions) if (m !== t.replyToUserId) add("out", m, "mention", t.id, t.createdAt);
    }
  }

  // Notifications only add what posts cannot show: likes and follows (and retweets seen only there).
  for (const n of notifications) {
    if (n.targetUserId !== meId && n.targetUserId !== "me") continue;
    if (n.type === "like" || n.type === "follow" || n.type === "retweet") add("in", n.actorId, n.type, n.tweetId, n.at);
  }
  return [...out.values()];
}

export function people(events: Event[], fromMs: number | null): Person[] {
  const by = new Map<string, Person>();
  for (const e of events) {
    if (fromMs !== null && e.at < fromMs) continue;
    const p = by.get(e.otherId) ?? { id: e.otherId, inbound: 0, outbound: 0, score: 0, last: 0, byType: {} };
    if (e.dir === "in") p.inbound++;
    else p.outbound++;
    p.score++;
    p.byType[e.type] = (p.byType[e.type] ?? 0) + 1;
    p.last = Math.max(p.last, e.at);
    by.set(e.otherId, p);
  }
  return [...by.values()];
}

export type PeopleSort = "interactions" | "followers" | "recent";

export function sortPeople(list: Person[], users: Map<string, UserRow>, by: PeopleSort): Person[] {
  const f = (p: Person) => users.get(p.id)?.followers ?? -1;
  return [...list].sort((a, b) => (by === "interactions" ? b.score - a.score || b.last - a.last : by === "followers" ? f(b) - f(a) : b.last - a.last));
}

/** Replies and mentions exchanged with one person, for the "You and @handle" box. */
export function between(events: Event[], otherId: string, fromMs: number | null) {
  const p = people(events, fromMs).find((x) => x.id === otherId);
  return { inbound: p?.inbound ?? 0, outbound: p?.outbound ?? 0, byType: p?.byType ?? {} };
}
