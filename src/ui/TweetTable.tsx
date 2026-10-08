import { useMemo, useState } from "preact/hooks";
import type { TweetRow, UserRow } from "../types";
import { Icon, type IconName } from "./Icon";
import { useTweetHover } from "./TweetCard";
import { compact, firstLine, timeStr, when } from "./format";

type Col = "createdAt" | "text" | "views" | "likes" | "retweets" | "replies" | "bookmarks";
const COLS: { key: Col; label: string; icon?: IconName }[] = [
  { key: "createdAt", label: "Posted", icon: "clock" },
  { key: "text", label: "Post" },
  { key: "views", label: "Views", icon: "eye" },
  { key: "likes", label: "Likes", icon: "heart" },
  { key: "retweets", label: "Reposts", icon: "repeat" },
  { key: "replies", label: "Replies", icon: "reply" },
  { key: "bookmarks", label: "Bookmarks", icon: "bookmark" },
];

const PAGE = 300;

export function TweetTable({ tweets, handle, user, tz, now, search }: { tweets: TweetRow[]; handle: string; user: UserRow | undefined; tz: string; now: number; search: string }) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "createdAt", dir: -1 });
  const [shown, setShown] = useState(PAGE);
  const hover = useTweetHover(user, tz);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle ? tweets.filter((t) => t.text.toLowerCase().includes(needle)) : tweets;
    const val = (t: TweetRow) => (sort.col === "text" ? t.text.toLowerCase() : (t[sort.col] as number | null));
    return [...filtered].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1; // missing values always last
      if (y === null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [tweets, sort, search]);

  const toggle = (col: Col) => setSort((s) => (s.col === col ? { col, dir: (-s.dir as 1 | -1) } : { col, dir: col === "text" ? 1 : -1 }));

  if (rows.length === 0) return <div class="muted pad">{tweets.length ? "No tweets match your search." : "No tweets in this range."}</div>;
  return (
    <div>
      <div class="table-wrap">
        <table class="tweets">
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key} class={c.key === "text" || c.key === "createdAt" ? "" : "num"} title={c.label} onClick={() => toggle(c.key)} aria-sort={sort.col === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                  {c.icon ? <Icon name={c.icon} size={13} title={c.label} /> : c.label}
                  {sort.col === c.key && <span class="sort">{sort.dir === 1 ? "▲" : "▼"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((t) => (
              <tr key={t.id} {...hover.props(t)}>
                <td class="nowrap muted" title={t.createdAt ? timeStr(t.createdAt, tz) : ""}>
                  {when(t.createdAt, now, tz)}
                </td>
                <td class="content">
                  <a href={`https://x.com/${handle}/status/${t.id}`} target="_blank" rel="noreferrer">
                    {t.kind !== "post" && <span class="kind">{t.kind}</span>}
                    {firstLine(t.text) || "(no text)"}
                  </a>
                </td>
                <td class="num">{t.views === null ? "–" : compact(t.views)}</td>
                <td class="num">{compact(t.likes)}</td>
                <td class="num">{compact(t.retweets)}</td>
                <td class="num">{compact(t.replies)}</td>
                <td class="num">{compact(t.bookmarks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <button class="more" onClick={() => setShown(shown + PAGE)}>
          Show {Math.min(PAGE, rows.length - shown)} more
        </button>
      )}
      {hover.card}
    </div>
  );
}
