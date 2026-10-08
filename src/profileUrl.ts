const RESERVED = new Set([
  "home", "explore", "notifications", "messages", "i", "search", "settings", "compose", "hashtag", "login", "logout", "signup",
  "tos", "privacy", "about", "jobs", "intent", "share", "who_to_follow", "topics", "lists", "bookmarks", "communities", "premium",
  "grok", "chat", "follow", "history", "creators", "verified-choose", "account", "download", "help", "support",
]);
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;

/** "https://x.com/levelsio/status/1" -> "levelsio". Returns null for non-profile pages (home, explore...). */
export function handleFromUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/^(www\.)?(x|twitter)\.com$/.test(u.hostname)) return null;
  const seg = u.pathname.split("/").filter(Boolean)[0];
  if (!seg || RESERVED.has(seg.toLowerCase()) || !HANDLE.test(seg)) return null;
  return seg;
}

export const isXUrl = (url: string | undefined | null) => !!url && /^https:\/\/((www\.)?(x|twitter)\.com)(\/|$)/.test(url);
