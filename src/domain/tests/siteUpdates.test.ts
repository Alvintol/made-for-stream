import { describe, expect, it } from "vitest";

import { siteUpdates, siteVersion } from "../site/siteUpdates";

describe("site updates", () => {
  it("names the newest entry as the current version", () => {
    // Fails when an entry is added without moving siteVersion, or the reverse.
    expect(siteUpdates[0]?.version).toBe(siteVersion);
  });

  it("lists every version once, newest first, each with something to say", () => {
    const versions = siteUpdates.map((update) => update.version);
    const dates = siteUpdates.map((update) => update.date);

    expect(new Set(versions).size).toBe(versions.length);
    expect([...dates].sort().reverse()).toEqual(dates);

    for (const update of siteUpdates) {
      expect(update.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(update.title.length).toBeGreaterThan(0);
      expect(update.changes.length).toBeGreaterThan(0);
    }
  });
});
