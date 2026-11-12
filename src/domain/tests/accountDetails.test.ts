import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  BETA_COUNTRY_MESSAGE,
  emptyAccountDetailsForm,
  getRegionOptions,
  getFreeOnlyReason,
  isFreeOnlyLocation,
  QUEBEC_MESSAGE,
  SANCTIONED_COUNTRIES,
  SANCTIONED_COUNTRY_MESSAGE,
  toAccountDetailsForm,
  validateAccountDetails,
  type AccountDetailsForm,
} from "../settings/accountDetails";

import { OPEN_COUNTRIES } from "../payments/supportedCountries";
import { english } from "../../lib/i18n/i18n";

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
  it("refuses a sanctioned country with the database's own sentence, and lets Quebec in for free listings", () => {
    expect(validateAccountDetails({ ...valid, country_code: "RU", region: "", postal_code: "" }, today).errors).toEqual({
      country_code: SANCTIONED_COUNTRY_MESSAGE,
    });
    // Quebec can be saved (20261112_195); only free listings are open there.
    expect(validateAccountDetails({ ...valid, region: "QC" }, today).errors).toEqual({});
    expect(validateAccountDetails({ ...valid, region: "ON" }, today).errors).toEqual({});
    expect(isFreeOnlyLocation("CA", "QC")).toBe(true);
    expect(isFreeOnlyLocation("ca", " qc ")).toBe(true);
    expect(isFreeOnlyLocation("CA", "ON")).toBe(false);
    expect(isFreeOnlyLocation("US", "QC")).toBe(false);
    expect(isFreeOnlyLocation(null, null)).toBe(false);
  });

  it("saves an address anywhere outside the sanctions, with only free listings open outside Canada and the US", () => {
    const abroad = { ...valid, region: "", postal_code: "" };

    // 20261112_196: the rest of the world is open for free listings during the beta.
    expect(validateAccountDetails({ ...abroad, country_code: "IE" }, today).errors).toEqual({});
    expect(validateAccountDetails({ ...abroad, country_code: "MX" }, today).errors).toEqual({});
    expect(
      validateAccountDetails({ ...valid, country_code: "US", region: "WA", postal_code: "98101" }, today).errors,
    ).toEqual({});

    expect(getFreeOnlyReason("IE", "")).toBe("beta");
    expect(getFreeOnlyReason("jp", null)).toBe("beta");
    expect(getFreeOnlyReason("CA", "QC")).toBe("quebec");
    expect(getFreeOnlyReason("CA", "AB")).toBeNull();
    expect(getFreeOnlyReason("US", "WA")).toBeNull();
    // Sanctioned countries aren't free-only: they're refused outright.
    expect(getFreeOnlyReason("RU", "")).toBeNull();
    expect(getFreeOnlyReason("", "")).toBeNull();
  });
  it("matches the database's list and wording exactly", () => {
    const readMigration = (file: string) =>
      fs.readFileSync(path.resolve(__dirname, `../../../supabase/migrations/${file}`), "utf8").replace(/''/g, "'");
    // sanctioned_country_message() is defined here and hasn't changed since.
    const sanctions = readMigration("20261031_177_limit_beta_to_canada_and_us.sql");
    // blocked_location_message() and free_only_listing_message() as they stand.
    const locations = readMigration("20261112_196_open_free_listings_worldwide.sql");

    expect(sanctions).toContain(`in (${SANCTIONED_COUNTRIES.map((code) => `'${code}'`).join(", ")})`);
    expect(sanctions).toContain(SANCTIONED_COUNTRY_MESSAGE);
    expect(locations).toContain(QUEBEC_MESSAGE);
    expect(locations).toContain(BETA_COUNTRY_MESSAGE);
    expect(locations).toContain(english("listingForm.quebecFreeOnly"));
    expect(locations).toContain(english("listingForm.betaFreeOnly"));
    // Doubled quotes were undone above, so the empty string reads as one quote.
    expect(locations).toContain(`not in (', ${OPEN_COUNTRIES.map((code) => `'${code}'`).join(", ")})`);
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

  it("only shows a tax number on invoices when one is given", () => {
    expect(
      validateAccountDetails({ ...valid, show_tax_number_on_invoices: "true" }, today).errors.tax_number,
    ).toBe("Enter your tax number to show it on invoices.");

    expect(
      validateAccountDetails(
        { ...valid, tax_number: "123456789 RT0001", show_tax_number_on_invoices: "true" },
        today,
      ).values?.show_tax_number_on_invoices,
    ).toBe(true);

    expect(validateAccountDetails(valid, today).values?.show_tax_number_on_invoices).toBe(false);
  });

  it.each(["123456789", "123 456 789", "123-45-6789"])(
    "refuses to show %s, because buyers would see a private number",
    (tax_number) => {
      expect(
        validateAccountDetails({ ...valid, tax_number, show_tax_number_on_invoices: "true" }, today).errors
          .tax_number,
      ).toMatch(/social insurance/);

      // Only showing it is refused. Kept private, it stays allowed.
      expect(validateAccountDetails({ ...valid, tax_number }, today).errors.tax_number).toBeUndefined();
    },
  );
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
