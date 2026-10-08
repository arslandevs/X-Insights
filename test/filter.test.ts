import { describe, expect, it } from "vitest";
import { applyFilter } from "../src/metrics/filter";
import { mergeRow } from "../src/db";
import { T } from "./helpers";

describe("filters and merge guard", () => {
  const t = [T({ id: "1", kind: "reply", hasMedia: false }), T({ id: "2", kind: "post", hasMedia: true, hasPhoto: true }), T({ id: "3", kind: "quote", hasMedia: true, hasVideo: true })];
  it("filters by type and media", () => {
    expect(applyFilter(t, "reply").map((x) => x.id)).toEqual(["1"]);
    expect(applyFilter(t, "media").map((x) => x.id)).toEqual(["2", "3"]);
    expect(applyFilter(t, "text").map((x) => x.id)).toEqual(["1"]);
    expect(applyFilter(t, "video").map((x) => x.id)).toEqual(["3"]);
    expect(applyFilter(t, "all")).toHaveLength(3);
  });
  it("never replaces full text with a shorter preview", () => {
    const full = T({ id: "9", text: "a long post ".repeat(40) });
    const cut = T({ id: "9", text: "a long post a long post…" });
    expect(mergeRow(full, cut).text).toBe(full.text);
    expect(mergeRow(cut, full).text).toBe(full.text);
  });
});
