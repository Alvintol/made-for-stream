import { describe, expect, it } from "vitest";
import { needsCollapse } from "../useCollapsed";

describe("needsCollapse", () => {
  const row = { rowWidth: 1000, siblingWidths: [150, 220, 32], gap: 12 };

  it("keeps the content when everything fits", () => {
    // 150 + 220 + 32 + 3 gaps of 12 = 438, leaving 562.
    expect(needsCollapse({ ...row, contentWidth: 562 })).toBe(false);
  });

  it("collapses the content when it is one pixel too wide", () => {
    expect(needsCollapse({ ...row, contentWidth: 563 })).toBe(true);
  });
});
