import { describe, expect, it } from "vitest";

import { siteUpdates, siteVersion } from "../site/siteUpdates";

// V0.2.00 -> 200, V1.12.03 -> 11203: comparable as plain numbers.
const versionNumber = (version: string): number => {
  const [major, minor, patch] = version.slice(1).split(".").map(Number);
  return major * 10_000 + minor * 100 + patch;
};

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

  it("numbers every version V<major>.<minor>.<two-digit patch>, going down the list", () => {
    const numbers = siteUpdates.map((update) => {
      expect(update.version).toMatch(/^V\d+\.\d{1,2}\.\d{2}$/);
      return versionNumber(update.version);
    });

    expect([...numbers].sort((a, b) => b - a)).toEqual(numbers);
  });

  it("says nothing about how the site is built or secured", () => {
    // The list is public. This catches the obvious slips only; the rule
    // itself is in the comment at the top of siteUpdates.ts.
    const internal =
      /supabase|postgres|cloud run|cloudflare|webhook|migration|row.level|\brls\b|\bsql\b|api key|secret|token|vulnerab|exploit|injection|\bxss\b|\bcsrf\b/i;

    for (const update of siteUpdates) {
      for (const line of [update.title, ...update.changes]) {
        expect(line).not.toMatch(internal);
      }
    }
  });
});
