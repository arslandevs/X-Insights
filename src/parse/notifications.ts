import type { InteractionRow } from "../types";
import { unwrapTweet } from "./tweet";
import { asObj, num, str } from "./util";

type InteractionType = InteractionRow["type"];

/** Icon first, then the message text, because X reuses icons. Unknown kinds (communities, recommendations...) are skipped. */
export function notificationType(icon: string | null, text: string | null): InteractionType | null {
  const byIcon: Record<string, InteractionType> = { heart_icon: "like", retweet_icon: "retweet", person_icon: "follow", reply_icon: "reply" };
  if (icon && byIcon[icon]) return byIcon[icon];
  const t = (text ?? "").toLowerCase();
  if (/\bliked\b/.test(t)) return "like";
  if (/\b(reposted|retweeted)\b/.test(t)) return "retweet";
  if (/\bfollowed you\b/.test(t)) return "follow";
  if (/\bquoted\b/.test(t)) return "quote";
  if (/\breplied\b/.test(t)) return "reply";
  if (/\b(mentioned|tagged)\b/.test(t)) return "mention";
  return null;
}

/** timestamp_ms is an ISO string in the current client and a numeric string in older ones. */
export function notificationTime(v: unknown): number | null {
  const n = num(v);
  if (n !== null) return n;
  const s = str(v);
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

const rid = (x: unknown) => str(asObj(x)?.rest_id);

/** Current client: NotificationsTimeline (GraphQL). Older client: /2/notifications/all.json (globalObjects). Both handled. */
export function parseNotifications(json: unknown, now = Date.now()): InteractionRow[] {
  const out = new Map<string, InteractionRow>();
  const add = (type: InteractionType | null, actorId: string | null, targetUserId: string | null, tweetId: string | null, at: number | null) => {
    if (!type || !actorId) return;
    const row: InteractionRow = { id: `${type}:${actorId}:${tweetId ?? ""}`, actorId, targetUserId: targetUserId ?? "me", tweetId, type, at: at ?? now };
    const prev = out.get(row.id);
    if (!prev || row.at > prev.at) out.set(row.id, row);
  };

  const stack: unknown[] = [json];
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
      continue;
    }
    const o = cur as Record<string, any>;
    if (o.__typename === "TimelineNotification") {
      const template = asObj(o.template) ?? {};
      const type = notificationType(str(o.notification_icon), str(asObj(o.rich_message)?.text));
      const at = notificationTime(o.timestamp_ms);
      const target = unwrapTweet(asObj((template.target_objects as any[])?.[0])?.tweet_results?.result);
      const tweetId = rid(target);
      const targetUser = rid(asObj(asObj(target?.core)?.user_results)?.result);
      for (const fu of (template.from_users as any[]) ?? []) add(type, rid(asObj(fu)?.user_results?.result), type === "follow" ? null : targetUser, tweetId, at);
      continue;
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") stack.push(v);
  }

  // Older REST shape
  const g = asObj((json as any)?.globalObjects);
  if (g) {
    const notifs = asObj(g.notifications) ?? {};
    const tweets = asObj(g.tweets) ?? {};
    for (const n of Object.values(notifs) as Record<string, any>[]) {
      const type = notificationType(str(asObj(n.icon)?.id), str(asObj(n.message)?.text));
      const at = notificationTime(n.timestampMs);
      const agg = asObj(asObj(n.template)?.aggregateUserActionsV1) ?? {};
      const tid = str(asObj((agg.targetObjects as any[])?.[0]?.tweet)?.id);
      const targetUser = tid ? str(asObj(tweets[tid])?.user_id_str) : null;
      for (const fu of (agg.fromUsers as any[]) ?? []) add(type, str(asObj(fu?.user)?.id), type === "follow" ? null : targetUser, tid, at);
    }
  }
  return [...out.values()];
}
