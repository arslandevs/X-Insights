import { useEffect, useState } from "preact/hooks";
import { Icon } from "./Icon";
import type { ActiveTab } from "./hooks";

export interface BackfillState {
  running: boolean;
  loaded: number;
  reason?: string;
}

export function useBackfill(): BackfillState {
  const [s, setS] = useState<BackfillState>({ running: false, loaded: 0 });
  useEffect(() => {
    const ch = new BroadcastChannel("xi");
    ch.onmessage = (e) => {
      if (e.data?.type === "backfill") setS({ running: !!e.data.running, loaded: e.data.loaded ?? 0, reason: e.data.reason });
    };
    return () => ch.close();
  }, []);
  return s;
}

/** Scrolls the open profile to pull older posts into the capture. `untilMs` stops it once posts that old are stored. */
export function BackfillButton({ active, untilMs, label = "Load older" }: { active: ActiveTab; untilMs: number | null; label?: string }) {
  const bf = useBackfill();
  const can = active.isX && !!active.handle && active.tabId !== null;
  if (bf.running) {
    return (
      <button class="bf" onClick={() => chrome.runtime.sendMessage({ type: "backfill-stop" })}>
        <Icon name="stop" size={12} /> Stop · {bf.loaded}
      </button>
    );
  }
  return (
    <button
      class="bf"
      disabled={!can}
      title={can ? "Scrolls this profile slowly to load older posts" : "Open a profile on x.com first"}
      onClick={() => chrome.runtime.sendMessage({ type: "backfill-start", tabId: active.tabId, handle: active.handle, untilMs })}
    >
      <Icon name="download" size={12} /> {label}
      {bf.reason && bf.loaded > 0 ? ` (+${bf.loaded})` : ""}
    </button>
  );
}
