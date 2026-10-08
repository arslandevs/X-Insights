import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CaptureStat, InteractionRow, TweetRow, UserRow } from "./types";

export const SCHEMA_VERSION = 1;

interface XiDB extends DBSchema {
  users: { key: string; value: UserRow; indexes: { handle: string } };
  tweets: { key: string; value: TweetRow; indexes: { authorId: string; createdAt: number } };
  interactions: { key: string; value: InteractionRow; indexes: { actorId: string; at: number } };
  meta: { key: string; value: { key: string; value: unknown } };
}

let dbp: Promise<IDBPDatabase<XiDB>> | null = null;

export function getDB(name = "x-insights") {
  dbp ??= openDB<XiDB>(name, SCHEMA_VERSION, {
    upgrade(db) {
      const users = db.createObjectStore("users", { keyPath: "id" });
      users.createIndex("handle", "handle");
      const tweets = db.createObjectStore("tweets", { keyPath: "id" });
      tweets.createIndex("authorId", "authorId");
      tweets.createIndex("createdAt", "createdAt");
      const inter = db.createObjectStore("interactions", { keyPath: "id" });
      inter.createIndex("actorId", "actorId");
      inter.createIndex("at", "at");
      db.createObjectStore("meta", { keyPath: "key" });
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
  const cur = stats[op] ?? { count: 0, tweets: 0, users: 0, lastAt: 0 };
  stats[op] = { count: cur.count + 1, tweets: cur.tweets + tweets, users: cur.users + users, lastAt: now };
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
