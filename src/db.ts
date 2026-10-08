import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CaptureStat, InteractionRow, TweetRow, UserRow } from "./types";

export const SCHEMA_VERSION = 2;

interface XiDB extends DBSchema {
  users: { key: string; value: UserRow; indexes: { handle: string; handleLower: string } };
  tweets: { key: string; value: TweetRow; indexes: { authorId: string; createdAt: number } };
  interactions: { key: string; value: InteractionRow; indexes: { actorId: string; at: number } };
  meta: { key: string; value: { key: string; value: unknown } };
}

let dbp: Promise<IDBPDatabase<XiDB>> | null = null;

export function getDB(name = "x-insights") {
  dbp ??= openDB<XiDB>(name, SCHEMA_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      // One step per version, so any older database walks forward to the current schema.
      if (oldVersion < 1) {
        const users = db.createObjectStore("users", { keyPath: "id" });
        users.createIndex("handle", "handle");
        const tweets = db.createObjectStore("tweets", { keyPath: "id" });
        tweets.createIndex("authorId", "authorId");
        tweets.createIndex("createdAt", "createdAt");
        const inter = db.createObjectStore("interactions", { keyPath: "id" });
        inter.createIndex("actorId", "actorId");
        inter.createIndex("at", "at");
        db.createObjectStore("meta", { keyPath: "key" });
      }
      if (oldVersion < 2) {
        const users = tx.objectStore("users");
        users.createIndex("handleLower", "handleLower");
        let cur = await users.openCursor();
        while (cur) {
          if (!cur.value.handleLower) await cur.update({ ...cur.value, handleLower: String(cur.value.handle ?? "").toLowerCase() });
          cur = await cur.continue();
        }
      }
    },
  });
  return dbp;
}

/** For tests: close and forget the cached connection. */
export async function resetDBCache() {
  const p = dbp;
  dbp = null;
  if (p) (await p).close();
}

/** Newer captures win, but a missing (null/undefined) value never erases a known one. */
export function mergeRow<T extends object>(existing: T | undefined, incoming: T): T {
  if (!existing) return incoming;
  const out = { ...existing } as Record<string, unknown>;
  for (const [k, v] of Object.entries(incoming)) if (v !== null && v !== undefined) out[k] = v;
  return out as T;
}

export async function upsertUsers(rows: UserRow[]) {
  if (!rows.length) return;
  const db = await getDB();
  const tx = db.transaction("users", "readwrite");
  for (const row of rows) tx.store.put(mergeRow(await tx.store.get(row.id), row));
  await tx.done;
}

export async function upsertTweets(rows: TweetRow[]) {
  if (!rows.length) return;
  const db = await getDB();
  const tx = db.transaction("tweets", "readwrite");
  for (const row of rows) tx.store.put(mergeRow(await tx.store.get(row.id), row));
  await tx.done;
}

export async function upsertInteractions(rows: InteractionRow[]) {
  if (!rows.length) return;
  const db = await getDB();
  const tx = db.transaction("interactions", "readwrite");
  for (const row of rows) tx.store.put(row);
  await tx.done;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return ((await (await getDB()).get("meta", key))?.value as T | undefined);
}

export async function setMeta(key: string, value: unknown) {
  await (await getDB()).put("meta", { key, value });
}

export async function bumpCaptureStat(op: string, tweets: number, users: number, now = Date.now()) {
  const stats = (await getMeta<Record<string, CaptureStat>>("captureStats")) ?? {};
  const cur = stats[op] ?? { count: 0, empty: 0, tweets: 0, users: 0, lastAt: 0 };
  stats[op] = { count: cur.count + 1, empty: (cur.empty ?? 0) + (tweets === 0 && users === 0 ? 1 : 0), tweets: cur.tweets + tweets, users: cur.users + users, lastAt: now };
  await setMeta("captureStats", stats);
}

export async function counts() {
  const db = await getDB();
  const [users, tweets, interactions] = await Promise.all([db.count("users"), db.count("tweets"), db.count("interactions")]);
  return { users, tweets, interactions };
}

export async function clearAll() {
  const db = await getDB();
  await Promise.all(["users", "tweets", "interactions", "meta"].map((s) => db.clear(s as "users")));
}

// ---- reads used by the UI --------------------------------------------------------------------

export async function userByHandle(handle: string) {
  return (await getDB()).getFromIndex("users", "handleLower", handle.replace(/^@/, "").toLowerCase());
}
export async function userById(id: string) {
  return (await getDB()).get("users", id);
}
export async function tweetsByAuthor(id: string) {
  return (await getDB()).getAllFromIndex("tweets", "authorId", id);
}
export async function allTweets() {
  return (await getDB()).getAll("tweets");
}
export async function allUsers() {
  return (await getDB()).getAll("users");
}
export async function allInteractions() {
  return (await getDB()).getAll("interactions");
}

// ---- backup ----------------------------------------------------------------------------------

export interface Backup {
  app: "x-insights";
  schemaVersion: number;
  exportedAt: number;
  users: UserRow[];
  tweets: TweetRow[];
  interactions: InteractionRow[];
  meta: { key: string; value: unknown }[];
}

export async function exportAll(): Promise<Backup> {
  const db = await getDB();
  return {
    app: "x-insights",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    users: await db.getAll("users"),
    tweets: await db.getAll("tweets"),
    interactions: await db.getAll("interactions"),
    meta: await db.getAll("meta"),
  };
}

/** Merges a backup into the current data (newer values win, nothing known is erased). */
export async function importAll(b: Backup): Promise<{ users: number; tweets: number; interactions: number }> {
  if (!b || b.app !== "x-insights") throw new Error("This is not an X Insights backup file.");
  const users = (b.users ?? []).filter((u) => u?.id && u.handle).map((u) => ({ ...u, handleLower: u.handle.toLowerCase() }));
  await upsertUsers(users);
  await upsertTweets((b.tweets ?? []).filter((t) => t?.id));
  await upsertInteractions((b.interactions ?? []).filter((i) => i?.id));
  const db = await getDB();
  for (const m of b.meta ?? []) if (m?.key === "settings" && (await db.get("meta", "settings")) === undefined) await db.put("meta", m);
  return { users: users.length, tweets: (b.tweets ?? []).length, interactions: (b.interactions ?? []).length };
}
