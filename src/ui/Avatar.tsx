import type { UserRow } from "../types";

const COLORS = ["#1d9bf0", "#00ba7c", "#f91880", "#7856ff", "#ff7a00", "#ffd400", "#00b8d4", "#8b98a5"];

/** The profile picture, or the first letters on a color when X gave none (or it has not loaded). */
export function Avatar({ user, size, big }: { user: Pick<UserRow, "id" | "handle" | "name" | "avatar"> | undefined; size?: "sm"; big?: boolean }) {
  const cls = `avatar ${size ?? ""}`;
  if (user?.avatar) return <img class={cls} src={big ? user.avatar.replace("_normal.", "_bigger.") : user.avatar} alt="" />;
  const label = (user?.name || user?.handle || "?").replace(/^@/, "");
  const initials = label.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  const color = COLORS[(user ? [...user.id].reduce((a, c) => a + c.charCodeAt(0), 0) : 0) % COLORS.length];
  return (
    <div class={`${cls} initials`} style={{ background: color }} aria-hidden="true">
      {initials}
    </div>
  );
}
