// Sales numbers and invoices (20261102_180, 20261103_181). The database works
// out every figure; this file only shapes them for the pages. Playbook:
// docs/support/payments/sales.md.
//
// A sale is one completed project, however many payments it took. A transaction
// is one payment or refund.
export type CreatorSalesTotals = {
  currency: string;
  sales: number;
  sold_cents: number;
  transactions: number;
  paid_cents: number;
  refunded_cents: number;
  fee_cents: number;
  fee_tax_cents: number;
  earned_cents: number;
};

export type CreatorSaleRow = {
  listing_request_id: string;
  completed_at: string;
  title: string | null;
  currency: string;
  transactions: number;
  sold_cents: number;
  fee_cents: number;
  earned_cents: number;
};

export type CreatorTransactionRow = {
  movement_id: string;
  payment_id: string;
  listing_request_id: string;
  kind: "sale" | "refund";
  happened_at: string;
  title: string | null;
  currency: string;
  sold_cents: number;
  fee_cents: number;
  earned_cents: number;
};

export type AdminSalesTotals = {
  currency: string;
  sales: number;
  sold_cents: number;
  transactions: number;
  paid_cents: number;
  refunded_cents: number;
  kept_cents: number;
  tax_cents: number;
  earned_cents: number;
};

export type AdminTaxRow = {
  place: string;
  bps: number;
  currency: string;
  fees_cents: number;
  tax_cents: number;
};

export type AdminSalesSummary = {
  totals: AdminSalesTotals[];
  tax: AdminTaxRow[];
};

export type AdminSaleRow = {
  listing_request_id: string;
  completed_at: string;
  title: string | null;
  creator_handle: string | null;
  currency: string;
  transactions: number;
  sold_cents: number;
  kept_cents: number;
};

export type AdminTransactionRow = {
  movement_id: string;
  payment_id: string;
  listing_request_id: string;
  kind: "sale" | "refund";
  happened_at: string;
  title: string | null;
  creator_handle: string | null;
  currency: string;
  sold_cents: number;
  kept_cents: number;
  tax_cents: number;
  buyer_tax_place: string;
  creator_tax_place: string;
};

export type CreatorChartRow = {
  period: string;
  currency: string;
  sales: number;
  sold_cents: number;
  transactions: number;
  paid_cents: number;
  fee_cents: number;
  earned_cents: number;
};

export type AdminChartRow = {
  period: string;
  currency: string;
  sales: number;
  sold_cents: number;
  transactions: number;
  paid_cents: number;
  kept_cents: number;
  tax_cents: number;
  earned_cents: number;
};

// `periods` lists every day or month in the range, including quiet ones.
export type SalesChartData<Row> = {
  unit: "day" | "month";
  periods: string[];
  rows: Row[];
};

export type PaymentInvoice = {
  id: string;
  number: string;
  paid_at: string;
  title: string | null;
  currency: string;
  seller_name: string;
  seller_tax_number: string | null;
  base_cents: number;
  tip_cents: number;
  buyer_fee_cents: number;
  support_cents: number;
  added_tax_cents: number;
  total_cents: number;
  refunded_cents: number;
  // Null for the creator: the buyer's rate would give away where they live.
  buyer_tax_bps: number | null;
  buyer_fee_tax_cents: number | null;
  // Null for the buyer.
  creator_fee_cents: number | null;
  creator_tax_bps: number | null;
  creator_fee_tax_cents: number | null;
};

// Months are UTC, the same as the tax reports, and held as "YYYY-MM" because
// that's what a month input gives.
export const currentSalesMonth = (now = new Date()): string => now.toISOString().slice(0, 7);

export const salesMonthToDate = (month: string): string => `${month}-01`;

// Round numbers for a graph's axis, always including zero. A refund can take a
// day below it.
export const chartTicks = (values: number[]): number[] => {
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const rough = Math.max(high - low, 100) / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((size) => size * power).find((size) => size >= rough) ?? rough;
  const first = Math.floor(low / step);
  const last = Math.max(Math.ceil(high / step), first + 1);

  return Array.from({ length: last - first + 1 }, (_, index) => (first + index) * step);
};

export const formatChartPeriod = (
  period: string,
  unit: SalesChartData<unknown>["unit"],
  locale?: string,
): string =>
  new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "short",
    ...(unit === "day" ? { day: "numeric" } : { year: "numeric" }),
  }).format(new Date(`${period}T00:00:00Z`));

const CANADA_REGIONS: Record<string, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

export const isUnknownTaxPlace = (place: string): boolean => place.includes("?");

// For the admin page, which stays in English.
export const taxPlaceName = (place: string): string => {
  if (isUnknownTaxPlace(place)) return "Unknown, check this";
  if (place === "US") return "United States (zero-rated)";

  return place.startsWith("CA-") ? (CANADA_REGIONS[place.slice(3)] ?? place) : place;
};

// Every place on the same return, added up by currency.
export const taxTotalsByCurrency = (rows: AdminTaxRow[]): Array<{ currency: string; tax_cents: number }> => {
  const totals = new Map<string, number>();

  rows.forEach((row) => totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.tax_cents));

  return [...totals].map(([currency, tax_cents]) => ({ currency, tax_cents }));
};
