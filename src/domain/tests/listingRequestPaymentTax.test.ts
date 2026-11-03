import { describe, expect, it } from "vitest";

import { getBillingCountryOptions } from "../payments/billingCountries";
import {
  classifyTaxLocationEvidence,
  describePaymentTaxLine,
  type TaxEvidence,
} from "../payments/listingRequestPaymentTax";

describe("classifyTaxLocationEvidence", () => {
  it("is insufficient with only the buyer's declared billing country", () => {
    const result = classifyTaxLocationEvidence({
      taxJurisdictionCountry: "GB",
      evidence: [{ evidence_type: "billing_address_declared", country_code: "GB" }],
    });

    expect(result.status).toBe("insufficient");
    expect(result.agreeingCategories).toBe(1);
  });

  it("never counts the declared and Checkout billing addresses as two pieces -- both are one billing address", () => {
    const result = classifyTaxLocationEvidence({
      taxJurisdictionCountry: "GB",
      evidence: [
        { evidence_type: "billing_address_declared", country_code: "GB" },
        { evidence_type: "billing_address_checkout", country_code: "GB" },
      ],
    });

    expect(result.status).toBe("insufficient");
    expect(result.agreeingCategories).toBe(1);
  });

  it("is sufficient with two agreeing pieces from different categories", () => {
    const withCard = classifyTaxLocationEvidence({
      taxJurisdictionCountry: "GB",
      evidence: [
        { evidence_type: "billing_address_declared", country_code: "GB" },
        { evidence_type: "card_issuer", country_code: "GB" },
      ],
    });

    const withIp = classifyTaxLocationEvidence({
      taxJurisdictionCountry: "GB",
      evidence: [
        { evidence_type: "billing_address_declared", country_code: "GB" },
        { evidence_type: "ip_address", country_code: "GB" },
      ],
    });

    expect(withCard.status).toBe("sufficient");
    expect(withIp.status).toBe("sufficient");
  });

  it("tolerates one outlier (a traveller's IP) when two other categories agree", () => {
    const result = classifyTaxLocationEvidence({
      taxJurisdictionCountry: "GB",
      evidence: [
        { evidence_type: "billing_address_declared", country_code: "GB" },
        { evidence_type: "ip_address", country_code: "ES" },
        { evidence_type: "card_issuer", country_code: "GB" },
      ],
    });

    expect(result.status).toBe("sufficient");
    expect(result.conflictingCountry).toBeNull();
  });

  it("is contradictory when two categories agree on a different country than the one taxed", () => {
    const evidence: TaxEvidence[] = [
      { evidence_type: "billing_address_declared", country_code: "GB" },
      { evidence_type: "ip_address", country_code: "FR" },
      { evidence_type: "card_issuer", country_code: "FR" },
    ];

    const result = classifyTaxLocationEvidence({ taxJurisdictionCountry: "GB", evidence });

    expect(result.status).toBe("contradictory");
    expect(result.conflictingCountry).toBe("FR");
  });

  it("falls back to the declared billing country when no jurisdiction is recorded yet", () => {
    const result = classifyTaxLocationEvidence({
      taxJurisdictionCountry: null,
      evidence: [
        { evidence_type: "billing_address_declared", country_code: "CA" },
        { evidence_type: "card_issuer", country_code: "CA" },
      ],
    });

    expect(result.taxedCountry).toBe("CA");
    expect(result.status).toBe("sufficient");
  });
});

describe("describePaymentTaxLine", () => {
  const base = { tax_cents: 0 };

  it("is pending until tax has been determined", () => {
    expect(describePaymentTaxLine({ ...base, tax_treatment: null })).toEqual({
      label: "Tax",
      pending: true,
    });
  });

  it("is settled once tax has been worked out", () => {
    expect(
      describePaymentTaxLine({ ...base, tax_cents: 1300, tax_treatment: "calculated" }),
    ).toEqual({ label: "Tax", pending: false });

    expect(describePaymentTaxLine({ ...base, tax_treatment: "not_collected" })).toEqual({
      label: "Tax",
      pending: false,
    });
  });
});

describe("getBillingCountryOptions", () => {
  it("lists every ISO country once, named and sorted", () => {
    const options = getBillingCountryOptions();
    const codes = options.map((option) => option.code);

    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.length).toBeGreaterThan(240);
    expect(options.find((option) => option.code === "GB")?.name).toBe("United Kingdom");

    const names = options.map((option) => option.name);
    expect([...names].sort((a, b) => a.localeCompare(b, "en"))).toEqual(names);
  });
});
