import { describe, expect, it } from "vitest";
import {
  chartPresetRange,
  customRangeProblem,
  regionName,
  chartTicks,
  currentSalesMonth,
  formatChartPeriod,
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

describe("the graph's axis", () => {
  it("uses round steps from zero up past the highest value", () => {
    expect(chartTicks([0, 19000, 5000])).toEqual([0, 5000, 10000, 15000, 20000]);
  });

  it("goes below zero when refunds beat sales", () => {
    const ticks = chartTicks([-3000, 8000]);

    expect(ticks[0]).toBeLessThanOrEqual(-3000);
    expect(ticks).toContain(0);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(8000);
  });

  it("still draws an axis when every value is zero", () => {
    expect(chartTicks([0, 0]).length).toBeGreaterThan(1);
  });
});

describe("the graph's dates", () => {
  it("reads the period in UTC, so a day never slips", () => {
    expect(formatChartPeriod("2026-11-01", "day", "en-CA")).toBe("Nov 1");
    expect(formatChartPeriod("2026-11-01", "month", "en-CA")).toBe("Nov 2026");
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

describe("graph periods", () => {
  const today = new Date("2026-11-03T15:00:00Z");

  it("counts back from today for the day presets", () => {
    expect(chartPresetRange("7", today)).toEqual({ from: "2026-10-28", to: "2026-11-03" });
    expect(chartPresetRange("28", today)).toEqual({ from: "2026-10-07", to: "2026-11-03" });
  });

  it("covers 12 whole months, or a whole year", () => {
    expect(chartPresetRange("12m", today)).toEqual({ from: "2025-12-01", to: "2026-11-03" });
    expect(chartPresetRange("year", today, 2025)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
  });

  it("refuses typed dates that are backwards, missing or longer than two years", () => {
    expect(customRangeProblem("2026-10-01", "2026-10-20")).toBeNull();
    expect(customRangeProblem("2026-10-20", "2026-10-01")).toBe("sales.rangeInvalid");
    expect(customRangeProblem("", "2026-10-01")).toBe("sales.rangeInvalid");
    expect(customRangeProblem("2023-01-01", "2026-01-01")).toBe("sales.rangeTooLong");
  });

  it("keeps a count axis in whole numbers", () => {
    expect(chartTicks([0, 2, 3], 4)).toEqual([0, 1, 2, 3]);
  });
});

describe("regions", () => {
  it("names a province, a state with its country, and an unknown place", () => {
    expect(regionName("CA", "ON")).toBe("Ontario");
    expect(regionName("US", "WA")).toBe("WA, United States");
    expect(regionName("?", "")).toBe("Unknown, check this");
  });
});
