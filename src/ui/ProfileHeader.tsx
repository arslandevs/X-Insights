import type { Coverage } from "../metrics/range";
import type { Core } from "./load";
import { Avatar } from "./Avatar";
import { ageStr, compact, dateStr } from "./format";

const big = (url: string | null) => (url ? url.replace("_normal.", "_bigger.") : "");

export function CoverageBanner({ cov, range, handle, tz }: { cov: Coverage; range: string; handle: string | null; tz: string }) {
  if (cov.count === 0) {
    return (
      <div class="banner warn-box">
        No tweets captured for {handle ? `@${handle}` : "this account"} yet. Open the profile on x.com and scroll; stats fill in as X loads posts in your browser.
      </div>
    );
  }
  return (
    <div class="banner">
      Based on <b>{cov.count}</b> tweets captured, from <b>{dateStr(cov.earliest, tz)}</b> to <b>{dateStr(cov.latest, tz)}</b>. Scroll the profile to capture more.
      {cov.widerThanCaptured && <div class="warn">Your selected range reaches back further than what was captured, so numbers cover only the captured part.</div>}
      {range === "all" && <div class="muted small">"All captured" is not an account's full history: X lists roughly its latest 3,200 posts.</div>}
    </div>
  );
}

export function ProfileHeader({ core, now }: { core: Core; now: number }) {
  const u = core.user;
  if (!u) {
    return (
      <div class="card">
        <div class="big">{core.handle ? `@${core.handle}` : "X Insights"}</div>
        <div class="muted">
          {core.handle ? "Open or scroll this profile to capture data." : "Open a profile on x.com, or set your handle in Settings."}
        </div>
        <div class="muted small">So far: {core.counts.tweets} tweets and {core.counts.users} accounts captured.</div>
      </div>
    );
  }
  const years = u.createdAt ? Math.max((now - u.createdAt) / (365.25 * 864e5), 1 / 12) : null;
  const perYear = years && u.postsCount !== null ? Math.round(u.postsCount / years) : null;
  const ratio = u.followers !== null && u.following ? u.followers / u.following : null;
  return (
    <div class="card profile">
      <div class="p-top">
        <Avatar user={u} big />
        <div class="p-id">
          <div class="p-name">
            <a href={`https://x.com/${u.handle}`} target="_blank" rel="noreferrer">
              {u.name ?? u.handle}
            </a>
            {u.verified && <span class="badge-v" title="Verified">✓</span>}
          </div>
          <div class="muted">@{u.handle}{core.isMe ? " · you" : ""}</div>
        </div>
      </div>
      {u.bio && <div class="bio">{u.bio}</div>}
      <div class="facts">
        <div>
          <div class="v">{compact(u.followers)}</div>
          <div class="muted small">followers</div>
        </div>
        <div>
          <div class="v">{compact(u.following)}</div>
          <div class="muted small">following</div>
        </div>
        <div>
          <div class="v">{compact(u.postsCount)}</div>
          <div class="muted small">posts</div>
        </div>
        <div>
          <div class="v">{ageStr(u.createdAt, now)}</div>
          <div class="muted small">on X</div>
        </div>
      </div>
      <div class="muted small">
        Joined {dateStr(u.createdAt, core.tz)}
        {perYear !== null && <> · about {compact(perYear)} posts a year</>}
        {ratio !== null && <> · {ratio >= 10 ? Math.round(ratio) : ratio >= 1 ? ratio.toFixed(1) : ratio.toFixed(2)} followers per account followed</>}
      </div>
    </div>
  );
}
