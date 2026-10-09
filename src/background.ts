import { NOTIFICATION_OPS, captureOp } from "./captureRules";
import { bumpCaptureStat, counts, setMeta, tweetsByAuthor, upsertInteractions, upsertTweets, upsertUsers, userByHandle } from "./db";
import { extractAll } from "./parse";
import { parseNotifications } from "./parse/notifications";
import { pageAction, type XAction } from "./xaction";

const channel = new BroadcastChannel("xi");

// Toolbar click: try the side panel; if no panel answers (browsers such as Arc expose the API but show nothing), open the same
// panel in a small window instead.
let panelWindow: number | undefined;
const panelAlive = (ms: number) =>
  new Promise<boolean>((resolve) => {
    const ch = new BroadcastChannel("xi");
    const done = (v: boolean) => {
      clearTimeout(timer);
      ch.close();
      resolve(v);
    };
    const timer = setTimeout(() => done(false), ms);
    ch.onmessage = (e) => e.data?.type === "panel-alive" && done(true);
    ch.postMessage({ type: "panel-ping" });
  });

chrome.action.onClicked.addListener(async (tab) => {
  // Must be called straight away: opening a side panel needs the click's user gesture.
  const opened = typeof chrome.sidePanel?.open === "function" && tab.windowId !== undefined ? chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {}) : Promise.resolve();
  await opened;
  if (await panelAlive(1200)) {
    if (panelWindow !== undefined) await chrome.windows.update(panelWindow, { focused: true }).catch(() => (panelWindow = undefined));
    return;
  }
  const w = await chrome.windows.create({ url: chrome.runtime.getURL("sidepanel.html"), type: "popup", width: 440, height: 900 });
  panelWindow = w?.id;
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "capture" && typeof msg.url === "string" && typeof msg.text === "string") {
    void handleCapture(msg.url, msg.text);
  } else if (msg.type === "me" && typeof msg.handle === "string") {
    void setMeta("meHandleDetected", msg.handle).then(() => channel.postMessage({ type: "updated" }));
  } else if (msg.type === "backfill-start" && typeof msg.tabId === "number") {
    void startBackfill(msg.tabId, typeof msg.handle === "string" ? msg.handle : null, typeof msg.untilMs === "number" ? msg.untilMs : null);
    sendResponse({ ok: true });
  } else if (msg.type === "x-action" && typeof msg.tweetId === "string") {
    void runXAction(msg.action as XAction, msg.tweetId).then(sendResponse);
    return true; // answer asynchronously
  } else if (msg.type === "backfill-stop") {
    backfill.stop = true;
    sendResponse({ ok: true });
  }
});

async function handleCapture(url: string, text: string) {
  const op = captureOp(url);
  if (!op) return;
  try {
    const json = JSON.parse(text);
    const { users, tweets } = extractAll(json);
    await upsertUsers(users);
    await upsertTweets(tweets);
    if (NOTIFICATION_OPS.has(op)) await upsertInteractions(parseNotifications(json));
    await bumpCaptureStat(op, tweets.length, users.length);
    channel.postMessage({ type: "updated" });
  } catch (e) {
    console.warn("[xi] could not process", op, e);
  }
}

// ---- optional, user-triggered backfill: scrolls the profile slowly, then stops ---------------------
const BACKFILL_MAX_MS = 4 * 60_000;
const BACKFILL_MAX_TWEETS = 3000;
/** Rounds in a row with nothing new before we call it the end of the timeline. */
const BACKFILL_STALL_ROUNDS = 5;
const backfill = { running: false, stop: false };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** How many stored posts of this profile are at least as old as `untilMs`. A pinned old post counts once, so we ask for three. */
async function olderThan(handle: string | null, untilMs: number | null): Promise<number> {
  if (!handle || untilMs === null) return 0;
  const u = await userByHandle(handle);
  if (!u) return 0;
  return (await tweetsByAuthor(u.id)).filter((t) => t.createdAt !== null && t.createdAt <= untilMs).length;
}

async function startBackfill(tabId: number, handle: string | null, untilMs: number | null) {
  if (backfill.running) return;
  backfill.running = true;
  backfill.stop = false;
  const started = Date.now();
  const base = (await counts()).tweets;
  let reason = "time limit";
  let last = 0;
  let stalled = 0;
  channel.postMessage({ type: "backfill", running: true, loaded: 0 });
  try {
    while (Date.now() - started < BACKFILL_MAX_MS) {
      if (backfill.stop) {
        reason = "stopped";
        break;
      }
      const loaded = (await counts()).tweets - base;
      if (loaded >= BACKFILL_MAX_TWEETS) {
        reason = "reached the limit";
        break;
      }
      if ((await olderThan(handle, untilMs)) >= 3) {
        reason = "reached the start of the range";
        break;
      }
      stalled = loaded > last ? 0 : stalled + 1;
      last = loaded;
      if (stalled >= BACKFILL_STALL_ROUNDS) {
        reason = "no older posts left";
        break;
      }
      await chrome.scripting.executeScript({ target: { tabId }, func: () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }) });
      channel.postMessage({ type: "backfill", running: true, loaded });
      await sleep(1500 + Math.random() * 1500);
    }
  } catch (e) {
    reason = "the tab is no longer available";
  } finally {
    const loaded = (await counts()).tweets - base;
    backfill.running = false;
    channel.postMessage({ type: "backfill", running: false, loaded, reason });
    channel.postMessage({ type: "updated" });
  }
}

/** Like or repost through an open x.com tab (it needs that tab's session). */
async function runXAction(action: XAction, tweetId: string): Promise<{ ok: boolean; error?: string }> {
  if (!["like", "unlike", "repost", "unrepost"].includes(action) || !/^\d+$/.test(tweetId)) return { ok: false, error: "Bad request" };
  const tabs = await chrome.tabs.query({ url: ["https://x.com/*", "https://twitter.com/*"] });
  const tab = tabs.find((t) => t.active) ?? tabs[0];
  if (!tab?.id) return { ok: false, error: "Open x.com in a tab first, then try again." };
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pageAction, args: [action, tweetId] });
    return (r?.result as { ok: boolean; error?: string }) ?? { ok: false, error: "No answer from the x.com tab. Reload it." };
  } catch (e) {
    return { ok: false, error: "Could not reach the x.com tab. Reload it." };
  }
}
