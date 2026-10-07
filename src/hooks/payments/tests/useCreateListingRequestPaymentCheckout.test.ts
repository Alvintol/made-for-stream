import { describe, expect, it } from "vitest";

const getCheckoutResponseErrorMessage = (
  json: { error?: string },
  status: number,
): string => json.error || `Stripe checkout failed (${status})`;

describe("listing commission payment checkout helpers", () => {
  it("uses API errors when available", () => {
    expect(
      getCheckoutResponseErrorMessage(
        {
          error: "Payment record was not found.",
        },
        400,
      ),
    ).toBe("Payment record was not found.");
  });

  it("falls back to the response status", () => {
    expect(getCheckoutResponseErrorMessage({}, 500)).toBe(
      "Stripe checkout failed (500)",
    );
  });
});