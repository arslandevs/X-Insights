import type { Coverage } from "../metrics/range";
import type { ActiveTab } from "./hooks";
import { BackfillButton } from "./Backfill";
import { Icon } from "./Icon";
import { dateStr } from "./format";

/** One line: how much is captured, and a button to load older posts when the range reaches past it. */
export function CoverageBar({ cov, handle, tz, active, untilMs }: { cov: Coverage; handle: string | null; tz: string; active: ActiveTab; untilMs: number | null }) {
  if (cov.count === 0) {
    return (
      <div class="cover warn-box">
        <span>{handle ? `No tweets captured for @${handle} yet. Scroll the profile on x.com.` : "Open a profile on x.com to capture it."}</span>
      </div>
    );
  }
  return (
    <div class={`cover ${cov.widerThanCaptured ? "short" : ""}`}>
      <span class="cover-n" title="Tweets captured so far. X only sends what you scroll past.">
        <Icon name={cov.widerThanCaptured ? "alert" : "check"} size={13} /> <b>{cov.count}</b> captured · {dateStr(cov.earliest, tz)} → {dateStr(cov.latest, tz)}
      </span>
      {cov.widerThanCaptured && <BackfillButton active={active} untilMs={untilMs} />}
    </div>
  );
}
