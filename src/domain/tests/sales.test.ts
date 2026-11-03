import { describe, expect, it } from "vitest";
import {
  currentSalesMonth,
  isUnknownTaxPlace,
  salesMonthToDate,
  taxPlaceName,
  taxTotalsByCurrency,
} from "../payments/sales";

describe("sales months", () => {
  it("uses the UTC month, the same as the tax reports", () => {
    expect(currentSalesMonth(new Date("2026-11-01T02:00:00Z"))).toBe("2026-11");
    expect(currentSalesMonth(new Date("2026-10-31T23:59:59Z"))).toBe("2026-10");
  });

  it("gives the database the first of the month", () => {
    expect(salesMonthToDate("2026-11")).toBe("2026-11-01");
  });
});

describe("tax places", () => {
  it("names each place for the admin page", () => {
    expect(taxPlaceName("CA-ON")).toBe("Ontario");
    expect(taxPlaceName("CA-PE")).toBe("Prince Edward Island");
    expect(taxPlaceName("US")).toBe("United States (zero-rated)");
  });

  it("flags a place nobody could work out, in either form", () => {
    expect(isUnknownTaxPlace("?")).toBe(true);
    expect(isUnknownTaxPlace("CA-?")).toBe(true);
    expect(isUnknownTaxPlace("CA-AB")).toBe(false);
    expect(taxPlaceName("CA-?")).toBe("Unknown, check this");
  });

  it("adds each currency up on its own", () => {
    expect(
      taxTotalsByCurrency([
        { place: "CA-ON", bps: 1300, currency: "cad", fees_cents: 1000, tax_cents: 115 },
        { place: "CA-AB", bps: 500, currency: "cad", fees_cents: 1000, tax_cents: 48 },
        { place: "CA-NS", bps: 1400, currency: "usd", fees_cents: 1000, tax_cents: 123 },
      ]),
    ).toEqual([
      { currency: "cad", tax_cents: 163 },
      { currency: "usd", tax_cents: 123 },
    ]);
  });
});
