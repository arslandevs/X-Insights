import { useState } from "preact/hooks";
import type { TweetRow, UserRow } from "../types";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { cardText, compact, timeStr } from "./format";

export interface TweetHover {
  t: TweetRow;
  top?: number;
  bottom?: number;
}

/** Hover a row, get a card that looks like the post on X. */
export function useTweetHover(user: UserRow | undefined, tz: string) {
  const [h, setH] = useState<TweetHover | null>(null);
  const props = (t: TweetRow) => ({
    onMouseEnter: (e: MouseEvent) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      setH(below > 330 || below > r.top ? { t, top: r.bottom + 4 } : { t, bottom: window.innerHeight - r.top + 4 });
    },
    onMouseLeave: () => setH(null),
  });
  return { props, card: h ? <TweetCard h={h} user={user} tz={tz} /> : null };
}

const Stat = ({ icon, n, label }: { icon: "reply" | "repeat" | "heart" | "bookmark" | "eye" | "quote"; n: number | null; label: string }) => (
  <span class="tc-stat" title={label}>
    <Icon name={icon} size={15} />
    {compact(n)}
  </span>
);

export function TweetCard({ h, user, tz }: { h: TweetHover; user: UserRow | undefined; tz: string }) {
  const { t } = h;
  const media = t.mediaUrls ?? [];
  return (
    <div class="tweet-card" style={{ top: h.top !== undefined ? `${h.top}px` : undefined, bottom: h.bottom !== undefined ? `${h.bottom}px` : undefined }} role="tooltip">
      <div class="tc-head">
        <Avatar size="sm" user={user ?? { id: t.authorId ?? "", handle: "?", name: null, avatar: null }} />
        <div class="tc-who">
          <b>{user?.name ?? user?.handle ?? "Unknown"}</b>
          {user?.verified && <span class="badge-v">✓</span>}
          <span class="muted"> @{user?.handle ?? "?"}</span>
        </div>
        {t.kind !== "post" && <span class="kind">{t.kind}</span>}
      </div>
      <div class="tc-text">{cardText(t.text, t.hasMedia) || "(no text)"}</div>
      {media.length > 0 && (
        <div class={`tc-media n${media.length}`}>
          {media.map((u) => (
            <img key={u} src={u} alt="" loading="lazy" />
          ))}
          {t.hasVideo && (
            <span class="tc-play">
              <Icon name="play" size={22} />
            </span>
          )}
        </div>
      )}
      {t.hasMedia && media.length === 0 && (
        <div class="tc-nomedia">
          <Icon name={t.hasVideo ? "video" : "image"} size={16} /> {t.hasVideo ? "Video" : "Image"} (open the post to see it)
        </div>
      )}
      <div class="tc-time muted">
        {t.createdAt ? timeStr(t.createdAt, tz) : ""}
        {t.views !== null && (
          <>
            {" · "}
            <b>{compact(t.views)}</b> Views
          </>
        )}
      </div>
      <div class="tc-stats">
        <Stat icon="reply" n={t.replies} label="Replies" />
        <Stat icon="repeat" n={t.retweets} label="Reposts" />
        <Stat icon="quote" n={t.quotes} label="Quotes" />
        <Stat icon="heart" n={t.likes} label="Likes" />
        <Stat icon="bookmark" n={t.bookmarks} label="Bookmarks" />
        <Stat icon="eye" n={t.views} label="Views" />
      </div>
    </div>
  );
}
