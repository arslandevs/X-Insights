import { useMemo, useState } from "preact/hooks";
import { buildEvents, people, sortPeople, type PeopleSort } from "../metrics/interactions";
import type { RangeKey } from "../metrics/range";
import { Avatar } from "./Avatar";
import { HoverCard, type HoverState } from "./HoverCard";
import type { Core, Social } from "./load";

const DAY = 864e5;

export function PeopleGrid({ core, social, range, now }: { core: Core; social: Social | undefined; range: RangeKey; now: number }) {
  const [sort, setSort] = useState<PeopleSort>("interactions");
  const [hover, setHover] = useState<HoverState | null>(null);
  const me = core.me;

  const list = useMemo(() => {
    if (!me || !social) return [];
    const events = buildEvents(me.id, social.tweets, social.interactions);
    const from = range === "all" ? null : now - Number(range) * DAY;
    return sortPeople(people(events, from), social.users, sort);
  }, [me, social, range, sort, now]);

  if (!me) {
    return (
      <div class="card">
        <div class="big">Who is you?</div>
        <div class="muted">
          Open x.com once so the extension can see which account is logged in, or set your handle in Settings. Then visit your Notifications and a few of your replies: this view is built from the interactions you have seen.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div class="row-gap">
        <span class="muted small">{list.length} people in this range</span>
        <select class="mini" value={sort} onChange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as PeopleSort)} aria-label="Sort people">
          <option value="interactions">Interactions</option>
          <option value="followers">Followers</option>
          <option value="recent">Recent</option>
        </select>
      </div>
      <div class="banner">Interactions seen so far. It grows as you browse notifications and replies; X has no list of everyone who engaged.</div>
      {list.length === 0 ? (
        <div class="muted pad">Nothing yet in this range. Open your Notifications tab on x.com to capture likes, replies and follows.</div>
      ) : (
        <div class="people" onMouseLeave={() => setHover(null)}>
          {list.slice(0, 120).map((p) => {
            const u = social?.users.get(p.id);
            return (
              <a
                key={p.id}
                class="person"
                href={u ? `https://x.com/${u.handle}` : undefined}
                target="_blank"
                rel="noreferrer"
                onMouseEnter={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setHover({ person: p, user: u, x: r.left + r.width / 2, y: r.bottom + 6 });
                }}
                aria-label={u ? `@${u.handle}` : p.id}
              >
                <Avatar user={u ?? { id: p.id, handle: "?", name: null, avatar: null }} />
                {p.inbound > 0 && <span class="b b-in" title="They interacted with you">{p.inbound}</span>}
                {p.outbound > 0 && <span class="b b-out" title="You interacted with them">{p.outbound}</span>}
                {(u?.youFollow || u?.followsYou) && (
                  <span class="fl" title={`${u?.youFollow ? "You follow them" : ""}${u?.youFollow && u?.followsYou ? " · " : ""}${u?.followsYou ? "They follow you" : ""}`}>
                    {u?.youFollow && u?.followsYou ? "⇄" : u?.youFollow ? "→" : "←"}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      )}
      {hover && <HoverCard h={hover} tz={core.tz} />}
    </div>
  );
}
