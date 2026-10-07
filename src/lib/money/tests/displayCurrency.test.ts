import { describe, expect, it } from "vitest";
import {
  convertAmount,
  formatApproximateListingPrice,
  formatCurrencyAmount,
  formatListingPrice,
  getBrowserCountry,
  getCurrencyForCountry,
  getDisplayCurrencySummary,
  resolveDisplayCurrency,
  type ExchangeRates,
} from "../displayCurrency";

// Units per euro. Round numbers so the sums are easy to check by hand.
const rates: ExchangeRates = {
  base: "eur",
  date: "2026-10-06",
  rates: { eur: 1, usd: 1.25, cad: 1.6, gbp: 0.8 },
};

describe("formatCurrencyAmount", () => {
  it("always names the currency, because $ alone is ambiguous", () => {
    expect(formatCurrencyAmount(68, "cad")).toBe("$68 CAD");
    expect(formatCurrencyAmount(68, "usd")).toBe("$68 USD");
    expect(formatCurrencyAmount(50, "eur")).toBe("€50 EUR");
    expect(formatCurrencyAmount(40, "GBP")).toBe("£40 GBP");
  });

  it("shows cents only when there are some", () => {
    expect(formatCurrencyAmount(12.5, "usd")).toBe("$12.50 USD");
  });

  it("treats a missing currency as CAD, which is what old data meant", () => {
    expect(formatCurrencyAmount(10, null)).toBe("$10 CAD");
  });
});

describe("formatListingPrice", () => {
  const base = { price_min: 50, price_max: null as number | null, currency: "eur" };

  it("formats each price type in the creator's currency", () => {
    expect(formatListingPrice({ ...base, price_type: "fixed" })).toBe("€50 EUR");
    expect(formatListingPrice({ ...base, price_type: "starting_at" })).toBe("From €50 EUR");
    expect(formatListingPrice({ ...base, price_type: "range", price_max: 80 })).toBe("€50–€80 EUR");
  });
});

describe("convertAmount", () => {
  it("converts through the euro", () => {
    // 50 EUR is 80 CAD; 100 USD is 80 EUR is 128 CAD.
    expect(convertAmount(50, "eur", "cad", rates)).toBeCloseTo(80);
    expect(convertAmount(100, "usd", "cad", rates)).toBeCloseTo(128);
  });

  it("does not convert a currency to itself, or without rates, or an unknown one", () => {
    expect(convertAmount(50, "cad", "CAD", rates)).toBeNull();
    expect(convertAmount(50, "eur", "cad", null)).toBeNull();
    expect(convertAmount(50, "eur", "jpy", rates)).toBeNull();
  });
});

describe("formatApproximateListingPrice", () => {
  const listing = { price_type: "fixed", price_min: 50, price_max: 50, currency: "eur" };

  it("marks the converted price as approximate and rounds it to whole units", () => {
    expect(formatApproximateListingPrice(listing, "cad", rates)).toBe("≈ $80 CAD");
    expect(
      formatApproximateListingPrice({ ...listing, price_min: 33 }, "usd", rates),
    ).toBe("≈ $41 USD");
  });

  it("converts both ends of a range", () => {
    expect(
      formatApproximateListingPrice(
        { price_type: "range", price_min: 50, price_max: 100, currency: "eur" },
        "cad",
        rates,
      ),
    ).toBe("≈ $80–$160 CAD");
  });

  it("offers nothing when the visitor's currency is the creator's, or unknown, or rates are missing", () => {
    expect(formatApproximateListingPrice(listing, "eur", rates)).toBeNull();
    expect(formatApproximateListingPrice(listing, null, rates)).toBeNull();
    expect(formatApproximateListingPrice(listing, "cad", null)).toBeNull();
  });
});

describe("getBrowserCountry", () => {
  it("reads the country from the browser's language", () => {
    expect(getBrowserCountry(["en-CA", "en"])).toBe("CA");
    expect(getBrowserCountry(["fr", "fr-FR"])).toBe("FR");
    expect(getBrowserCountry(["zh-Hant-HK"])).toBe("HK");
  });

  it("gives nothing when no language names a country", () => {
    expect(getBrowserCountry(["en", "fr"])).toBeNull();
    expect(getBrowserCountry([])).toBeNull();
  });
});

describe("resolveDisplayCurrency", () => {
  it("uses the chosen currency first", () => {
    expect(
      resolveDisplayCurrency({
        preference: { country_code: "CA", display_currency: "gbp" },
        browserLanguages: ["en-US"],
      }),
    ).toBe("gbp");
  });

  it("falls back to the saved country's currency", () => {
    expect(
      resolveDisplayCurrency({
        preference: { country_code: "IE", display_currency: null },
        browserLanguages: ["en-US"],
      }),
    ).toBe("eur");
  });

  it("guesses from the browser for visitors with nothing saved", () => {
    expect(resolveDisplayCurrency({ preference: null, browserLanguages: ["en-CA"] })).toBe("cad");
  });

  it("does not convert when nothing points to a supported currency", () => {
    expect(resolveDisplayCurrency({ preference: null, browserLanguages: ["ja-JP"] })).toBeNull();
    expect(
      resolveDisplayCurrency({
        preference: { country_code: null, display_currency: "xyz" },
        browserLanguages: [],
      }),
    ).toBeNull();
  });
});

describe("getCurrencyForCountry / getDisplayCurrencySummary", () => {
  it("maps a country to its currency when the site supports it", () => {
    expect(getCurrencyForCountry("us")).toBe("usd");
    expect(getCurrencyForCountry("JP")).toBeNull();
    expect(getCurrencyForCountry(null)).toBeNull();
  });

  it("summarises the saved choice for the settings header", () => {
    expect(getDisplayCurrencySummary({ country_code: "CA", display_currency: null })).toBe(
      "Prices shown in CAD",
    );
    expect(getDisplayCurrencySummary({ country_code: "CA", display_currency: "eur" })).toBe(
      "Prices shown in EUR",
    );
    expect(getDisplayCurrencySummary(null)).toBe("Not set");
  });
});
