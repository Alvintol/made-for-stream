import { describe, expect, it } from "vitest";
import { toPageOfRows } from "../pageOfRows";

const getCursor = (row: number) => row;

describe("toPageOfRows", () => {
  it("hides the extra row and points at the last row shown", () => {
    expect(toPageOfRows([1, 2, 3], 2, getCursor)).toEqual({ rows: [1, 2], next: 2 });
  });

  it("has no next page when there is no extra row", () => {
    expect(toPageOfRows([1, 2], 2, getCursor)).toEqual({ rows: [1, 2], next: null });
    expect(toPageOfRows([1], 2, getCursor)).toEqual({ rows: [1], next: null });
  });

  it("handles an empty result", () => {
    expect(toPageOfRows([], 2, getCursor)).toEqual({ rows: [], next: null });
  });
});
