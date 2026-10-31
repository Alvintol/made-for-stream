import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  BETA_COUNTRY_MESSAGE,
  emptyAccountDetailsForm,
  getRegionOptions,
  QUEBEC_MESSAGE,
  SANCTIONED_COUNTRIES,
  SANCTIONED_COUNTRY_MESSAGE,
  toAccountDetailsForm,
  validateAccountDetails,
  type AccountDetailsForm,
} from "../settings/accountDetails";

import { OPEN_COUNTRIES } from "../payments/supportedCountries";

const today = new Date(2026, 9, 8);

const valid: AccountDetailsForm = {
  ...emptyAccountDetailsForm,
  legal_first_name: " Ada ",
  legal_last_name: "Buyer",
  date_of_birth: "1990-01-01",
  address_line1: "1 Main St",
  city: "Calgary",
  region: "AB",
  postal_code: "T2T 2T2",
  country_code: "CA",
};

describe("places Made for Stream does not serve", () => {
  it("refuses a sanctioned country, and Quebec, with the database's own sentences", () => {
    expect(validateAccountDetails({ ...valid, country_code: "RU", region: "", postal_code: "" }, today).errors).toEqual({
      country_code: SANCTIONED_COUNTRY_MESSAGE,
    });
    expect(validateAccountDetails({ ...valid, region: "QC" }, today).errors).toEqual({ region: QUEBEC_MESSAGE });
    expect(validateAccountDetails({ ...valid, region: "ON" }, today).errors).toEqual({});
  });

  it("is open in Canada and the United States only during the beta", () => {
    const abroad = { ...valid, region: "", postal_code: "" };

    expect(validateAccountDetails({ ...abroad, country_code: "IE" }, today).errors).toEqual({
      country_code: BETA_COUNTRY_MESSAGE,
    });
    expect(validateAccountDetails({ ...abroad, country_code: "MX" }, today).errors).toEqual({
      country_code: BETA_COUNTRY_MESSAGE,
    });
    expect(
      validateAccountDetails({ ...valid, country_code: "US", region: "WA", postal_code: "98101" }, today).errors,
    ).toEqual({});
  });
  it("matches the database's list and wording exactly", () => {
    const migration = fs
      .readFileSync(
        path.resolve(__dirname, "../../../supabase/migrations/20261031_177_limit_beta_to_canada_and_us.sql"),
        "utf8",
      )
      .replace(/''/g, "'");

    expect(migration).toContain(`in (${SANCTIONED_COUNTRIES.map((code) => `'${code}'`).join(", ")})`);
    expect(migration).toContain(SANCTIONED_COUNTRY_MESSAGE);
    expect(migration).toContain(QUEBEC_MESSAGE);
    expect(migration).toContain(BETA_COUNTRY_MESSAGE);
    // Doubled quotes were undone above, so the empty string reads as one quote.
    expect(migration).toContain(`not in (', ${OPEN_COUNTRIES.map((code) => `'${code}'`).join(", ")})`);
  });
});

describe("validateAccountDetails", () => {
  it("accepts a complete individual and tidies what was typed", () => {
    const result = validateAccountDetails(valid, today);

    expect(result.errors).toEqual({});
    expect(result.values).toMatchObject({
      account_type: "individual",
      legal_first_name: "Ada",
      address_line2: null,
      business_legal_name: null,
      tax_number: null,
    });
  });

  it("names each missing required field", () => {
    const result = validateAccountDetails(emptyAccountDetailsForm, today);

    expect(result.values).toBeNull();
    expect(Object.keys(result.errors).sort()).toEqual([
      "address_line1",
      "city",
      "country_code",
      "date_of_birth",
      "legal_first_name",
      "legal_last_name",
    ]);
  });

  it("refuses anyone under 18, to the day", () => {
    expect(
      validateAccountDetails({ ...valid, date_of_birth: "2008-10-09" }, today).errors.date_of_birth,
    ).toBe("You must be at least 18 to use Made for Stream.");
    expect(validateAccountDetails({ ...valid, date_of_birth: "2008-10-08" }, today).values).not.toBeNull();
  });

  it("needs a province or state and a postal code in Canada and the United States only", () => {
    const withoutRegion = { ...valid, region: "", postal_code: "" };

    expect(Object.keys(validateAccountDetails(withoutRegion, today).errors)).toEqual([
      "region",
      "postal_code",
    ]);
    expect(validateAccountDetails({ ...withoutRegion, country_code: "IE" }, today).errors).not.toHaveProperty(
      "region",
    );
  });

  it("needs the legal name of a business, and keeps optional numbers", () => {
    const business = { ...valid, account_type: "business", tax_number: "123456789 RT0001" };

    expect(validateAccountDetails(business, today).errors.business_legal_name).toBe(
      "Enter the legal name of the business.",
    );
    expect(
      validateAccountDetails({ ...business, business_legal_name: "Ada Art Inc." }, today).values,
    ).toMatchObject({ account_type: "business", tax_number: "123456789 RT0001" });
  });
});

describe("account details helpers", () => {
  it("offers province and state codes for Canada and the United States, and nothing elsewhere", () => {
    expect(getRegionOptions("CA")?.map((option) => option.code)).toContain("AB");
    expect(getRegionOptions("CA")).toHaveLength(13);
    expect(getRegionOptions("US")).toHaveLength(51);
    expect(getRegionOptions("IE")).toBeNull();
  });

  it("turns saved details into form text, with empty boxes for missing ones", () => {
    const { values } = validateAccountDetails(valid, today);

    expect(toAccountDetailsForm(values)).toMatchObject({ legal_first_name: "Ada", address_line2: "" });
    expect(toAccountDetailsForm(null)).toEqual(emptyAccountDetailsForm);
  });
});
