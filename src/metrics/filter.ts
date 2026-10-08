import type { TweetRow } from "../types";

export type FilterKey = "all" | "post" | "reply" | "quote" | "retweet" | "media" | "text" | "photo" | "video" | "link";

export const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "post", label: "Posts only" },
  { key: "reply", label: "Replies" },
  { key: "quote", label: "Quotes" },
  { key: "retweet", label: "Reposts" },
  { key: "media", label: "With media" },
  { key: "text", label: "Without media" },
  { key: "photo", label: "With photo" },
  { key: "video", label: "With video" },
  { key: "link", label: "With link" },
];

const TEST: Record<FilterKey, (t: TweetRow) => boolean> = {
  all: () => true,
  post: (t) => t.kind === "post",
  reply: (t) => t.kind === "reply",
  quote: (t) => t.kind === "quote",
  retweet: (t) => t.kind === "retweet",
  media: (t) => t.hasMedia,
  text: (t) => !t.hasMedia,
  photo: (t) => t.hasPhoto,
  video: (t) => t.hasVideo,
  link: (t) => t.hasLink,
};

export const applyFilter = (tweets: TweetRow[], key: FilterKey) => (key === "all" ? tweets : tweets.filter(TEST[key]));
