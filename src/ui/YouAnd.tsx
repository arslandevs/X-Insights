import { useMemo } from "preact/hooks";
import { allInteractions, allTweets } from "../db";
import { between, buildEvents } from "../metrics/interactions";
import { useLive } from "./hooks";
import type { Core } from "./load";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** "You and @handle": what has passed between us in the data captured so far. */
export function YouAnd({ core }: { core: Core }) {
  const { me, user } = core;
  const { data } = useLive(async () => ({ tweets: await allTweets(), notifs: await allInteractions() }), []);
  const x = useMemo(() => {
    if (!data || !me || !user) return null;
    return between(buildEvents(me.id, data.tweets, data.notifs), user.id, null);
  }, [data, me, user]);
  if (!me || !user || !x) return null;
  const follow = (v: boolean | null, yes: string, no: string) => (v === null ? "unknown" : v ? yes : no);
  const types = Object.entries(x.byType)
    .map(([k, n]) => `${n} ${k}${(n as number) === 1 ? "" : "s"}`)
    .join(", ");
  return (
    <div class="card">
      <div class="muted">You and @{user.handle}</div>
      <div class="row">
        <span>
          They → you: <b>{x.inbound}</b>
        </span>
        <span>
          You → them: <b>{x.outbound}</b>
        </span>
      </div>
      {types && <div class="muted small">{types}</div>}
      {x.inbound + x.outbound === 0 && <div class="muted small">No replies or mentions between you seen yet.</div>}
      <div class="small spaced">
        You {follow(user.youFollow, "follow them", "don't follow them")} · they {follow(user.followsYou, "follow you", "don't follow you")}
      </div>
      <div class="muted small">{plural(x.inbound + x.outbound, "interaction")} seen so far; this grows as you browse notifications and replies.</div>
    </div>
  );
}
