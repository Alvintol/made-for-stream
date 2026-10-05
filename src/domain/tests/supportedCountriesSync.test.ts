import { describe, expect, it } from "vitest";

import {
  SUPPORTED_PAYOUT_COUNTRIES,
  getPayoutCountryCurrency,
  getPayoutCountryOptions,
  isSupportedPayoutCountry,
} from "../payments/supportedCountries";
import { isSupportedCurrency } from "../payments/supportedCurrencies";
import * as api from "../../../api/supportedCountries.js";

describe("supported payout countries", () => {
  it("lists the same countries and currencies in the API and the web app", () => {
    expect(api.SUPPORTED_PAYOUT_COUNTRIES).toEqual(SUPPORTED_PAYOUT_COUNTRIES);
  });

  it("pays every country in a currency projects can be priced in", () => {
    for (const [country, currency] of Object.entries(SUPPORTED_PAYOUT_COUNTRIES)) {
      expect(country).toMatch(/^[A-Z]{2}$/);
      expect(isSupportedCurrency(currency), `${country} -> ${currency}`).toBe(true);
    }
  });

  it("leaves out countries where the platform cannot take its fee or pay locally", () => {
    for (const country of ["BR", "MY", "TH", "JP", "CZ", "HU", "RO", "AE", "GI", "IN"]) {
      expect(isSupportedPayoutCountry(country), country).toBe(false);
      expect(api.isSupportedPayoutCountry(country), country).toBe(false);
    }
  });

  it("accepts a listed country in any case, and refuses junk", () => {
    expect(isSupportedPayoutCountry("ca")).toBe(true);
    expect(api.isSupportedPayoutCountry(" ie ")).toBe(true);
    expect(isSupportedPayoutCountry("")).toBe(false);
    expect(isSupportedPayoutCountry(null)).toBe(false);
    expect(api.isSupportedPayoutCountry("toString")).toBe(false);
    expect(api.getUnsupportedPayoutCountryMessage("jp")).toBe(
      "Payouts are not available in JP yet. Choose a country from the list in payout settings.",
    );
  });

  it("knows each country's currency", () => {
    expect(getPayoutCountryCurrency("CA")).toBe("cad");
    expect(getPayoutCountryCurrency("ie")).toBe("eur");
    expect(getPayoutCountryCurrency("JP")).toBeNull();
  });

  it("offers every country once, by name, in alphabetical order", () => {
    const options = getPayoutCountryOptions("en");

    expect(options).toHaveLength(Object.keys(SUPPORTED_PAYOUT_COUNTRIES).length);
    expect(options.find((option) => option.code === "CA")?.name).toBe("Canada");
    expect(options.find((option) => option.code === "GB")?.name).toBe("United Kingdom");
    expect(options.map((option) => option.name)).toEqual(
      [...options.map((option) => option.name)].sort((a, b) => a.localeCompare(b, "en")),
    );
  });
});
