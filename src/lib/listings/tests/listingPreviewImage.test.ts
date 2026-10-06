import { describe, expect, it, vi } from "vitest";

vi.mock("../../supabaseClient", () => ({ supabase: {} }));

import {
  getListingPreviewSize,
  getListingPreviewWatermarkText,
  validateListingPreviewSource,
} from "../listingPreviewImage";

describe("getListingPreviewSize", () => {
  it("shrinks the longest side to 1200 and keeps the shape", () => {
    expect(getListingPreviewSize(4000, 3000)).toEqual({ width: 1200, height: 900 });
    expect(getListingPreviewSize(3000, 4000)).toEqual({ width: 900, height: 1200 });
  });

  it("never enlarges a small image", () => {
    expect(getListingPreviewSize(640, 480)).toEqual({ width: 640, height: 480 });
  });

  it("keeps at least one pixel on a very thin image", () => {
    expect(getListingPreviewSize(12000, 2)).toEqual({ width: 1200, height: 1 });
  });
});

describe("getListingPreviewWatermarkText", () => {
  it("names the site and the creator", () => {
    expect(getListingPreviewWatermarkText("PizzaButt")).toBe("Made for Stream · @PizzaButt");
    expect(getListingPreviewWatermarkText("@PizzaButt")).toBe("Made for Stream · @PizzaButt");
  });

  it("falls back to the site alone when there is no handle", () => {
    expect(getListingPreviewWatermarkText(null)).toBe("Made for Stream");
    expect(getListingPreviewWatermarkText("  ")).toBe("Made for Stream");
  });
});

describe("validateListingPreviewSource", () => {
  it("accepts ordinary images", () => {
    expect(validateListingPreviewSource({ type: "image/png", size: 1_000_000 })).toBeNull();
    expect(validateListingPreviewSource({ type: "image/jpeg", size: 1 })).toBeNull();
    expect(validateListingPreviewSource({ type: "image/webp", size: 1 })).toBeNull();
  });

  it("refuses anything that is not a JPEG, PNG or WebP", () => {
    expect(validateListingPreviewSource({ type: "image/svg+xml", size: 10 })).toMatch(/JPEG, PNG or WebP/);
    expect(validateListingPreviewSource({ type: "application/pdf", size: 10 })).toMatch(/JPEG, PNG or WebP/);
    expect(validateListingPreviewSource({ type: "", size: 10 })).toMatch(/JPEG, PNG or WebP/);
  });

  it("refuses a file over 20 MB", () => {
    expect(validateListingPreviewSource({ type: "image/png", size: 20 * 1024 * 1024 + 1 })).toMatch(/over 20 MB/);
  });
});
