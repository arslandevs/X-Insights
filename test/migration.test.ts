import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, expect, it } from "vitest";
import { getDB, resetDBCache, userByHandle } from "../src/db";

describe("schema migration", () => {
  it("upgrades a version 1 database: adds the case-insensitive handle index and fills it in", async () => {
    await resetDBCache();
    const v1 = await openDB("x-insights", 1, {
      upgrade(db) {
        db.createObjectStore("users", { keyPath: "id" }).createIndex("handle", "handle");
        db.createObjectStore("tweets", { keyPath: "id" }).createIndex("authorId", "authorId");
        db.createObjectStore("interactions", { keyPath: "id" });
        db.createObjectStore("meta", { keyPath: "key" });
      },
    });
    await v1.put("users", { id: "1", handle: "LevelsIO", name: "L" });
    await v1.put("users", { id: "2", handle: "abc", handleLower: "abc" });
    v1.close();

    const found = await userByHandle("@levelsio");
    expect(found?.id).toBe("1");
    expect(found?.handleLower).toBe("levelsio");
    expect((await getDB()).version).toBe(2);
    await resetDBCache();
  });
});
