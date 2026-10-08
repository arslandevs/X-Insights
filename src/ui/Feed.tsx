import { tweetsByAuthor, userByHandle } from "../db";
import type { TweetRow, UserRow } from "../types";
import { Avatar } from "./Avatar";
import { compact, when } from "./format";
import { useLive } from "./hooks";
import type { Core } from "./load";

interface Item {
  t: TweetRow;
  u: UserRow;
}

/** Saved accounts in one scroll, newest first. Only shows what your browser has already loaded. */
export function Feed({ core, now }: { core: Core; now: number }) {
  const handles = core.settings.feedHandles;
  const { data, loading } = useLive(async () => {
    const out: Item[] = [];
    for (const h of handles) {
      const u = await userByHandle(h);
      if (!u) continue;
      for (const t of await tweetsByAuthor(u.id)) out.push({ t, u });
    }
    return out.sort((a, b) => (b.t.createdAt ?? 0) - (a.t.createdAt ?? 0)).slice(0, 150);
  }, [handles.join(",")]);

  if (!handles.length) return <div class="card"><div class="muted">Save a few accounts in Settings → Feed accounts, then they show up here in one scroll.</div></div>;
  if (loading && !data) return <div class="muted pad">Loading…</div>;
  if (!data?.length) return <div class="muted pad">None of {handles.map((h) => `@${h}`).join(", ")} have been captured yet. Visit their profiles and scroll.</div>;
  return (
    <div>
      {data.map(({ t, u }) => (
        <a key={t.id} class="feed-item" href={`https://x.com/${u.handle}/status/${t.id}`} target="_blank" rel="noreferrer">
          <Avatar size="sm" user={u} />
          <div class="feed-body">
            <div class="small">
              <b>{u.name ?? u.handle}</b> <span class="muted">@{u.handle} · {when(t.createdAt, now, core.tz)}</span>
            </div>
            <div class="feed-text">{t.text}</div>
            <div class="muted small">
              {t.views !== null && <>👁 {compact(t.views)} · </>}♥ {compact(t.likes)} · ↻ {compact(t.retweets)} · 💬 {compact(t.replies)}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
