import { bumpCaptureStat, upsertTweets, upsertUsers } from "./db";
import { captureOp } from "./captureRules";
import { extractAll } from "./parse";

const channel = new BroadcastChannel("xi");

chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "capture" && typeof msg.url === "string" && typeof msg.text === "string") {
    void handleCapture(msg.url, msg.text);
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
    await bumpCaptureStat(op, tweets.length, users.length);
    channel.postMessage({ type: "updated" });
  } catch (e) {
    console.warn("[xi] could not process", op, e);
  }
}
