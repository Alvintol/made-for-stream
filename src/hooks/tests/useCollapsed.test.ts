import { describe, expect, it } from "vitest";
import { countFitting, needsCollapse } from "../useCollapsed";

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

describe("countFitting", () => {
  const items = { itemWidths: [50, 50, 50, 50], moreWidth: 100, gap: 10 };

  it("shows every item when they all fit, with no room kept for the button", () => {
    // 4 x 50 + 3 gaps of 10 = 230.
    expect(countFitting({ ...items, available: 230 })).toBe(4);
  });

  it("keeps room for the button once anything overflows", () => {
    // 100 for the button, then 60 per item: two fit in 229, not three.
    expect(countFitting({ ...items, available: 229 })).toBe(2);
  });

  it("shows only the button when no item fits beside it", () => {
    expect(countFitting({ ...items, available: 120 })).toBe(0);
  });
});
