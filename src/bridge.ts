// Content script (isolated world): relays only messages carrying our signature to the service worker,
// and tells it which account is logged in (read from the page's own navigation, nothing is requested).
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

function detectMe(): string | null {
  const a = document.querySelector<HTMLAnchorElement>('a[data-testid="AppTabBar_Profile_Link"], nav a[aria-label="Profile"]');
  if (!a) return null;
  try {
    const m = /^\/([A-Za-z0-9_]{1,15})\/?$/.exec(new URL(a.href, location.href).pathname);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

let last: string | null = null;
setInterval(() => {
  const h = detectMe();
  if (h && h !== last) {
    last = h;
    try {
      chrome.runtime.sendMessage({ type: "me", handle: h }).catch(() => {});
    } catch {
      /* ignore */
    }
  }
}, 3000);

// Arc paints its theme variables onto every page. Arc has no usable side panel, so the service worker switches the toolbar icon to a popup.
window.addEventListener("DOMContentLoaded", () => {
  try {
    if (getComputedStyle(document.documentElement).getPropertyValue("--arc-palette-title").trim()) chrome.runtime.sendMessage({ type: "arc" }).catch(() => {});
  } catch {
    /* ignore */
  }
});
