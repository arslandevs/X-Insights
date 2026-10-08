import { NOTIFICATION_OPS, captureOp } from "./captureRules";
import { bumpCaptureStat, counts, setMeta, upsertInteractions, upsertTweets, upsertUsers } from "./db";
import { extractAll } from "./parse";
import { parseNotifications } from "./parse/notifications";

const channel = new BroadcastChannel("xi");

chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "capture" && typeof msg.url === "string" && typeof msg.text === "string") {
    void handleCapture(msg.url, msg.text);
  } else if (msg.type === "me" && typeof msg.handle === "string") {
    void setMeta("meHandleDetected", msg.handle).then(() => channel.postMessage({ type: "updated" }));
  } else if (msg.type === "backfill-start" && typeof msg.tabId === "number") {
    void startBackfill(msg.tabId);
    sendResponse({ ok: true });
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
const BACKFILL_MAX_MS = 60_000;
const BACKFILL_MAX_TWEETS = 200;
const backfill = { running: false, stop: false };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function startBackfill(tabId: number) {
  if (backfill.running) return;
  backfill.running = true;
  backfill.stop = false;
  const started = Date.now();
  const base = (await counts()).tweets;
  let reason = "time limit";
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
