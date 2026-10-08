import { useEffect, useRef, useState } from "preact/hooks";
import { handleFromUrl, isXUrl } from "../profileUrl";

/** Runs `load` now, whenever `deps` change, and (debounced) whenever the service worker reports new data. */
export function useLive<T>(load: () => Promise<T>, deps: unknown[]): { data: T | undefined; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const my = ++seq.current;
    load()
      .then((d) => {
        if (my === seq.current) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        console.warn("[xi] load failed", e);
        if (my === seq.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    const ch = new BroadcastChannel("xi");
    let timer: ReturnType<typeof setTimeout> | undefined;
    ch.onmessage = (e) => {
      if (e.data?.type !== "updated") return;
      clearTimeout(timer);
      timer = setTimeout(() => setTick((t) => t + 1), 400);
    };
    return () => {
      clearTimeout(timer);
      ch.close();
    };
  }, []);

  return { data, loading, reload: () => setTick((t) => t + 1) };
}

export interface ActiveTab {
  tabId: number | null;
  url: string | null;
  isX: boolean;
  /** profile handle of the active tab, null on home/explore/etc. */
  handle: string | null;
}

/** The side panel follows the active tab of the current window. */
export function useActiveTab(): ActiveTab {
  const [tab, setTab] = useState<ActiveTab>({ tabId: null, url: null, isX: false, handle: null });
  useEffect(() => {
    let alive = true;
    const apply = (t?: chrome.tabs.Tab) => {
      if (!alive) return;
      const url = t?.url ?? null;
      setTab({ tabId: t?.id ?? null, url, isX: isXUrl(url), handle: handleFromUrl(url) });
    };
    const refresh = () => chrome.tabs.query({ active: true, currentWindow: true }).then((r) => apply(r[0])).catch(() => {});
    void refresh();
    const onUpdated = (_id: number, info: chrome.tabs.OnUpdatedInfo, t: chrome.tabs.Tab) => {
      if (info.url || info.status === "complete") if (t.active) apply(t);
    };
    chrome.tabs.onActivated.addListener(refresh);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.windows?.onFocusChanged?.addListener(refresh);
    return () => {
      alive = false;
      chrome.tabs.onActivated.removeListener(refresh);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.windows?.onFocusChanged?.removeListener(refresh);
    };
  }, []);
  return tab;
}

const KEY = "xi-ui";
export function useStored<T>(name: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const all = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      return name in all ? all[name] : initial;
    } catch {
      return initial;
    }
  });
  const set = (x: T) => {
    setV(x);
    try {
      const all = JSON.parse(localStorage.getItem(KEY) ?? "{}");
      all[name] = x;
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  };
  return [v, set];
}
