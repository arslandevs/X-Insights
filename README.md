# X Insights

A personal Chrome extension (Manifest V3) that shows analytics for any X profile in the side panel. It is **passive**: it only reads API responses your own browser already loaded on x.com, keeps everything in IndexedDB on your machine, and never sends requests of its own. No X API key. Load unpacked only.

Build spec: the full plan this follows is the "X Insights: Personal Chrome Extension (Build Plan)" you were given. Status below.

## Status

| Milestone | State |
| --- | --- |
| M1 Capture and store | **Done** (needs your manual load-unpacked check, see below) |
| M2 Profile header and Tweets table | Not started |
| M3 Cadence | Not started |
| M4 Engagement | Not started |
| M5 People and interactions | Not started |
| M6 Polish | Not started |

## Try M1

```bash
npm install
npm run build        # writes dist/
npm test             # parser, rules and DB tests
```

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, choose the `dist/` folder.
2. Open any profile on x.com and scroll. Click the extension's toolbar icon to open the side panel.
3. The panel shows how many tweets and accounts were captured and a **capture health** list per operation. Scrolling the same profile again must not raise the counts for tweets you already have.
4. To inspect the data: DevTools → Application → IndexedDB → `x-insights` (`users`, `tweets`, `meta`).

If a count stays at zero after scrolling, X may have renamed an operation: check the page's network tab for the `/i/api/graphql/<hash>/<Name>` of the timeline and add `Name` to `src/captureRules.ts`.

## What M1 includes

- `src/inject.ts` (page world): wraps `fetch` and `XMLHttpRequest`, copies matching response bodies, never touches requests, headers or cookies
- `src/bridge.ts` (content script): relays only messages with our signature
- `src/background.ts` (service worker): parses and upserts into IndexedDB, opens the side panel from the toolbar icon
- `src/parse/*`: `walk` (finds Tweet and User objects anywhere), tolerant normalisers for tweets and users
- `src/db.ts`: schema v1 (`users`, `tweets`, `interactions`, `meta`), upsert-by-id with merge (a missing value never erases a known one)
- Minimal side panel (counts + capture health)
- Tests (Vitest): parser tests on sanitised real fixtures, capture rules, DB behaviour (fake-indexeddb)

## Findings from live X responses (these changed the plan slightly)

I checked real responses from a signed-in session before writing the parsers:

1. **The current web client calls its API with `XMLHttpRequest`, not `fetch`.** The XHR wrapper is therefore the main capture path; the fetch wrapper stays as a fallback.
2. **Operation names differ from the spec's list.** Profile tabs use `UserOriginalsTimeline` (Posts), `UserRepliesTimeline` (Replies) and `UserVideoTimeline` (Media), plus `UserByScreenName` and `HomeTimeline`. They are in the allowlist alongside the spec's names. Everything else (recommendations, explore, badge counts) is ignored on purpose so random accounts do not fill the database.
3. **Only the first load of a timeline carries tweets.** Later calls for the same profile return just cursors. So capture has to be installed at `document_start`, which the content scripts do.
4. **The `User` shape is new:** `core.screen_name / name / created_at`, `avatar.image_url`, `profile_bio.description`, `relationship_counts.{followers,following}`, `tweet_counts.tweets`, `relationship_perspectives.{following,followed_by}`. There is no `legacy` block. The normaliser reads the new paths and falls back to the old ones.
5. **Tweets still use `legacy`** for counts, `created_at` and `full_text`; views are `views.count` (a string); long posts use `note_tweet`.
6. **The tweet inside `TweetWithVisibilityResults` has no `__typename`.** `walk` also recognises tweets and users by shape, otherwise those posts would be missed.
7. **X sends bare `{__typename:"Tweet", rest_id}` stubs** (references to replied-to or retweeted posts). They are skipped; storing them would overwrite real counts with zeros.

## Decisions and assumptions

- Build uses **esbuild directly** (not Vite/crxjs): content scripts must be single self-contained files, and one esbuild call per entry is the simplest way. Vitest is used for tests.
- UI is **Preact**, timezone **local**, **Feed tab skipped until M6**, export **JSON + CSV** (later milestones), as in the spec's defaults.
- `interactions` and the notifications parser arrive in M5; the store exists already.
- The capture allowlist matches on the URL path, not the hash.

## Known limits

- Only data your browser has loaded is available; a new account needs a scroll or two. The coverage banner (M2) will make partial data explicit.
- X changes its internal responses without notice. Fixtures plus tolerant parsers keep repairs small: re-capture a fixture and fix.
