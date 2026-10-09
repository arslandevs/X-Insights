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

// ---- on-page dock: a small handle on the right edge of x.com that opens the panel over the page ------------------
// Works in every Chromium browser, including those where the toolbar icon or the side panel does not (Arc).
const DOCK_KEY = "xi-dock";
function mountDock() {
  if (document.getElementById("xi-dock-root") || !document.body) return;
  const root = document.createElement("div");
  root.id = "xi-dock-root";
  const shadow = root.attachShadow({ mode: "closed" });
  shadow.innerHTML = `<style>
    .btn{position:fixed;right:0;top:46%;z-index:2147483646;width:34px;height:46px;border:0;border-radius:12px 0 0 12px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.45);cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;opacity:.85}
    .btn:hover{opacity:1}
    .btn img{width:26px;height:26px;border-radius:6px;pointer-events:none}
    .btn.shift{right:440px}
    .panel{position:fixed;top:0;right:0;bottom:0;width:440px;height:100vh;max-width:100vw;z-index:2147483647;border:0;border-left:1px solid #2f3336;background:#000;box-shadow:-8px 0 28px rgba(0,0,0,.5);display:none}
    .panel.open{display:block}
  </style><button class="btn" title="X Insights"><img alt="X Insights"></button><iframe class="panel" title="X Insights"></iframe>`;
  const btn = shadow.querySelector<HTMLButtonElement>(".btn")!;
  const frame = shadow.querySelector<HTMLIFrameElement>(".panel")!;
  shadow.querySelector<HTMLImageElement>("img")!.src = chrome.runtime.getURL("icons/icon48.png");
  const set = (open: boolean) => {
    if (open && !frame.src) frame.src = chrome.runtime.getURL("sidepanel.html?embed=1");
    frame.classList.toggle("open", open);
    btn.classList.toggle("shift", open);
    try {
      sessionStorage.setItem(DOCK_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  btn.addEventListener("click", () => set(!frame.classList.contains("open")));
  document.body.appendChild(root);
  try {
    if (sessionStorage.getItem(DOCK_KEY) === "1") set(true);
  } catch {
    /* ignore */
  }
}
window.addEventListener("DOMContentLoaded", () => {
  try {
    chrome.storage.local.get("xi-dock-off").then((r) => !r["xi-dock-off"] && mountDock()).catch(() => {});
  } catch {
    /* extension reloaded */
  }
});
