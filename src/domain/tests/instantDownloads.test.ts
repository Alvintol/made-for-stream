import { describe, expect, it } from "vitest";
import {
  instantListingProblems,
  isInstantLicence,
  productFileDisplayName,
} from "../listings/instantDownloads";

describe("instant listings", () => {
  const valid = { isInstant: true, priceType: "fixed", priceMin: 20, licence: "stream" };

  it("accepts a fixed price of at least 10 with a licence", () => {
    expect(instantListingProblems(valid)).toEqual({});
  });

  it("needs a fixed price of at least 10, as the database does", () => {
    expect(instantListingProblems({ ...valid, priceMin: 9 }).priceMin).toBe("instant.errorPrice");
    expect(instantListingProblems({ ...valid, priceType: "starting_at" }).priceMin).toBe("instant.errorPrice");
    expect(instantListingProblems({ ...valid, priceMin: null }).priceMin).toBe("instant.errorPrice");
  });

  it("needs a licence", () => {
    expect(instantListingProblems({ ...valid, licence: "" }).instantLicence).toBe("instant.errorLicence");
    expect(isInstantLicence("exclusive")).toBe(false);
  });

  it("leaves commissions and free listings alone", () => {
    expect(instantListingProblems({ ...valid, isInstant: false, priceMin: 0, licence: "" })).toEqual({});
    expect(instantListingProblems({ ...valid, isFree: true, priceMin: 0, licence: "" })).toEqual({});
  });
});

describe("file names", () => {
  it("drops the stored id people don't need to see", () => {
    expect(productFileDisplayName("overlay_pack_3f9a1c2b7d4e.zip")).toBe("overlay_pack.zip");
    expect(productFileDisplayName("readme_3f9a1c2b7d4e")).toBe("readme");
    expect(productFileDisplayName("plain.png")).toBe("plain.png");
  });
});
