import { english, type Translate } from "../../lib/i18n/i18n";

// Sprint 7 (launch-scope.md section 12): buyer location evidence and the
// checkout's tax line.
//
// classifyTaxLocationEvidence mirrors
// get_listing_request_payment_tax_evidence_status
// (supabase/migrations/20260923_137_add_listing_request_payment_tax.sql)
// exactly. The database function is what support and reconciliation run;
// this copy exists so the rule has a test harness.

export type TaxEvidenceType =
  | "billing_address_declared"
  | "billing_address_checkout"
  | "ip_address"
  | "card_issuer";

export type TaxEvidenceCategory = "billing_address" | "ip_address" | "card_issuer";

export type TaxEvidence = {
  evidence_type: TaxEvidenceType;
  country_code: string;
};

export type TaxEvidenceStatus = "sufficient" | "insufficient" | "contradictory";

// Two rows in the same category are ONE piece of evidence: a billing
// country the buyer declared and the billing address Stripe Checkout later
// collected are both "billing address". EU VAT needs two
// non-contradictory pieces, so a buyer repeating themselves never counts
// twice.
export const getTaxEvidenceCategory = (
  evidenceType: TaxEvidenceType,
): TaxEvidenceCategory =>
  evidenceType === "billing_address_declared" ||
  evidenceType === "billing_address_checkout"
    ? "billing_address"
    : evidenceType;

const categoriesFor = (evidence: TaxEvidence[], country: string): number =>
  new Set(
    evidence
      .filter((row) => row.country_code === country)
      .map((row) => getTaxEvidenceCategory(row.evidence_type)),
  ).size;

export const classifyTaxLocationEvidence = ({
  taxJurisdictionCountry,
  evidence,
}: {
  taxJurisdictionCountry: string | null;
  evidence: TaxEvidence[];
}): {
  status: TaxEvidenceStatus;
  taxedCountry: string | null;
  agreeingCategories: number;
  conflictingCountry: string | null;
} => {
  const taxedCountry =
    taxJurisdictionCountry ??
    evidence.find((row) => row.evidence_type === "billing_address_declared")
      ?.country_code ??
    null;

  const agreeingCategories = taxedCountry ? categoriesFor(evidence, taxedCountry) : 0;

  const otherCountries = [
    ...new Set(
      evidence
        .map((row) => row.country_code)
        .filter((country) => country !== taxedCountry),
    ),
  ].sort();

  // Same tie-break as the SQL: most categories first, then country code.
  const conflictingCountry =
    otherCountries
      .map((country) => ({ country, count: categoriesFor(evidence, country) }))
      .filter((entry) => entry.count >= 2)
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country))[0]
      ?.country ?? null;

  return {
    status: conflictingCountry
      ? "contradictory"
      : agreeingCategories >= 2
        ? "sufficient"
        : "insufficient",
    taxedCountry,
    agreeingCategories,
    conflictingCountry,
  };
};

export type PaymentTaxDisplayInput = {
  tax_cents: number;
  tax_treatment: "not_collected" | "calculated" | null;
  tax_jurisdiction_country: string | null;
  tax_jurisdiction_region: string | null;
};

// Fee Schedule section 6: tax is identified separately before payment. A
// payment whose tax has not been determined yet says so, rather than
// showing a zero that could later change.
export const describePaymentTaxLine = (
  payment: PaymentTaxDisplayInput,
  t: Translate = english,
): { label: string; pending: boolean } => {
  if (!payment.tax_treatment) {
    return { label: t("tax.label"), pending: true };
  }

  const place = payment.tax_jurisdiction_region
    ? `${payment.tax_jurisdiction_country}-${payment.tax_jurisdiction_region}`
    : payment.tax_jurisdiction_country;

  return { label: place ? t("tax.labelPlace", { place }) : t("tax.label"), pending: false };
};
