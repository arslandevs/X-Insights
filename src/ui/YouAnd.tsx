import { useMemo } from "preact/hooks";
import { allInteractions, allTweets } from "../db";
import { between, buildEvents } from "../metrics/interactions";
import { Icon } from "./Icon";
import { useLive } from "./hooks";
import type { Core } from "./load";

const yn = (v: boolean | null) => (v === null ? "unknown" : v ? "yes" : "no");

/** You and this account: interactions each way and who follows whom, as a single strip. */
export function YouAnd({ core }: { core: Core }) {
  const { me, user } = core;
  const { data } = useLive(async () => ({ tweets: await allTweets(), notifs: await allInteractions() }), []);
  const x = useMemo(() => {
    if (!data || !me || !user) return null;
    return between(buildEvents(me.id, data.tweets, data.notifs), user.id, null);
  }, [data, me, user]);
  if (!me || !user || !x) return null;
  const types = Object.entries(x.byType).map(([k, n]) => `${n} ${k}`).join(", ");
  return (
    <div class="card youand" title={types || "No interactions between you seen yet. Open your Notifications on x.com to capture them."}>
      <span class="ya" title={`They interacted with you ${x.inbound} times`}>
        @{user.handle} <Icon name="right" size={13} /> you <b>{x.inbound}</b>
      </span>
      <span class="ya" title={`You interacted with them ${x.outbound} times`}>
        you <Icon name="right" size={13} /> them <b>{x.outbound}</b>
      </span>
      <span class={`ya f ${user.youFollow ? "on" : ""}`} title={`You follow them: ${yn(user.youFollow)}`}>
        <Icon name="users" size={13} /> you {user.youFollow ? "✓" : "✗"}
      </span>
      <span class={`ya f ${user.followsYou ? "on" : ""}`} title={`They follow you: ${yn(user.followsYou)}`}>
        <Icon name="users" size={13} /> them {user.followsYou ? "✓" : "✗"}
      </span>
    </div>
  );
}
