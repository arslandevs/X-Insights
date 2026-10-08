// Runs in the page's own JS world at document_start. Passive: it only copies responses X already received.
import { captureOp } from "./captureRules";

const SOURCE = "xi-capture";

function emit(url: string, text: string) {
  try {
    window.postMessage({ source: SOURCE, url, text }, "*");
  } catch {
    /* never break the page */
  }
}

// fetch
const origFetch = window.fetch;
window.fetch = function (this: unknown, ...args: Parameters<typeof fetch>) {
  const p = origFetch.apply(this, args);
  try {
    const first = args[0];
    const url = typeof first === "string" ? first : first instanceof URL ? first.href : (first as Request).url;
    if (captureOp(url)) {
      p.then((res) => {
        try {
          res.clone().text().then((t) => emit(url, t)).catch(() => {});
        } catch {
          /* ignore */
        }
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
  return p;
} as typeof fetch;

// XMLHttpRequest (the current X web client uses this for its API calls)
const origOpen = XMLHttpRequest.prototype.open;
const origSend = XMLHttpRequest.prototype.send;
type Tagged = XMLHttpRequest & { __xiUrl?: string };

XMLHttpRequest.prototype.open = function (this: Tagged, method: string, url: string | URL, ...rest: unknown[]) {
  try {
    this.__xiUrl = String(url);
  } catch {
    /* ignore */
  }
  return (origOpen as (...a: unknown[]) => void).call(this, method, url, ...rest);
} as typeof XMLHttpRequest.prototype.open;

XMLHttpRequest.prototype.send = function (this: Tagged, body?: Document | XMLHttpRequestBodyInit | null) {
  try {
    const url = this.__xiUrl;
    if (url && captureOp(url)) {
      this.addEventListener("load", () => {
        try {
          if (this.responseType === "" || this.responseType === "text") emit(url, this.responseText);
          else if (this.responseType === "json" && this.response) emit(url, JSON.stringify(this.response));
        } catch {
          /* ignore */
        }
      });
    }
  } catch {
    /* ignore */
  }
  return origSend.call(this, body);
};
