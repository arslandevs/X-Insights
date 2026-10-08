import { useMemo, useState } from "preact/hooks";
import { allTweets, allUsers, tweetsByAuthor, userByHandle } from "../db";
import { applyFilter, type FilterKey } from "../metrics/filter";
import type { TweetRow, UserRow } from "../types";
import { Avatar } from "./Avatar";
import { FilterPicker } from "./FilterPicker";
import { Icon } from "./Icon";
import { cardText, compact, when } from "./format";
import { useLive, useStored } from "./hooks";
import type { Core } from "./load";

interface Item {
  t: TweetRow;
  u: UserRow;
}

type Source = "saved" | "all";
const PAGE = 60;

/** X's own intents: they open X's compose or confirm screen, signed in as you. No API key, nothing sent from here. */
const intent = (path: string, params: Record<string, string>) => {
  const url = `https://x.com/intent/${path}?${new URLSearchParams(params)}`;
  window.open(url, "xi-intent", "popup,width=600,height=720");
};

const LINK = /(https?:\/\/\S+)/g;
/** A post whose text still ends in the "…" X puts on a preview was not sent in full. */
const looksCut = (text: string) => /…\s*(https:\/\/t\.co\/\w+)?\s*$/.test(text);

function Linked({ text }: { text: string }) {
  return (
    <>
      {text.split(LINK).map((part, i) =>
        i % 2 ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            {part.replace(/^https?:\/\/(www\.)?/, "").slice(0, 28)}
            {part.length > 36 ? "…" : ""}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

function FeedItem({ t, u, now, tz }: { t: TweetRow; u: UserRow; now: number; tz: string }) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const url = `https://x.com/${u.handle}/status/${t.id}`;
  const media = t.mediaUrls ?? [];
  const text = cardText(t.text, t.hasMedia);
  return (
    <div class="fi">
      <Avatar size="sm" user={u} />
      <div class="fi-body">
        <div class="fi-head">
          <a href={`https://x.com/${u.handle}`} target="_blank" rel="noreferrer"><b>{u.name ?? u.handle}</b></a>
          <span class="muted small">@{u.handle} · <a href={url} target="_blank" rel="noreferrer">{when(t.createdAt, now, tz)}</a></span>
          {t.kind !== "post" && <span class={`kind k-${t.kind}`}>{t.kind}</span>}
        </div>
        <div class="fi-text"><Linked text={text} /></div>
        {looksCut(t.text) && (
          <a class="fi-more" href={url} target="_blank" rel="noreferrer">Show the rest on X</a>
        )}
        {media.length > 0 && (
          <a class={`fi-media n${media.length}`} href={url} target="_blank" rel="noreferrer" title="Open on X">
            {media.map((m) => <img key={m} src={m} alt="" loading="lazy" />)}
            {t.hasVideo && <span class="tc-play"><Icon name="play" size={22} /></span>}
          </a>
        )}
        {t.hasMedia && media.length === 0 && (
          <a class="tc-nomedia" href={url} target="_blank" rel="noreferrer">
            <Icon name={t.hasVideo ? "video" : "image"} size={16} /> {t.hasVideo ? "Video" : "Image"}: shows here once this post is captured again
          </a>
        )}
        <div class="fi-stats">
          <span title="Views"><Icon name="eye" size={13} /> {compact(t.views)}</span>
          <span title="Likes"><Icon name="heart" size={13} /> {compact(t.likes)}</span>
          <span title="Reposts"><Icon name="repeat" size={13} /> {compact(t.retweets)}</span>
          <span title="Replies"><Icon name="reply" size={13} /> {compact(t.replies)}</span>
          <span title="Bookmarks"><Icon name="bookmark" size={13} /> {compact(t.bookmarks)}</span>
        </div>
        <div class="fi-actions">
          <button class="fa" title="Reply" onClick={() => setReplying(!replying)}><Icon name="reply" size={15} /> Reply</button>
          <button class="fa rt" title="Repost on X" onClick={() => intent("retweet", { tweet_id: t.id })}><Icon name="repeat" size={15} /> Repost</button>
          <button class="fa" title="Quote" onClick={() => intent("post", { text: `${draft ? draft + " " : ""}${url}` })}><Icon name="quote" size={15} /> Quote</button>
          <button class="fa like" title="Like on X" onClick={() => intent("like", { tweet_id: t.id })}><Icon name="heart" size={15} /> Like</button>
        </div>
        {replying && (
          <div class="reply-box">
            <textarea placeholder={`Reply to @${u.handle}`} value={draft} onInput={(e) => setDraft((e.currentTarget as HTMLTextAreaElement).value)} maxLength={280} />
            <div class="row-gap">
              <span class="muted small">{draft.length}/280 · opens X to post</span>
              <button disabled={!draft.trim()} onClick={() => intent("post", { in_reply_to: t.id, text: draft })}>Reply</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Saved accounts (or everything your browser has loaded) in one scroll, newest first. */
export function Feed({ core, now }: { core: Core; now: number }) {
  const handles = core.settings.feedHandles;
  const [source, setSource] = useStored<Source>("feedSource", "saved");
  const [ft, setFt] = useStored<FilterKey>("feedFilter", "all");
  const [shown, setShown] = useState(PAGE);
  const { data, loading } = useLive(async () => {
    const out: Item[] = [];
    if (source === "all") {
      const users = new Map((await allUsers()).map((u) => [u.id, u]));
      for (const t of await allTweets()) {
        const u = t.authorId ? users.get(t.authorId) : undefined;
        if (u) out.push({ t, u });
      }
    } else {
      for (const h of handles) {
        const u = await userByHandle(h);
        if (!u) continue;
        for (const t of await tweetsByAuthor(u.id)) out.push({ t, u });
      }
    }
    return out.sort((a, b) => (b.t.createdAt ?? 0) - (a.t.createdAt ?? 0));
  }, [source, handles.join(",")]);

  const items = useMemo(() => {
    if (!data) return [];
    const keep = new Set(applyFilter(data.map((d) => d.t), ft).map((t) => t.id));
    return data.filter((d) => keep.has(d.t.id));
  }, [data, ft]);

  const bar = (
    <div class="feed-bar">
      <select class="range" value={source} onChange={(e) => { setSource((e.currentTarget as HTMLSelectElement).value as Source); setShown(PAGE); }} aria-label="Feed source">
        <option value="saved">Saved accounts</option>
        <option value="all">Everything captured</option>
      </select>
      <FilterPicker value={ft} onChange={(k) => { setFt(k); setShown(PAGE); }} />
    </div>
  );

  if (source === "saved" && !handles.length) {
    return <div>{bar}<div class="card"><div class="muted">Save a few accounts in Settings → Feed accounts, or switch to "Everything captured".</div></div></div>;
  }
  if (loading && !data) return <div class="muted pad">Loading…</div>;
  if (!items.length) {
    return <div>{bar}<div class="muted pad">{data?.length ? "Nothing matches this filter." : source === "saved" ? `None of ${handles.map((h) => `@${h}`).join(", ")} have been captured yet. Visit their profiles and scroll.` : "Nothing captured yet. Scroll your Home timeline on x.com."}</div></div>;
  }
  return (
    <div>
      {bar}
      {items.slice(0, shown).map(({ t, u }) => <FeedItem key={t.id} t={t} u={u} now={now} tz={core.tz} />)}
      {items.length > shown && <button class="more" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, items.length - shown)} more</button>}
    </div>
  );
}
