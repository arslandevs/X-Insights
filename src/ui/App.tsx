import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { inWindow, windowFor, coverage, type RangeKey } from "../metrics/range";
import { saveSettings } from "../settings";
import { clearData, exportCsv, exportJson, importJsonFile } from "./actions";
import { Feed } from "./Feed";
import { Overview } from "./Overview";
import { PeopleGrid } from "./PeopleGrid";
import { CoverageBanner, ProfileHeader } from "./ProfileHeader";
import { RangePicker } from "./RangePicker";
import { SettingsTab } from "./SettingsTab";
import { TweetTable } from "./TweetTable";
import { useActiveTab, useLive, useStored } from "./hooks";
import { loadCore, loadSocial } from "./load";

type Tab = "overview" | "tweets" | "people" | "feed" | "settings";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "tweets", label: "Tweets" },
  { key: "people", label: "People" },
  { key: "feed", label: "Feed" },
  { key: "settings", label: "Settings" },
];

export function App() {
  const [tab, setTab] = useStored<Tab>("tab", "overview");
  const [range, setRange] = useStored<RangeKey>("range", "30");
  const active = useActiveTab();
  const { data: core } = useLive(() => loadCore(active.handle), [active.handle]);
  const { data: social } = useLive(() => (tab === "people" ? loadSocial() : Promise.resolve(undefined)), [tab]);
  const [now, setNow] = useState(Date.now());
  const [menu, setMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const rangeTweets = useMemo(() => {
    if (!core) return [];
    const w = windowFor(range, core.tweets, core.tz, now);
    return core.tweets.filter((t) => inWindow(t, w, core.tz));
  }, [core, range, now]);

  if (!core) return <div class="muted pad">Loading…</div>;

  const context = active.handle
    ? `@${active.handle}`
    : core.meHandle
      ? `Your account (@${core.meHandle})`
      : "No account yet";
  const hint = !active.isX ? "Open x.com to capture data. Showing your account." : !active.handle ? "Not a profile page. Showing your account." : "";

  const toggleTz = () => {
    void saveSettings({ ...core.settings, timezone: core.settings.timezone === "UTC" ? "local" : "UTC" }).then(() => new BroadcastChannel("xi").postMessage({ type: "updated" }));
    setMenu(false);
  };

  return (
    <div class="app" onClick={() => menu && setMenu(false)}>
      <header>
        <h1>X Insights</h1>
        <RangePicker value={range} onChange={setRange} />
        <div class="menu-wrap">
          <button class="icon" aria-label="Menu" onClick={(e) => { e.stopPropagation(); setMenu(!menu); }}>
            ⋯
          </button>
          {menu && (
            <div class="menu" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { void exportJson(); setMenu(false); }}>Export JSON</button>
              <button onClick={() => { void exportCsv(rangeTweets, core.handle ?? "tweets"); setMenu(false); }} disabled={!rangeTweets.length}>Export tweets CSV</button>
              <button onClick={() => fileRef.current?.click()}>Import JSON…</button>
              <button onClick={toggleTz}>Timezone: {core.settings.timezone === "UTC" ? "switch to local" : "switch to UTC"}</button>
              <button onClick={() => { setTab("settings"); setMenu(false); }}>Settings</button>
              <button class="danger" onClick={() => { setMenu(false); if (confirm("Delete everything X Insights has stored? This cannot be undone.")) void clearData(); }}>Clear data</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => {
            const f = (e.currentTarget as HTMLInputElement).files?.[0];
            setMenu(false);
            if (f) importJsonFile(f).then(setFlash).catch((err) => setFlash(String(err.message ?? err)));
          }} />
        </div>
      </header>
      <div class="ctx">
        <b>{context}</b> {hint && <span class="muted">· {hint}</span>}
      </div>
      {flash && <div class="banner" onClick={() => setFlash("")}>{flash}</div>}
      <nav class="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} class={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>
      <main>
        {tab === "overview" && <Overview core={core} range={range} now={now} />}
        {tab === "tweets" && (
          <>
            <ProfileHeader core={core} now={now} />
            <CoverageBanner cov={coverage(core.tweets, range, core.tz, now)} range={range} handle={core.handle} tz={core.tz} />
            <TweetTable tweets={rangeTweets} handle={core.handle ?? ""} tz={core.tz} now={now} />
          </>
        )}
        {tab === "people" && <PeopleGrid core={core} social={social} range={range} now={now} />}
        {tab === "feed" && <Feed core={core} now={now} />}
        {tab === "settings" && <SettingsTab core={core} active={active} tweetsForCsv={rangeTweets} now={now} />}
      </main>
    </div>
  );
}
