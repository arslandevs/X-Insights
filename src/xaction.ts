/**
 * Runs INSIDE an x.com tab (via chrome.scripting.executeScript), so it is a normal same-origin request made with your own session,
 * exactly like pressing the heart on x.com. Must stay self-contained: no imports, no outer variables.
 * X refuses to create posts this way ("looks like it might be automated"), so only like and repost are done here.
 */
export type XAction = "like" | "unlike" | "repost" | "unrepost";

export async function pageAction(action: XAction, tweetId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const CACHE = "xi-ops";
    let cached: { bearer: string; ids: Record<string, string> } | null = null;
    try {
      cached = JSON.parse(sessionStorage.getItem(CACHE) ?? "null");
    } catch {
      /* ignore */
    }
    const op = { like: "FavoriteTweet", unlike: "UnfavoriteTweet", repost: "CreateRetweet", unrepost: "DeleteRetweet" }[action];
    if (!cached || !cached.ids[op]) {
      // The web app ships its operation ids and public bearer token in its own scripts; read them from there.
      let all = "";
      for (const s of Array.from(document.scripts)) if (s.src) all += await (await fetch(s.src)).text().catch(() => "");
      const bearer = all.match(/"(AAAAAAAAAAAAAAAAAAAAA[A-Za-z0-9%]+)"/)?.[1];
      if (!bearer) return { ok: false, error: "Could not read X's web app. Reload the x.com tab and try again." };
      const ids: Record<string, string> = {};
      for (const n of ["FavoriteTweet", "UnfavoriteTweet", "CreateRetweet", "DeleteRetweet"]) {
        const m = all.match(new RegExp(`queryId:"([^"]+)",operationName:"${n}"`));
        if (m) ids[n] = m[1];
      }
      cached = { bearer, ids };
      try {
        sessionStorage.setItem(CACHE, JSON.stringify(cached));
      } catch {
        /* ignore */
      }
    }
    const id = cached.ids[op];
    const ct0 = document.cookie.match(/(?:^|; )ct0=([^;]+)/)?.[1];
    if (!id || !ct0) return { ok: false, error: "X's page is not ready or you are signed out. Reload the x.com tab." };
    const variables = action === "repost" ? { tweet_id: tweetId, dark_request: false } : action === "unrepost" ? { source_tweet_id: tweetId, dark_request: false } : { tweet_id: tweetId };
    const res = await fetch(`/i/api/graphql/${id}/${op}`, {
      method: "POST",
      credentials: "include",
      headers: {
        authorization: `Bearer ${cached.bearer}`,
        "x-csrf-token": ct0,
        "content-type": "application/json",
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-active-user": "yes",
      },
      body: JSON.stringify({ variables, queryId: id }),
    });
    const body = await res.json().catch(() => ({}));
    const err = body?.errors?.[0]?.message as string | undefined;
    if (!res.ok || err) {
      if (err && /already|duplicate/i.test(err)) return { ok: true };
      if (/automated/i.test(err ?? "")) return { ok: false, error: "X declined this request. Do it on x.com." };
      // Operation ids rotate; drop the cache so the next try reads fresh ones.
      try {
        sessionStorage.removeItem(CACHE);
      } catch {
        /* ignore */
      }
      return { ok: false, error: err ?? `X answered ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message ?? e) };
  }
}
