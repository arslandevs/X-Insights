export type TweetKind = "post" | "reply" | "quote" | "retweet";

export interface UserRow {
  id: string;
  handle: string;
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
  tweets: number;
  users: number;
  lastAt: number;
}
