import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  display: { displayCurrency: null as string | null, rates: null as unknown },
}));

vi.mock("../../hooks/money/useDisplayCurrency", () => ({
  useDisplayCurrency: () => mocks.display,
}));

import ListingPriceText from "../listings/ListingPriceText";

const rates = { base: "eur", date: "2026-10-06", rates: { eur: 1, cad: 1.6, usd: 1.25 } };
const euroListing = { price_type: "fixed", price_min: 50, price_max: 50, currency: "eur" };

describe("<ListingPriceText />", () => {
  beforeEach(() => {
    mocks.display = { displayCurrency: null, rates: null };
  });

  it("shows the creator's real price when there is nothing to convert to", () => {
    render(<ListingPriceText listing={euroListing} />);

    expect(screen.getByText("€50 EUR")).toBeInTheDocument();
  });

  it("shows the real price when the visitor's currency is the creator's", () => {
    mocks.display = { displayCurrency: "eur", rates };

    render(<ListingPriceText listing={euroListing} variant="detailed" />);

    expect(screen.getByText("€50 EUR")).toBeInTheDocument();
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
  });

  it("on a card, shows the estimate and keeps the real price one hover away", () => {
    mocks.display = { displayCurrency: "cad", rates };

    render(<ListingPriceText listing={euroListing} />);

    const estimate = screen.getByText(/≈ \$80 CAD/);

    expect(estimate).toHaveAttribute(
      "title",
      "Priced in EUR: €50 EUR. The figure shown is an estimate.",
    );
    // Screen readers are told it is approximate and what the real price is.
    expect(estimate).toHaveTextContent("approximate; the listing is priced at €50 EUR");
  });

  it("on the listing page, shows the real price first, then the estimate and what it means", () => {
    mocks.display = { displayCurrency: "cad", rates };

    const { container } = render(<ListingPriceText listing={euroListing} variant="detailed" />);

    const text = container.textContent ?? "";

    expect(text.indexOf("€50 EUR")).toBeLessThan(text.indexOf("≈ $80 CAD"));
    expect(screen.getByText(/This listing is priced in Euro \(EUR\), the creator's currency/)).toBeInTheDocument();
    expect(screen.getByText(/You pay in EUR/)).toBeInTheDocument();
    expect(screen.getByText(/reference rate for 2026-10-06/)).toBeInTheDocument();
  });

  it("falls back to the real price when rates could not be loaded", () => {
    mocks.display = { displayCurrency: "cad", rates: null };

    render(<ListingPriceText listing={euroListing} variant="detailed" />);

    expect(screen.getByText("€50 EUR")).toBeInTheDocument();
    expect(screen.queryByText(/≈/)).not.toBeInTheDocument();
  });
});
