import { Avatar } from "./Avatar";
import type { Person } from "../metrics/interactions";
import type { UserRow } from "../types";
import { ageStr, compact, dateStr } from "./format";

export interface HoverState {
  person: Person;
  user: UserRow | undefined;
  x: number;
  y: number;
}

const flag = (v: boolean | null | undefined, yes: string, no: string) => (v === null || v === undefined ? "follow status unknown" : v ? yes : no);

export function HoverCard({ h, tz }: { h: HoverState; tz: string }) {
  const u = h.user;
  const width = 250;
  const left = Math.max(6, Math.min(h.x - width / 2, window.innerWidth - width - 6));
  return (
    <div class="hover" style={{ left: `${left}px`, top: `${h.y}px`, width: `${width}px` }} role="tooltip">
      <div class="p-top">
        <Avatar size="sm" user={u ?? { id: h.person.id, handle: "?", name: null, avatar: null }} />
        <div>
          <div class="p-name">{u?.name ?? "Unknown account"}</div>
          <div class="muted small">{u ? `@${u.handle}` : h.person.id}</div>
        </div>
      </div>
      {u && (
        <div class="muted small">
          {compact(u.followers)} followers · {compact(u.following)} following
          <br />
          Joined {dateStr(u.createdAt, tz)} ({ageStr(u.createdAt)})
        </div>
      )}
      <div class="small spaced">
        <b>{h.person.inbound}</b> interactions with you · you interacted <b>{h.person.outbound}</b> times
      </div>
      <div class="small">
        You {flag(u?.youFollow, "follow them", "don't follow them")} · {flag(u?.followsYou, "they follow you", "they don't follow you")}
      </div>
    </div>
  );
}
