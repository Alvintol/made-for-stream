import { describe, expect, it } from "vitest";

import {
  describeBuyerServiceFee,
  canOpenListingRequestPaymentCheckout,
  formatPaymentCents,
  getListingRequestPaymentActionLabel,
  getListingRequestPaymentStatusLabel,
  getListingRequestPaymentTypeLabel,
} from "../payments/listingRequestPaymentDisplay";

describe("listing commission payment display", () => {
  it.each([
    [12345, "cad", "$123.45"],
    [12345, "USD", "US$123.45"],
    [0, "cad", "$0.00"],
    [-1050, "cad", "-$10.50"],
    [1, "cad", "$0.01"],
  ])("formats %s minor units in %s as %s", (cents, currency, expected) => {
    expect(formatPaymentCents(cents, currency)).toBe(expected);
  });

  it("labels milestone payments", () => {
    expect(
      getListingRequestPaymentTypeLabel(
        "milestone_payment",
      ),
    ).toBe("Milestone payment");
  });

  it("shows Pay now for a new checkout", () => {
    expect(
      getListingRequestPaymentActionLabel(
        "requires_checkout",
      ),
    ).toBe("Pay now");
  });

  it("shows Continue payment after checkout has started", () => {
    expect(
      getListingRequestPaymentActionLabel(
        "checkout_opened",
      ),
    ).toBe("Continue payment");
  });

  it("shows Retry payment after a failed payment", () => {
    expect(
      getListingRequestPaymentActionLabel("failed"),
    ).toBe("Retry payment");
  });

  it("does not expose checkout for paid payments", () => {
    expect(
      canOpenListingRequestPaymentCheckout({
        status: "paid",
      }),
    ).toBe(false);
  });

  it("allows checkout for payment-required rows", () => {
    expect(
      canOpenListingRequestPaymentCheckout({
        status: "requires_checkout",
      }),
    ).toBe(true);
  });

  it("labels processing payments", () => {
    expect(
      getListingRequestPaymentStatusLabel("processing"),
    ).toBe("Processing");
  });
});

describe("describeBuyerServiceFee", () => {
  const payment = (overrides: Partial<Parameters<typeof describeBuyerServiceFee>[0]> = {}) => ({
    base_amount_cents: 10000,
    buyer_service_fee_cents: 500,
    buyer_service_fee_bps: 500,
    buyer_service_fee_minimum_cents: 100,
    currency: "cad",
    ...overrides,
  });

  it("states the rate alone when the percentage is the binding figure", () => {
    expect(describeBuyerServiceFee(payment())).toBe(
      "5% of the project payment.",
    );
  });

  it("explains the minimum when it is the binding figure", () => {
    // 5% of 10.00 is 0.50, so the 1.00 minimum is what the buyer actually pays.
    const result = describeBuyerServiceFee(
      payment({ base_amount_cents: 1000, buyer_service_fee_cents: 100 }),
    );

    expect(result).toContain("5% of the project payment");
    expect(result).toContain("$1.00 minimum");
  });

  it("reads the rate from the payment rather than assuming 5%", () => {
    const result = describeBuyerServiceFee(
      payment({ buyer_service_fee_bps: 250, buyer_service_fee_cents: 250 }),
    );

    expect(result).toBe("2.5% of the project payment.");
  });

  it("does not claim a minimum applied when the fee exactly equals the percentage", () => {
    // Boundary: 5% of 20.00 is exactly the 1.00 minimum, so neither is "binding".
    const result = describeBuyerServiceFee(
      payment({ base_amount_cents: 2000, buyer_service_fee_cents: 100 }),
    );

    expect(result).toBe("5% of the project payment.");
  });

  it("formats the minimum in the payment's own currency", () => {
    const result = describeBuyerServiceFee(
      payment({
        base_amount_cents: 1000,
        buyer_service_fee_cents: 100,
        currency: "usd",
      }),
    );

    expect(result).toContain("US$1.00");
  });
});

describe("describeBuyerServiceFee after the minimums were removed", () => {
  const payment = (overrides = {}) => ({
    base_amount_cents: 10000,
    buyer_service_fee_cents: 500,
    buyer_service_fee_bps: 500,
    buyer_service_fee_minimum_cents: 0,
    currency: "cad",
    ...overrides,
  });

  it("states the plain rate when no minimum is recorded", () => {
    // New payments carry a zero minimum, so the minimum branch never runs.
    expect(describeBuyerServiceFee(payment())).toBe(
      "5% of the project payment.",
    );
  });

  it("still explains the minimum on a payment taken before they were removed", () => {
    // Historical rows keep the minimum they were actually charged under.
    const result = describeBuyerServiceFee(
      payment({
        base_amount_cents: 1000,
        buyer_service_fee_cents: 100,
        buyer_service_fee_minimum_cents: 100,
      }),
    );

    expect(result).toContain("$1.00 minimum");
  });

  it("says a waived fee is waived rather than reporting 0%", () => {
    const result = describeBuyerServiceFee(
      payment({ buyer_service_fee_cents: 0, buyer_service_fee_bps: 0 }),
    );

    expect(result).toBe("waived on this payment.");
    expect(result).not.toContain("0%");
  });

  it("treats a small payment at the standard rate without a minimum", () => {
    // 5% of 5.00 is 0.25. Before, the 1.00 minimum would have quadrupled it.
    const result = describeBuyerServiceFee(
      payment({ base_amount_cents: 500, buyer_service_fee_cents: 25 }),
    );

    expect(result).toBe("5% of the project payment.");
  });
});
