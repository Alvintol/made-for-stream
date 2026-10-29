import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  display: { displayCurrency: null as string | null, rates: null as unknown },
  feeBps: 500,
}));

vi.mock("../../hooks/money/useDisplayCurrency", () => ({
  useDisplayCurrency: () => mocks.display,
}));

vi.mock("../../hooks/payments/useBuyerServiceFeeRate", () => ({
  useBuyerServiceFeeRate: () => ({ feeBps: mocks.feeBps, reason: "standard" }),
}));

import ListingPriceText from "../listings/ListingPriceText";

const rates = { base: "eur", date: "2026-10-06", rates: { eur: 1, cad: 1.6, usd: 1.25 } };
// €50 from the creator is €52.50 with the 5% buyer service fee.
const euroListing = { price_type: "fixed", price_min: 50, price_max: 50, currency: "eur" };

describe("<ListingPriceText />", () => {
  beforeEach(() => {
    mocks.display = { displayCurrency: null, rates: null };
    mocks.feeBps = 500;
  });

  it("shows the price with the buyer service fee included, and says so", () => {
    render(<ListingPriceText listing={euroListing} />);

    expect(screen.getByText("€52.50 EUR")).toBeInTheDocument();
    expect(screen.getByText("Includes 5% service fee")).toBeInTheDocument();
  });

  it("rounds the fee up to the cent, as payments do", () => {
    render(<ListingPriceText listing={{ ...euroListing, price_min: 10.01, price_max: 10.01 }} />);

    // 5% of 10.01 is 0.5005, charged as 0.51.
    expect(screen.getByText("€10.52 EUR")).toBeInTheDocument();
  });

  it("shows the real price when the visitor's currency is the creator's, with the creator's own price explained", () => {
    mocks.display = { displayCurrency: "eur", rates };

    render(<ListingPriceText listing={euroListing} variant="detailed" />);

    expect(screen.getByText("€52.50 EUR")).toBeInTheDocument();
    expect(screen.getByText(/Includes 5% service fee: the creator's price is €50 EUR/)).toBeInTheDocument();
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
  });

  it("on a card, shows the estimate and keeps the real price one hover away", () => {
    mocks.display = { displayCurrency: "cad", rates };

    render(<ListingPriceText listing={euroListing} />);

    const estimate = screen.getByText(/≈ \$84 CAD/);

    expect(estimate).toHaveAttribute(
      "title",
      "Priced in EUR: €52.50 EUR. The figure shown is an estimate.",
    );
    // Screen readers are told it is approximate and what the real price is.
    expect(estimate).toHaveTextContent("approximate; the listing is priced at €52.50 EUR");
  });

  it("on the listing page, shows the real price first, then the estimate and what it means", () => {
    mocks.display = { displayCurrency: "cad", rates };

    const { container } = render(<ListingPriceText listing={euroListing} variant="detailed" />);

    const text = container.textContent ?? "";

    expect(text.indexOf("€52.50 EUR")).toBeLessThan(text.indexOf("≈ $84 CAD"));
    expect(screen.getByText(/This listing is priced in Euro \(EUR\), the creator's currency/)).toBeInTheDocument();
    expect(screen.getByText(/You pay in EUR/)).toBeInTheDocument();
    expect(screen.getByText(/reference rate for 2026-10-06/)).toBeInTheDocument();
  });

  it("falls back to the real price when rates could not be loaded", () => {
    mocks.display = { displayCurrency: "cad", rates: null };

    render(<ListingPriceText listing={euroListing} variant="detailed" />);

    expect(screen.getByText("€52.50 EUR")).toBeInTheDocument();
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
  });

  it("says nothing about a fee on a free listing", () => {
    render(<ListingPriceText listing={{ ...euroListing, price_min: 0, price_max: 0 }} />);

    expect(screen.getByText("€0 EUR")).toBeInTheDocument();
    expect(screen.queryByText(/service fee/)).not.toBeInTheDocument();
  });

  it("says nothing about a fee when the buyer's fee is waived", () => {
    mocks.feeBps = 0;

    render(<ListingPriceText listing={euroListing} />);

    expect(screen.getByText("€50 EUR")).toBeInTheDocument();
    expect(screen.queryByText(/service fee/)).not.toBeInTheDocument();
  });
});
