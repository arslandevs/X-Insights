import { useMemo, useState } from "preact/hooks";
import type { TweetRow } from "../types";
import { compact, timeStr, when } from "./format";

type Col = "createdAt" | "text" | "views" | "likes" | "retweets" | "replies" | "bookmarks";
const COLS: { key: Col; label: string; num?: boolean }[] = [
  { key: "createdAt", label: "Time" },
  { key: "text", label: "Content" },
  { key: "views", label: "Views", num: true },
  { key: "likes", label: "Likes", num: true },
  { key: "retweets", label: "RTs", num: true },
  { key: "replies", label: "Replies", num: true },
  { key: "bookmarks", label: "Bkmk", num: true },
];

const PAGE = 200;

export function TweetTable({ tweets, handle, tz, now }: { tweets: TweetRow[]; handle: string; tz: string; now: number }) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "createdAt", dir: -1 });
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
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
  }, [tweets, sort, q]);

  const toggle = (col: Col) => setSort((s) => (s.col === col ? { col, dir: (-s.dir as 1 | -1) } : { col, dir: col === "text" ? 1 : -1 }));

  return (
    <div>
      <div class="row-gap">
        <input class="search" type="search" placeholder="Search these tweets" value={q} onInput={(e) => { setQ((e.currentTarget as HTMLInputElement).value); setShown(PAGE); }} />
        <span class="muted small">{rows.length} tweets</span>
      </div>
      {rows.length === 0 ? (
        <div class="muted pad">{tweets.length ? "No tweets match your search." : "No tweets in this range."}</div>
      ) : (
        <div class="table-wrap">
          <table class="tweets">
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.key} class={c.num ? "num" : ""} onClick={() => toggle(c.key)} aria-sort={sort.col === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                    {c.label}
                    {sort.col === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((t) => (
                <tr key={t.id}>
                  <td class="nowrap muted" title={t.createdAt ? timeStr(t.createdAt, tz) : ""}>
                    {when(t.createdAt, now, tz)}
                  </td>
                  <td class="content">
                    <a href={`https://x.com/${handle}/status/${t.id}`} target="_blank" rel="noreferrer" title={t.text}>
                      {t.kind !== "post" && <span class="kind">{t.kind}</span>}
                      {t.text || "(no text)"}
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
      )}
      {rows.length > shown && (
        <button class="more" onClick={() => setShown(shown + PAGE)}>
          Show {Math.min(PAGE, rows.length - shown)} more
        </button>
      )}
    </div>
  );
}
