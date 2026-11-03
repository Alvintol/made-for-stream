import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatorTaxSummary } from "../../domain/payments/sales";

const mocks = vi.hoisted(() => ({
  tax: null as unknown,
  chart: { unit: "month", periods: [], rows: [] } as unknown,
  details: null as unknown,
  years: [] as number[],
}));

vi.mock("../../hooks/payments/useSales", () => ({
  useMyTaxSummary: (year: number) => {
    mocks.years.push(year);

    return { data: mocks.tax, error: null, isLoading: false };
  },
  useMySalesChart: () => ({ data: mocks.chart, error: null, isLoading: false }),
}));

vi.mock("../../hooks/settings/useAccountDetails", () => ({
  useAccountDetails: () => ({ data: mocks.details }),
}));

import CreatorStatement from "../creator/CreatorStatement";

const today = new Date("2026-11-03T12:00:00Z");

const tax: CreatorTaxSummary = {
  creator_country: "CA",
  totals: [
    { currency: "cad", payments: 6, sold_cents: 219300, fee_cents: 10450, fee_tax_cents: 498, earned_cents: 208850 },
  ],
  regions: [
    {
      country: "CA",
      region: "AB",
      currency: "cad",
      payments: 6,
      sold_cents: 219300,
      earned_cents: 208850,
      commission_sold_cents: 219300,
      bps: 500,
      tax_cents: 10965,
    },
  ],
  small_supplier: { from: "2026-01-01", sold_cents: 219300 },
};

const row = (period: string, paid: number, fee: number) => ({
  period,
  currency: "cad",
  sales: 0,
  instant_sales: 0,
  sold_cents: 0,
  transactions: 1,
  paid_cents: paid,
  fee_cents: fee,
  earned_cents: paid - fee,
});

const renderYear = (year: string) =>
  render(
    <MemoryRouter initialEntries={[`/creator/earnings/statement/${year}`]}>
      <Routes>
        <Route path="/creator/earnings/statement/:year" element={<CreatorStatement today={today} />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.tax = tax;
  mocks.chart = { unit: "month", periods: [], rows: [] };
  mocks.details = {
    account_type: "individual",
    legal_first_name: "Ada",
    legal_last_name: "Lovelace",
    address_line1: "1 Main St",
    address_line2: null,
    city: "Calgary",
    region: "AB",
    postal_code: "T2P 1J9",
    country_code: "CA",
    business_legal_name: null,
    tax_number: "123456789 RT0001",
  };
  mocks.years = [];
});

describe("<CreatorStatement />", () => {
  it("says who it's for, and that it isn't a government form", () => {
    renderYear("2025");

    expect(screen.getByRole("heading", { name: "Earnings statement 2025" })).toBeInTheDocument();
    expect(screen.getByText("January to December 2025", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Tax number: 123456789 RT0001")).toBeInTheDocument();
    expect(screen.getByText(/isn't a government tax form/)).toBeInTheDocument();
    expect(mocks.years).toContain(2025);
  });

  it("adds up the year, with the GST/HST in the fees", () => {
    renderYear("2026");

    expect(screen.getByText("Sales, less refunds").nextSibling).toHaveTextContent("$2,193.00");
    expect(screen.getByText("GST/HST in those fees").nextSibling).toHaveTextContent("$4.98");
    expect(screen.getAllByText("Total earnings")[0].nextSibling).toHaveTextContent("$2,088.50");
  });

  it("lists every month so far, adding up days into months", () => {
    mocks.chart = {
      unit: "day",
      periods: [],
      rows: [row("2026-02-03", 10000, 500), row("2026-02-20", 5000, 250), row("2026-11-01", 2000, 150)],
    };

    renderYear("2026");

    expect(screen.getByText(/2026 so far, to November 3, 2026/)).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /December 2026/ })).not.toBeInTheDocument();

    const february = screen.getByRole("row", { name: /February 2026/ });

    expect(within(february).getByText("2")).toBeInTheDocument();
    expect(within(february).getByText("$150.00")).toBeInTheDocument();
    expect(within(february).getByText("$142.50")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /January 2026/ })).getAllByText("$0.00")).toHaveLength(3);
  });

  it("includes sales by the buyer's region", () => {
    renderYear("2026");

    expect(within(screen.getByRole("row", { name: /Alberta/ })).getByText("5%")).toBeInTheDocument();
  });

  it("asks for personal details when there are none", () => {
    mocks.details = null;

    renderYear("2026");

    expect(screen.getByText(/Settings → Personal details/)).toBeInTheDocument();
  });

  it("refuses a year that isn't offered, without asking for it", () => {
    renderYear("2019");

    expect(screen.getByText("There's no statement for that year.")).toBeInTheDocument();
    expect(mocks.years).not.toContain(2019);
  });
});
