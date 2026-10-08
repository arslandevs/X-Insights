export type TweetKind = "post" | "reply" | "quote" | "retweet";

export interface UserRow {
  id: string;
  handle: string;
  /** lower-case handle for case-insensitive lookups (added in schema v2) */
  handleLower: string;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  createdAt: number | null;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  verified: boolean | null;
  youFollow: boolean | null;
  followsYou: boolean | null;
  lastSeen: number;
}

export interface TweetRow {
  id: string;
  authorId: string | null;
  createdAt: number | null;
  text: string;
  views: number | null;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  kind: TweetKind;
  replyToUserId: string | null;
  retweetOfId: string | null;
  retweetOfAuthorId: string | null;
  quotedId: string | null;
  quotedAuthorId: string | null;
  hasMedia: boolean;
  hasVideo: boolean;
  hasPhoto: boolean;
  hasLink: boolean;
  hasHashtag: boolean;
  emojiCount: number;
  mentions: string[];
  lastSeen: number;
}

export interface InteractionRow {
  id: string;
  actorId: string;
  targetUserId: string;
  tweetId: string | null;
  type: "like" | "reply" | "retweet" | "quote" | "mention" | "follow";
  at: number;
}

export interface CaptureStat {
  count: number;
  /** captures that held no tweets and no users (cursor-only polls are normal; a long run of them is a warning) */
  empty: number;
  tweets: number;
  users: number;
  lastAt: number;
}

export interface Settings {
  /** Your own handle (without @). Detected from the page; this overrides it. */
  meHandle: string | null;
  /** "local", "UTC" or an IANA name such as "Asia/Karachi". */
  timezone: string;
  /** Handles shown in the Feed tab. */
  feedHandles: string[];
}
