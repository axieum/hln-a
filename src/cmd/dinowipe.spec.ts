import { describe, expect, it } from "bun:test";
import { getTimestamp } from "./dinowipe.ts";

describe("dinowipe", () => {
  it("getTimestamp", async () => {
    expect(getTimestamp(new Date(2025, 1, 15, 21, 51, 0, 0), "R")).toBe("<t:1739656260:R>");
  });
});
