import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  daysUntil,
  formatTaxReportPeriod,
  missingTaxDetails,
  TAX_REPORTS,
  taxReportCsv,
  type TaxReportSellerRow,
} from "../payments/taxReporting";

const repoFile = (relative: string) =>
  fs.readFileSync(path.resolve(__dirname, "../../..", relative), "utf8");

const row = (overrides: Partial<TaxReportSellerRow> = {}): TaxReportSellerRow => ({
  creator_user_id: "creator-1",
  country_code: "CA",
  currency: "cad",
  quarter: 4,
  payments: 3,
  paid_cents: 9300,
  refunded_cents: 1000,
  creator_fee_cents: 450,
  account_type: "individual",
  legal_first_name: "Sam",
  legal_last_name: "Lee",
  business_legal_name: null,
  date_of_birth: "1990-01-02",
  address_line1: "1 Main St",
  address_line2: null,
  city: "Calgary",
  region: "AB",
  postal_code: "T2P 1A1",
  tax_number: "123456789RT0001",
  business_registration_number: null,
  stripe_account_id: "acct_1",
  ...overrides,
});

describe("tax reporting", () => {
  it("covers every report on the database's calendar, named as the ops email names them", () => {
    const migration = repoFile("supabase/migrations/20261028_170_add_tax_reporting.sql");
    const calendar = migration.slice(
      migration.indexOf("create or replace function public.tax_reporting_obligations"),
      migration.indexOf("create table if not exists public.tax_report_filings"),
    );
    const inDatabase = new Set([...calendar.matchAll(/'([a-z0-9]+_[a-z0-9_]+)'/g)].map((match) => match[1]));

    expect([...inDatabase].sort()).toEqual(Object.keys(TAX_REPORTS).sort());

    const opsAlerts = repoFile("api/opsAlerts.js");
    for (const [regime, report] of Object.entries(TAX_REPORTS)) {
      expect(opsAlerts).toContain(`${regime}: "${report.name}",`);
    }
  });

  it("shows a calendar year as the year and a half year in full", () => {
    expect(formatTaxReportPeriod("2026-01-01", "2026-12-31")).toBe("2026");
    expect(formatTaxReportPeriod("2027-01-01", "2027-06-30")).toBe("2027-01-01 to 2027-06-30");
  });

  it("counts days to the due date, negative once overdue", () => {
    expect(daysUntil("2027-01-31", "2027-01-20")).toBe(11);
    expect(daysUntil("2027-01-31", "2027-01-31")).toBe(0);
    expect(daysUntil("2027-04-30", "2027-05-03")).toBe(-3);
  });

  it("lists the identity details a creator still has to give", () => {
    expect(missingTaxDetails(row())).toEqual([]);
    expect(missingTaxDetails(row({ tax_number: " ", date_of_birth: null, city: null }))).toEqual([
      "tax number",
      "date of birth",
      "address",
    ]);
    expect(missingTaxDetails(row({ account_type: "business", business_legal_name: "Lee Art Ltd", date_of_birth: null }))).toEqual([]);
  });

  it("writes one CSV line per row, with amounts in units and creator text made safe", () => {
    const csv = taxReportCsv([
      row(),
      row({ legal_first_name: "=HYPERLINK(\"x\")", address_line1: "1 Main St, Unit 2" }),
    ]);
    const lines = csv.trimEnd().split("\r\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^Creator account,Account type,Legal first name,/);
    expect(lines[1]).toContain("CAD,Q4,3,93.00,10.00,4.50,83.00,");
    expect(lines[2]).toContain(`"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toContain(`"1 Main St, Unit 2"`);
  });
});
