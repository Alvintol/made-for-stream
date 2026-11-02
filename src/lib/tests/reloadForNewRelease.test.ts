import { describe, expect, it } from "vitest";
import { shouldReload } from "../reloadForNewRelease";

describe("shouldReload", () => {
  it("reloads the first time", () => {
    expect(shouldReload(null, 1_000)).toBe(true);
  });

  it("won't reload again straight away, so a broken page can't loop", () => {
    expect(shouldReload(1_000, 30_000)).toBe(false);
  });

  it("reloads for a later release in the same session", () => {
    expect(shouldReload(1_000, 61_000)).toBe(true);
  });
});
