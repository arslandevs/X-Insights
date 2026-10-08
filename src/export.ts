import type { TweetRow, UserRow } from "./types";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Tweets as CSV, one row per post, with the time as ISO text so spreadsheets read it. */
export function tweetsToCsv(tweets: TweetRow[], handleOf: (id: string | null) => string): string {
  const head = ["id", "author", "created_at", "kind", "text", "views", "likes", "retweets", "replies", "quotes", "bookmarks", "has_media", "has_video", "has_link", "url"];
  const lines = [head.join(",")];
  for (const t of tweets) {
    const h = handleOf(t.authorId);
    lines.push(
      [t.id, h, t.createdAt ? new Date(t.createdAt).toISOString() : "", t.kind, t.text.replace(/\s+/g, " "), t.views, t.likes, t.retweets, t.replies, t.quotes, t.bookmarks, t.hasMedia, t.hasVideo, t.hasLink, h ? `https://x.com/${h}/status/${t.id}` : ""]
        .map(esc)
        .join(","),
    );
  }
  return lines.join("\n");
}

export const handleMap = (users: UserRow[]) => {
  const m = new Map(users.map((u) => [u.id, u.handle]));
  return (id: string | null) => (id ? m.get(id) ?? "" : "");
};

export function download(filename: string, text: string, mime = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
