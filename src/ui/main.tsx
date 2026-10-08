import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { counts, getMeta } from "../db";
import type { CaptureStat } from "../types";

function ago(t: number) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function App() {
  const [c, setC] = useState({ users: 0, tweets: 0, interactions: 0 });
  const [stats, setStats] = useState<Record<string, CaptureStat>>({});

  const load = async () => {
    setC(await counts());
    setStats((await getMeta<Record<string, CaptureStat>>("captureStats")) ?? {});
  };

  useEffect(() => {
    void load();
    const ch = new BroadcastChannel("xi");
    ch.onmessage = () => void load();
    const t = setInterval(() => void load(), 5000);
    return () => {
      ch.close();
      clearInterval(t);
    };
  }, []);

  const ops = Object.entries(stats).sort((a, b) => b[1].lastAt - a[1].lastAt);

  return (
    <div>
      <h1>X Insights</h1>
      <div class="grid">
        <div class="card">
          <div class="big">{c.tweets}</div>
          <div class="muted">tweets captured</div>
        </div>
        <div class="card">
          <div class="big">{c.users}</div>
          <div class="muted">accounts seen</div>
        </div>
      </div>
      <div class="card">
        <div class="muted" style="margin-bottom:6px">Capture health</div>
        {ops.length === 0 && <div class="warn">Nothing captured yet. Open a profile on x.com and scroll.</div>}
        {ops.map(([op, s]) => (
          <div class="row" key={op}>
            <span>{op}</span>
            <span class="muted">
              {s.count}× · {s.tweets} tweets · {ago(s.lastAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

render(<App />, document.getElementById("app")!);
