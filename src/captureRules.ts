// Which X responses are worth reading. Names come from observed traffic; X renames them from time to time.
export const GRAPHQL_OPS = new Set([
  "UserByScreenName",
  "UserByRestId",
  "UserTweets",
  "UserTweetsAndReplies",
  "UserMedia",
  // Names seen on the current web client
  "UserOriginalsTimeline",
  "UserRepliesTimeline",
  "UserVideoTimeline",
  "TweetDetail",
  "TweetResultByRestId",
  "SearchTimeline",
  "HomeTimeline",
  "HomeLatestTimeline",
  "Likes",
  "Favoriters",
  "Retweeters",
  "NotificationsTimeline",
]);

const GRAPHQL_PATH = /\/i\/api\/graphql\/[^/]+\/([A-Za-z0-9_]+)/;
const NOTIFICATIONS_PATH = /\/i\/api\/2\/notifications\/all\.json/;

/** Returns the operation name to capture, or null to ignore the URL. Matches on the path only (the hash changes). */
export function captureOp(url: string): string | null {
  let path = url;
  try {
    path = new URL(url, "https://x.com").pathname;
  } catch {
    /* keep raw */
  }
  const g = GRAPHQL_PATH.exec(path);
  if (g) return GRAPHQL_OPS.has(g[1]) ? g[1] : null;
  if (NOTIFICATIONS_PATH.test(path)) return "notifications";
  return null;
}

export const NOTIFICATION_OPS = new Set(["NotificationsTimeline", "notifications"]);
/** Operations that normally carry tweets. If one keeps returning none, the parser is probably out of date. */
export const TWEET_OPS = new Set(["UserTweets", "UserTweetsAndReplies", "UserMedia", "UserOriginalsTimeline", "UserRepliesTimeline", "UserVideoTimeline", "HomeTimeline", "HomeLatestTimeline", "SearchTimeline", "TweetDetail"]);
