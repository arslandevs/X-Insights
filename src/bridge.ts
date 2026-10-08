// Content script (isolated world): relays only messages carrying our signature to the service worker.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const d = event.data as { source?: string; url?: string; text?: string } | null;
  if (!d || d.source !== "xi-capture" || typeof d.url !== "string" || typeof d.text !== "string") return;
  try {
    chrome.runtime.sendMessage({ type: "capture", url: d.url, text: d.text }).catch(() => {});
  } catch {
    /* extension reloaded; ignore */
  }
});
