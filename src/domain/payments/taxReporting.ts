// The admin Tax reporting page (20261028_170). The report names match the
// ops email's (TAX_REPORT_NAMES in api/opsAlerts.js). Playbook: TAX-008 in
// docs/support/payments/tax.md.

export type TaxReportRegime =
  | "eu_dac7"
  | "ca_dpi"
  | "uk_dpi"
  | "nz_dpi"
  | "au_serr"
  | "us_1099k"
  | "ca_gst";

export type TaxReportObligation = {
  regime: TaxReportRegime;
  period_start: string;
  period_end: string;
  due_date: string;
  // null for the GST/HST return, which is not a report on creators.
  seller_count: number | null;
  filed_at: string | null;
  reference: string | null;
};

// One creator's figures in one currency and calendar quarter, with their
// private account details (admin_list_tax_report_sellers).
export type TaxReportSellerRow = {
  creator_user_id: string;
  country_code: string | null;
  currency: string;
  quarter: number;
  payments: number;
  paid_cents: number;
  refunded_cents: number;
  creator_fee_cents: number;
  account_type: "individual" | "business" | null;
  legal_first_name: string | null;
  legal_last_name: string | null;
  business_legal_name: string | null;
  date_of_birth: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  tax_number: string | null;
  business_registration_number: string | null;
  stripe_account_id: string | null;
};

export const TAX_REPORTS: Record<TaxReportRegime, { name: string; howToFile: string }> = {
  eu_dac7: {
    name: "EU DAC7 creator report",
    howToFile:
      "Filed with the one EU country Made for Stream registers with, in that country's format. Register there once the first EU creator is paid. Each creator also gets a copy of their figures.",
  },
  ca_dpi: {
    name: "Canada platform operator report (CRA)",
    howToFile:
      "Filed with the CRA under the reporting rules for digital platform operators. Each creator also gets a copy of their figures.",
  },
  uk_dpi: {
    name: "UK digital platform report (HMRC)",
    howToFile:
      "Filed through HMRC's digital platform reporting service. Each creator also gets a copy of their figures.",
  },
  nz_dpi: {
    name: "New Zealand platform operator report (Inland Revenue)",
    howToFile:
      "Filed through Inland Revenue's myIR. Each creator also gets a copy of their figures.",
  },
  au_serr: {
    name: "Australia sharing economy report (ATO)",
    howToFile: "Lodged with the ATO for each half year through Online services for business.",
  },
  us_1099k: {
    name: "US Form 1099-K",
    howToFile:
      "Only for US creators paid over $20,000 in more than 200 payments in the year. Send each a copy by 31 January and e-file with the IRS by 31 March. Stripe can file these for a fee (Connect → Tax forms).",
  },
  ca_gst: {
    name: "GST/HST return and payment",
    howToFile:
      "One return for the business number, covering Created by Alvin and Made for Stream together. Pay by 30 April and file by 15 June (annual filer).",
  },
};

export const formatTaxReportPeriod = (start: string, end: string) =>
  start.endsWith("-01-01") && end.endsWith("-12-31") && start.slice(0, 4) === end.slice(0, 4)
    ? start.slice(0, 4)
    : `${start} to ${end}`;

// Whole days from today to the due date (negative once overdue). Both are
// calendar dates, so this counts in UTC to avoid a daylight-saving hour.
export const daysUntil = (dueDate: string, today: string) =>
  Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);

const blank = (value: string | null) => !value || !value.trim();

// The identity details the authorities ask for that this creator has not
// given. A business has no date of birth.
export const missingTaxDetails = (row: TaxReportSellerRow): string[] => [
  ...(blank(row.tax_number) ? ["tax number"] : []),
  ...(row.account_type !== "business" && !row.date_of_birth ? ["date of birth"] : []),
  ...(blank(row.address_line1) || blank(row.city) || blank(row.country_code) ? ["address"] : []),
];

export const taxReportSellerName = (row: TaxReportSellerRow) =>
  row.account_type === "business" && row.business_legal_name
    ? row.business_legal_name
    : [row.legal_first_name, row.legal_last_name].filter(Boolean).join(" ") || row.creator_user_id;

const amount = (cents: number) => (cents / 100).toFixed(2);

// A value as one CSV cell. Names and addresses are typed by creators, so a
// value a spreadsheet would run as a formula is prefixed with an apostrophe.
const csvCell = (value: string | number | null) => {
  let text = value === null ? "" : String(value);

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvColumns: [string, (row: TaxReportSellerRow) => string | number | null][] = [
  ["Creator account", (row) => row.creator_user_id],
  ["Account type", (row) => row.account_type],
  ["Legal first name", (row) => row.legal_first_name],
  ["Legal last name", (row) => row.legal_last_name],
  ["Business legal name", (row) => row.business_legal_name],
  ["Date of birth", (row) => row.date_of_birth],
  ["Address line 1", (row) => row.address_line1],
  ["Address line 2", (row) => row.address_line2],
  ["City", (row) => row.city],
  ["Region", (row) => row.region],
  ["Postal code", (row) => row.postal_code],
  ["Country", (row) => row.country_code],
  ["Tax number", (row) => row.tax_number],
  ["Business registration number", (row) => row.business_registration_number],
  ["Stripe account", (row) => row.stripe_account_id],
  ["Currency", (row) => row.currency.toUpperCase()],
  ["Quarter", (row) => `Q${row.quarter}`],
  ["Payments", (row) => row.payments],
  ["Paid (work and tips)", (row) => amount(row.paid_cents)],
  ["Refunded", (row) => amount(row.refunded_cents)],
  ["Creator fees kept by Made for Stream", (row) => amount(row.creator_fee_cents)],
  ["Net paid", (row) => amount(row.paid_cents - row.refunded_cents)],
  ["Missing details", (row) => missingTaxDetails(row).join("; ")],
];

export const taxReportCsv = (rows: TaxReportSellerRow[]) =>
  [
    csvColumns.map(([heading]) => heading).join(","),
    ...rows.map((row) => csvColumns.map(([, read]) => csvCell(read(row))).join(",")),
  ].join("\r\n") + "\r\n";

export const taxReportFileName = (obligation: Pick<TaxReportObligation, "regime" | "period_start" | "period_end">) =>
  `made-for-stream-${obligation.regime}-${obligation.period_start}-to-${obligation.period_end}.csv`;
