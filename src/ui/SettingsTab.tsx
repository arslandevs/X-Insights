import { useEffect, useMemo, useState } from "preact/hooks";
import { allUsers } from "../db";
import type { UserRow } from "../types";
import { Avatar } from "./Avatar";
import { TWEET_OPS } from "../captureRules";
import { saveSettings } from "../settings";
import type { TweetRow } from "../types";
import { useBackfill } from "./Backfill";
import { clearData, exportCsv, exportJson, importJsonFile } from "./actions";
import { compact, when } from "./format";
import type { ActiveTab } from "./hooks";
import type { Core } from "./load";

const COMMON_TZ = ["local", "UTC", "Asia/Karachi", "Asia/Kolkata", "Asia/Dubai", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles"];

export function SettingsTab({ core, active, tweetsForCsv, now }: { core: Core; active: ActiveTab; tweetsForCsv: TweetRow[]; now: number }) {
  const s = core.settings;
  const [handle, setHandle] = useState(s.meHandle ?? "");
  const [feedInput, setFeedInput] = useState("");
  const [msg, setMsg] = useState("");
  const bf = useBackfill();
  const [dock, setDock] = useState(true);
  useEffect(() => {
    chrome.storage.local.get("xi-dock-off").then((r) => setDock(!r["xi-dock-off"])).catch(() => {});
  }, []);
  const [known, setKnown] = useState<UserRow[]>([]);
  useEffect(() => {
    void allUsers().then(setKnown);
  }, [core.counts.users]);
  const matches = useMemo(() => {
    const q = feedInput.trim().replace(/^@/, "").toLowerCase();
    if (!q) return [];
    const have = new Set(s.feedHandles.map((h) => h.toLowerCase()));
    return known
      .filter((u) => !have.has(u.handle.toLowerCase()) && (u.handleLower.includes(q) || (u.name ?? "").toLowerCase().includes(q)))
      .sort((a, b) => Number(b.handleLower.startsWith(q)) - Number(a.handleLower.startsWith(q)) || (b.followers ?? 0) - (a.followers ?? 0))
      .slice(0, 6);
  }, [feedInput, known, s.feedHandles]);
  const [usage, setUsage] = useState<string>("");

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage(e.usage ? `${(e.usage / 1048576).toFixed(1)} MB` : "")).catch(() => {});
  }, [core.counts.tweets]);

  const update = (patch: Partial<typeof s>) => {
    void saveSettings({ ...s, ...patch }).then(() => new BroadcastChannel("xi").postMessage({ type: "updated" }));
  };

  const cleanHandle = (v: string) => v.trim().replace(/^@/, "");
  const addFeed = (picked?: string) => {
    const h = picked ?? cleanHandle(feedInput);
    if (!/^[A-Za-z0-9_]{1,15}$/.test(h)) return setMsg("That does not look like an X handle.");
    if (s.feedHandles.some((x) => x.toLowerCase() === h.toLowerCase())) return setMsg("Already in the list.");
    setFeedInput("");
    setMsg("");
    update({ feedHandles: [...s.feedHandles, h] });
  };

  const ops = Object.entries(core.stats).sort((a, b) => b[1].lastAt - a[1].lastAt);
  const outdated = ops.filter(([op, st]) => TWEET_OPS.has(op) && st.count >= 5 && st.tweets === 0);
  const lastCapture = ops.length ? Math.max(...ops.map(([, st]) => st.lastAt)) : null;
  const canBackfill = active.isX && !!active.handle && active.tabId !== null;

  return (
    <div>
      <h2>Account</h2>
      <div class="card">
        <label class="field">
          <span class="muted">My handle</span>
          <input
            type="text"
            placeholder={core.meHandle ? `@${core.meHandle} (detected)` : "@yourhandle"}
            value={handle}
            onInput={(e) => setHandle((e.currentTarget as HTMLInputElement).value)}
            onBlur={() => update({ meHandle: cleanHandle(handle) || null })}
          />
        </label>
        <label class="field">
          <span class="muted">Timezone for dates, heatmaps and streaks</span>
          <input
            list="tzs"
            type="text"
            value={s.timezone}
            onChange={(e) => update({ timezone: (e.currentTarget as HTMLInputElement).value.trim() || "local" })}
          />
          <datalist id="tzs">
            {COMMON_TZ.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </label>
        <div class="muted small">Using {core.tz}. "local" follows this computer.</div>
      </div>

      <h2>On x.com</h2>
      <div class="card">
        <label class="row">
          <span>Show the X Insights button on x.com pages</span>
          <input type="checkbox" checked={dock} onChange={(e) => { const on = (e.currentTarget as HTMLInputElement).checked; setDock(on); void chrome.storage.local.set({ "xi-dock-off": !on }); }} />
        </label>
        <div class="muted small">A small tab on the right edge opens the panel over the page. Reload the x.com tab after changing this.</div>
      </div>

      <h2>Feed accounts</h2>
      <div class="card">
        <div class="row-gap">
          <input class="grow" type="text" placeholder="Search captured accounts or type @handle" value={feedInput} onInput={(e) => setFeedInput((e.currentTarget as HTMLInputElement).value)} onKeyDown={(e) => e.key === "Enter" && addFeed()} />
          <button onClick={() => addFeed()}>Add</button>
        </div>
        {matches.length > 0 && (
          <div class="suggest">
            {matches.map((u) => (
              <button key={u.id} class="sg" onClick={() => addFeed(u.handle)}>
                <Avatar size="sm" user={u} />
                <span class="sg-t"><b>{u.name ?? u.handle}</b><span class="muted small">@{u.handle}{u.followers !== null ? ` · ${compact(u.followers)} followers` : ""}</span></span>
              </button>
            ))}
          </div>
        )}
        {feedInput.trim() && !matches.length && <div class="muted small spaced">No captured account matches. Press Add to save "{feedInput.trim().replace(/^@/, "")}" as typed; it fills in once you visit its profile.</div>}
        {msg && <div class="warn small">{msg}</div>}
        {s.feedHandles.map((h) => (
          <div class="row" key={h}>
            <span>@{h}</span>
            <button class="link" onClick={() => update({ feedHandles: s.feedHandles.filter((x) => x !== h) })}>
              remove
            </button>
          </div>
        ))}
        {!s.feedHandles.length && <div class="muted small">No accounts saved.</div>}
      </div>

      <h2>Capture health</h2>
      <div class="card">
        <div class="row">
          <span class="muted">Last capture</span>
          <span>{lastCapture ? `${when(lastCapture, now)} ago` : "never"}</span>
        </div>
        {outdated.length > 0 && (
          <div class="warn-box small">
            Parser may be outdated (X changed its format): {outdated.map(([op]) => op).join(", ")} keep arriving but no tweets could be read.
          </div>
        )}
        {ops.length === 0 && <div class="muted small">Nothing captured yet. Open a profile on x.com and scroll.</div>}
        {ops.map(([op, st]) => (
          <div class="row" key={op}>
            <span>{op}</span>
            <span class="muted small">
              {st.count}× · {st.tweets} tweets · {st.users} users · {when(st.lastAt, now)}
            </span>
          </div>
        ))}
        <div class="muted small spaced">Responses that hold only paging cursors are normal; the first load of a timeline carries the tweets.</div>
      </div>

      <h2>Load more history</h2>
      <div class="card">
        <div class="muted small">
          Scrolls the profile open in your active tab slowly (one step every 1.5–3 seconds) and stops after a few minutes, about 3,000 tweets, or when the timeline ends. Off unless you press the button. Heavy automation can trigger X rate limits on your account.
        </div>
        <div class="row-gap spaced">
          {bf.running ? (
            <button onClick={() => chrome.runtime.sendMessage({ type: "backfill-stop" })}>Stop</button>
          ) : (
            <button disabled={!canBackfill} onClick={() => chrome.runtime.sendMessage({ type: "backfill-start", tabId: active.tabId, handle: active.handle, untilMs: null })}>
              Load more history
            </button>
          )}
          <span class="muted small">
            {bf.running ? `Scrolling… ${bf.loaded} new tweets` : bf.reason ? `Stopped (${bf.reason}): ${bf.loaded} new tweets` : canBackfill ? `On @${active.handle}` : "Open a profile on x.com first"}
          </span>
        </div>
      </div>

      <h2>Data</h2>
      <div class="card">
        <div class="row">
          <span class="muted">Stored</span>
          <span>
            {compact(core.counts.tweets)} tweets · {compact(core.counts.users)} accounts · {compact(core.counts.interactions)} interactions {usage && `· ${usage}`}
          </span>
        </div>
        <div class="row-gap spaced wrap">
          <button onClick={() => void exportJson()}>Export JSON</button>
          <button onClick={() => void exportCsv(tweetsForCsv, core.handle ?? "tweets")} disabled={!tweetsForCsv.length}>
            Export tweets CSV
          </button>
          <label class="button">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = (e.currentTarget as HTMLInputElement).files?.[0];
                if (f) importJsonFile(f).then(setMsg).catch((err) => setMsg(String(err.message ?? err)));
              }}
            />
          </label>
          <button
            class="danger"
            onClick={() => {
              if (confirm("Delete everything X Insights has stored? This cannot be undone.")) void clearData().then(() => setMsg("All data cleared."));
            }}
          >
            Clear data
          </button>
        </div>
        <div class="muted small">CSV covers the tweets of the account shown in the panel, for the selected range.</div>
        {msg && <div class="small spaced">{msg}</div>}
      </div>
      <div class="muted small pad">Everything stays in this browser (IndexedDB). Nothing is sent anywhere.</div>
    </div>
  );
}
