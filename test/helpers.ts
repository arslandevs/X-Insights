import type { TweetRow, UserRow } from "../src/types";

export const T = (over: Partial<TweetRow> = {}): TweetRow => ({
  id: String(Math.random()).slice(2), authorId: "me", createdAt: Date.UTC(2026, 9, 8, 12), text: "t", views: 100, likes: 0, retweets: 0, replies: 0, quotes: 0, bookmarks: 0,
  kind: "post", replyToUserId: null, retweetOfId: null, retweetOfAuthorId: null, quotedId: null, quotedAuthorId: null, hasMedia: false, hasVideo: false, hasPhoto: false,
  hasLink: false, hasHashtag: false, emojiCount: 0, mentions: [], lastSeen: 0, ...over,
});

export const U = (over: Partial<UserRow> = {}): UserRow => ({
  id: "u", handle: "u", handleLower: "u", name: "U", avatar: null, bio: null, createdAt: null, followers: 10, following: 5, postsCount: 1, verified: false, youFollow: null, followsYou: null, lastSeen: 0, ...over,
});
