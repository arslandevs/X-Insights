import type { TweetKind, TweetRow } from "../types";
import { asObj, first, num, parseDate, str } from "./util";

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };
/** X sends text HTML-escaped (`&gt;`, `&amp;`). Show it the way it was written. */
export const decodeEntities = (s: string) => s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m);

const STATUS_URL = /(?:x|twitter)\.com\/[^/]+\/status\//;

/** TweetWithVisibilityResults wraps the real tweet in `.tweet`. */
export const unwrapTweet = (r: unknown): Record<string, any> | undefined => {
  const o = asObj(r);
  if (!o) return undefined;
  return o.__typename === "TweetWithVisibilityResults" ? asObj(o.tweet) : o;
};

const authorOf = (tw: Record<string, any> | undefined): string | null =>
  tw ? first(str(asObj(asObj(asObj(tw.core)?.user_results)?.result)?.rest_id), str(asObj(tw.legacy)?.user_id_str)) : null;

/** Normalise a Tweet object. Missing fields become null (views) or 0 (counts); never throws. */
export function normalizeTweet(t: Record<string, any>, now = Date.now()): TweetRow | null {
  const legacy = asObj(t.legacy);
  // X sends bare `{__typename:"Tweet", rest_id}` stubs (references to replied-to or retweeted posts). They carry no data and
  // must never reach the DB, where default zeros would overwrite real counts.
  if (!legacy) return null;
  const id = str(t.rest_id) ?? str(legacy.id_str);
  if (!id) return null;

  const noteText = str(asObj(asObj(asObj(t.note_tweet)?.note_tweet_results)?.result)?.text);
  const text = decodeEntities(noteText ?? str(legacy.full_text) ?? "");

  const media: Record<string, any>[] = (asObj(legacy.extended_entities)?.media ?? asObj(legacy.entities)?.media ?? []) as Record<string, any>[];
  const types = new Set(media.map((m) => m?.type));
  const urls: Record<string, any>[] = (asObj(legacy.entities)?.urls ?? []) as Record<string, any>[];
  const hashtags = (asObj(legacy.entities)?.hashtags ?? []) as unknown[];
  const mentionsRaw = (asObj(legacy.entities)?.user_mentions ?? []) as Record<string, any>[];

  const isRetweet = !!asObj(legacy.retweeted_status_result);
  const isReply = !!str(legacy.in_reply_to_status_id_str);
  const isQuote = legacy.is_quote_status === true || !!t.quoted_status_result;
  const kind: TweetKind = isRetweet ? "retweet" : isReply ? "reply" : isQuote ? "quote" : "post";

  const authorId = first(str(asObj(asObj(asObj(t.core)?.user_results)?.result)?.rest_id), str(legacy.user_id_str));

  return {
    id,
    authorId,
    createdAt: parseDate(legacy.created_at),
    text,
    views: num(asObj(t.views)?.count), // null when X hides it; never 0 by default
    likes: num(legacy.favorite_count) ?? 0,
    retweets: num(legacy.retweet_count) ?? 0,
    replies: num(legacy.reply_count) ?? 0,
    quotes: num(legacy.quote_count) ?? 0,
    bookmarks: num(legacy.bookmark_count) ?? 0,
    kind,
    replyToUserId: str(legacy.in_reply_to_user_id_str),
    retweetOfId: isRetweet ? str(unwrapTweet(asObj(legacy.retweeted_status_result)?.result)?.rest_id) : null,
    retweetOfAuthorId: isRetweet ? authorOf(unwrapTweet(asObj(legacy.retweeted_status_result)?.result)) : null,
    quotedId: first(str(legacy.quoted_status_id_str), str(unwrapTweet(asObj(t.quoted_status_result)?.result)?.rest_id)),
    quotedAuthorId: authorOf(unwrapTweet(asObj(t.quoted_status_result)?.result)),
    hasMedia: media.length > 0,
    mediaUrls: media.map((m) => str(m?.media_url_https)).filter((x): x is string => !!x).slice(0, 4),
    hasVideo: types.has("video") || types.has("animated_gif"),
    hasPhoto: types.has("photo"),
    hasLink: urls.some((u) => !STATUS_URL.test(String(u?.expanded_url ?? ""))) && urls.length > 0,
    hasHashtag: hashtags.length > 0 || /(^|\s)#\w/.test(text),
    emojiCount: (text.match(/\p{Extended_Pictographic}/gu) ?? []).length,
    mentions: mentionsRaw.map((m) => str(m?.id_str)).filter((x): x is string => !!x),
    lastSeen: now,
  };
}
