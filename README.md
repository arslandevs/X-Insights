# X Insights

A personal Chrome extension (Manifest V3) that shows analytics for any X profile in the side panel. It is **passive**: it only reads API responses your own browser already loaded on x.com, keeps everything in IndexedDB on your machine, and never sends requests of its own. No X API key. Load unpacked only.

Build spec: the full plan this follows is the "X Insights: Personal Chrome Extension (Build Plan)" you were given. Status below.

## What it does

A side panel that follows the profile in your active x.com tab.

| Tab | What you get |
| --- | --- |
| Overview | Totals strip (impressions, likes, reposts, replies, quotes, bookmarks), posting cadence (streak, best day and hour, heatmaps), interactive charts, best and worst posts (by views, engagement rate or interactions), with-vs-without media comparison |
| Outliers | Scatter of views against response (rate, likes, replies...) with your median post marked. Highlights **Stars** (much more views and response), **Reach only** (lots of views, little response) and **Hidden gems** (few views, much more response). A "What works" chart compares replies, quotes, photo, video, link and text-only posts with your typical post |
| Tweets | Every captured post in the range, one line each, icon columns, hover for the post as it looks on X, search and type/media filters |
| People | Who interacts with you, from notifications and replies |
| Feed | Saved accounts or everything captured, with full text and media, filters, and Like / Repost buttons that work from the panel |
| Settings | Your handle, timezone, saved feed accounts (searchable), capture health, export/import JSON, CSV, clear data, "Load older" backfill |

Ranges: Today, 3, 7, 30, 90 days, 6 months, 1 year, all captured. Everything is stored locally in IndexedDB.

## Install in another browser (Chrome, Brave, Arc, Edge...)

1. Download `x-insights-v0.3.1.zip` from the [latest release](https://github.com/arslandevs/X-Insights/releases/latest) and unzip it somewhere permanent (the browser reads from that folder, so do not delete it).
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, pick the unzipped folder.
3. Reload any open x.com tab.

**Arc** has no side panel, so there the toolbar icon opens the panel in a small window instead. It still follows the tab you last used.

Data is stored per browser. To move it: **Settings → Export JSON** in the old browser, **Import JSON** in the new one.

To update: download the new zip, replace the folder contents, click **Reload** on the extension card.

## Install from source (load unpacked)

```bash
npm install
npm run build        # writes dist/
npm test             # parser, rules, DB, migration and metrics tests
```

1. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, choose the `dist/` folder.
2. Open x.com **after** loading (reload any open X tab so capture installs at `document_start`).
3. Visit a profile and scroll its Posts / Replies / Media tabs. Click the toolbar icon to open the side panel; it follows the active tab.
4. On a non-profile page the panel shows your own account (set **my handle** in Settings if it is not auto-detected).

What to check:

- Overview numbers and the coverage banner ("Based on N tweets captured...") grow as you scroll; re-scrolling does not double count.
- Range dropdown (7/30/90/all) changes every card.
- Tweets tab: sort by column, search text.
- People tab: visit notifications once so likes/replies/retweets of you are captured; hover an avatar for the card.
- Settings: capture-health list (a zero for an operation you visited means X renamed it, see below), export JSON/CSV, import, clear data, backfill (gentle auto-scroll, max 60 s / 200 new tweets).
- Feed: add handles to follow cached accounts.

Inspect raw data in DevTools, Application, IndexedDB, `x-insights`.

If a count stays at zero after scrolling, X may have renamed an operation: find `/i/api/graphql/<hash>/<Name>` in the network tab and add `Name` to `src/captureRules.ts`.

## Architecture

- `src/inject.ts` (page world): wraps `fetch` and `XMLHttpRequest`, copies matching response bodies, never touches requests, headers or cookies
- `src/bridge.ts` (content script): relays only our messages, detects your own handle from the nav Profile link
- `src/background.ts` (service worker): parses, upserts into IndexedDB, broadcasts updates, runs backfill
- `src/parse/*`: `walk` (finds Tweet/User anywhere, by typename or shape), tolerant normalisers, notifications parser
- `src/db.ts`: schema v2 (`users`, `tweets`, `interactions`, `meta`), merge-upsert (a missing value never erases a known one), export/import
- `src/metrics/*`: range, cadence, engagement, interactions; timezone-aware via `src/tz.ts`
- `src/ui/*`: Preact side panel with hand-written SVG charts
- `dev/`: seeded harness with stub `chrome` APIs for visual checks without loading the extension

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
- UI is **Preact**, timezone **local** (changeable in Settings), export **JSON + CSV**, as in the spec's defaults.
- Interactions come from the notifications feed and from posts (replies, quotes, retweets); both are deduped.
- The capture allowlist matches on the URL path, not the hash.

## Known limits

- Only data your browser has loaded is available; a new account needs a scroll or two. The coverage banner makes partial data explicit.
- X changes its internal responses without notice. Fixtures plus tolerant parsers keep repairs small: re-capture a fixture and fix.

## Likes and reposts from the panel

The Feed's Like and Repost buttons send the same request the heart and repost buttons on x.com send, from inside an open x.com tab using your own session. No API key, nothing leaves your browser except that request to x.com. X refuses to create posts this way ("looks like it might be automated"), so **Reply and Quote open X's compose screen in a new tab** with the text prefilled. Use likes and reposts by hand, one click at a time; this is not meant for bulk use.

## Privacy

- Passive capture: only responses your own browser already loaded from x.com.
- All data stays in this browser (IndexedDB and chrome.storage.local). Nothing is sent anywhere else.
- Feed accounts and other settings survive "Clear data".
