import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AdminChartRow,
  AdminSalesSummary,
  CreatorChartRow,
  CreatorSaleRow,
  CreatorSalesTotals,
  CreatorTransactionRow,
  PaymentInvoice as Invoice,
  SalesChartData,
} from "../../domain/payments/sales";
const mocks = vi.hoisted(() => ({
  months: [] as string[],
  totals: [] as unknown[],
  saleRows: [] as unknown[],
  rows: [] as unknown[],
  adminRows: [] as unknown[],
  adminSaleRows: [] as unknown[],
  adminSummary: { totals: [], tax: [] } as unknown,
  chart: { unit: "day", periods: [], rows: [] } as unknown,
  chartDays: [] as number[],
  invoice: null as unknown,
  invoiceError: null as unknown,
}));

vi.mock("../../hooks/payments/useSales", () => ({
  useMySalesSummary: (month: string) => {
    mocks.months.push(month);

    return { data: mocks.totals, isLoading: false };
  },
  useMyCompletedSales: () => ({ data: { pages: [{ rows: mocks.saleRows }] }, hasNextPage: false }),
  useMyTransactions: () => ({ data: { pages: [{ rows: mocks.rows }] }, hasNextPage: false }),
  useMySalesChart: (days: number) => {
    mocks.chartDays.push(days);

    return { data: mocks.chart, error: null, isPlaceholderData: false };
  },
  useAdminSalesSummary: () => ({ data: mocks.adminSummary, isLoading: false }),
  useAdminCompletedSales: () => ({
    data: { pages: [{ rows: mocks.adminSaleRows }] },
    hasNextPage: false,
  }),
  useAdminTransactions: () => ({ data: { pages: [{ rows: mocks.adminRows }] }, hasNextPage: false }),
  useAdminSalesChart: () => ({ data: mocks.chart, error: null, isPlaceholderData: false }),
  usePaymentInvoice: () => ({ data: mocks.invoice, error: mocks.invoiceError, isLoading: false }),
}));

import AdminSales from "../admin/AdminSales";
import CreatorSales from "../creator/CreatorSales";
import PaymentInvoice from "../payments/PaymentInvoice";

const totals: CreatorSalesTotals = {
  currency: "cad",
  sales: 1,
  sold_cents: 30000,
  transactions: 3,
  paid_cents: 20000,
  refunded_cents: 5000,
  fee_cents: 1000,
  fee_tax_cents: 48,
  earned_cents: 19000,
};

const completedSale: CreatorSaleRow = {
  listing_request_id: "r1",
  listing_id: "l1",
  instant: false,
  completed_at: "2026-11-02T12:00:00+00:00",
  title: "Milestone project",
  currency: "cad",
  transactions: 3,
  sold_cents: 30000,
  fee_cents: 1500,
  earned_cents: 28500,
};

const transaction: CreatorTransactionRow = {
  movement_id: "m1",
  payment_id: "p1",
  listing_request_id: "r1",
  listing_id: "l1",
  instant: false,
  kind: "sale",
  happened_at: "2026-11-02T12:00:00+00:00",
  title: "Emote pack",
  currency: "cad",
  sold_cents: 10000,
  fee_cents: 500,
  earned_cents: 9500,
};

const invoice: Invoice = {
  id: "p1",
  number: "ABCD1234",
  paid_at: "2026-11-02T12:00:00+00:00",
  title: "Emote pack",
  currency: "cad",
  seller_name: "Ada's Art Ltd",
  seller_tax_number: "123456789 RT0001",
  base_cents: 10000,
  tip_cents: 500,
  buyer_fee_cents: 500,
  support_cents: 200,
  added_tax_cents: 0,
  total_cents: 11200,
  refunded_cents: 0,
  buyer_tax_bps: 1300,
  buyer_fee_tax_cents: 81,
  creator_fee_cents: null,
  creator_tax_bps: null,
  creator_fee_tax_cents: null,
};

const renderInvoice = () =>
  render(
    <MemoryRouter initialEntries={["/payments/invoice/p1"]}>
      <Routes>
        <Route path="/payments/invoice/:paymentId" element={<PaymentInvoice />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.months = [];
  mocks.totals = [];
  mocks.saleRows = [];
  mocks.rows = [];
  mocks.adminRows = [];
  mocks.adminSaleRows = [];
  mocks.adminSummary = { totals: [], tax: [] };
  mocks.chart = { unit: "day", periods: [], rows: [] };
  mocks.chartDays = [];
  mocks.invoice = invoice;
  mocks.invoiceError = null;
});

describe("<CreatorSales />", () => {
  it("shows the month's sales, earnings and fees", () => {
    mocks.totals = [totals];

    render(
      <MemoryRouter>
        <CreatorSales />
      </MemoryRouter>,
    );

    expect(screen.getByText("Total sales").nextSibling).toHaveTextContent("$300.00");
    expect(screen.getByText("Completed: 1")).toBeInTheDocument();
    expect(screen.getByText("Transactions").nextSibling).toHaveTextContent("$200.00");
    expect(screen.getByText("Payments: 3 · After $50.00 in refunds")).toBeInTheDocument();
    expect(screen.getByText("Total earnings").nextSibling).toHaveTextContent("$190.00");
    expect(screen.getByText("Fees to Made for Stream").nextSibling).toHaveTextContent("$10.00");
    expect(screen.getByText("Includes $0.48 GST/HST")).toBeInTheDocument();
  });

  it("gives each currency its own row, because they can't be added", () => {
    mocks.totals = [totals, { ...totals, currency: "usd" }];

    render(
      <MemoryRouter>
        <CreatorSales />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Total sales")).toHaveLength(2);
    expect(screen.getByText("US$200.00")).toBeInTheDocument();
  });

  it("shows a milestone project as one sale, however many payments it took", () => {
    mocks.saleRows = [completedSale];

    render(
      <MemoryRouter>
        <CreatorSales />
      </MemoryRouter>,
    );

    const row = screen.getByRole("row", { name: /Milestone project/ });

    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByText("$300.00")).toBeInTheDocument();
    expect(within(row).getByText("$285.00")).toBeInTheDocument();
  });

  it("lists each transaction with its invoice, and marks a refund", () => {
    mocks.rows = [
      transaction,
      {
        ...transaction,
        movement_id: "m2",
        kind: "refund",
        sold_cents: -10000,
        fee_cents: -500,
        earned_cents: -9500,
      },
    ];
    render(
      <MemoryRouter>
        <CreatorSales />
      </MemoryRouter>,
    );

    expect(screen.getByText("Refund")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Invoice" })[0]).toHaveAttribute(
      "href",
      "/payments/invoice/p1",
    );
  });

  it("reads the month that's chosen", () => {
    render(
      <MemoryRouter>
        <CreatorSales />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2026-10" } });

    expect(mocks.months.at(-1)).toBe("2026-10");
    expect(screen.getAllByText("No sales this month.").length).toBeGreaterThan(0);
  });
});

describe("the sales graph", () => {
  const row: CreatorChartRow = {
    period: "2026-11-01",
    currency: "cad",
    sales: 1,
    sold_cents: 30000,
    transactions: 2,
    paid_cents: 20000,
    fee_cents: 1000,
    earned_cents: 19000,
  };

  const chart: SalesChartData<CreatorChartRow> = {
    unit: "day",
    periods: ["2026-10-31", "2026-11-01", "2026-11-02"],
    rows: [row, { ...row, period: "2026-11-02", sales: 0, sold_cents: 0, earned_cents: 500 }],
  };

  const renderChart = () =>
    render(
      <MemoryRouter>
        <CreatorSales />
      </MemoryRouter>,
    );

  const tab = (name: RegExp) => screen.getByRole("button", { name });

  it("totals each number on its tab, and picks one to draw", () => {
    mocks.chart = chart;

    renderChart();

    expect(tab(/Total earnings/)).toHaveTextContent("$195.00");
    expect(tab(/Total earnings/)).toHaveAttribute("aria-pressed", "true");
    expect(tab(/Total sales/)).toHaveTextContent("$300.00");

    fireEvent.click(tab(/Total sales/));

    expect(tab(/Total sales/)).toHaveAttribute("aria-pressed", "true");
    expect(tab(/Total earnings/)).toHaveAttribute("aria-pressed", "false");
  });

  it("asks for the period that's chosen", () => {
    mocks.chart = chart;

    renderChart();

    expect(mocks.chartDays.at(-1)).toBe(28);

    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "365" } });

    expect(mocks.chartDays.at(-1)).toBe(365);
  });

  it("shows one currency at a time, because they can't be added", () => {
    mocks.chart = {
      ...chart,
      rows: [...chart.rows, { ...row, currency: "usd", earned_cents: 7000 }],
    };

    renderChart();

    expect(tab(/Total earnings/)).toHaveTextContent("$195.00");

    fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "usd" } });

    expect(tab(/Total earnings/)).toHaveTextContent("US$70.00");
  });

  it("hides the currency choice when there's only one", () => {
    mocks.chart = chart;

    renderChart();

    expect(screen.queryByLabelText("Currency")).not.toBeInTheDocument();
  });

  it("reads out a day from the keyboard, with its count", () => {
    mocks.chart = chart;

    renderChart();

    fireEvent.click(tab(/Total sales/));

    const plot = screen.getByRole("group", { name: "Total sales" });

    fireEvent.keyDown(plot, { key: "ArrowLeft" });

    const status = screen.getByRole("status");

    expect(status).toHaveTextContent("$300.00");
    expect(status).toHaveTextContent("Completed: 1");
  });

  it("gives every number as a table too", () => {
    mocks.chart = chart;

    renderChart();

    expect(screen.getByText("Show as a table")).toBeInTheDocument();
    expect(within(screen.getAllByRole("table", { hidden: true })[0]).getAllByRole("row", { hidden: true })).toHaveLength(3);
  });

  it("says so when there's nothing in the period", () => {
    mocks.chart = { ...chart, rows: [] };

    renderChart();

    expect(screen.getByText("No sales or transactions in this period.")).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});

describe("<AdminSales />", () => {
  const summary: AdminSalesSummary = {
    totals: [
      {
        currency: "cad",
        sales: 1,
        sold_cents: 21000,
        transactions: 2,
        paid_cents: 14000,
        refunded_cents: 0,
        kept_cents: 2000,
        tax_cents: 163,
        earned_cents: 1837,
      },
    ],
    tax: [
      { place: "CA-ON", bps: 1300, currency: "cad", fees_cents: 1000, tax_cents: 115 },
      { place: "CA-AB", bps: 500, currency: "cad", fees_cents: 1000, tax_cents: 48 },
    ],
  };

  it("shows totals, and the tax to set aside for each place with a total", () => {
    mocks.adminSummary = summary;

    render(
      <MemoryRouter>
        <AdminSales />
      </MemoryRouter>,
    );

    expect(screen.getByText("Total earnings").nextSibling).toHaveTextContent("$18.37");
    expect(screen.getByText("Total sales").nextSibling).toHaveTextContent("$210.00");
    expect(screen.getByText("1 completed")).toBeInTheDocument();
    expect(screen.getByText("Transactions").nextSibling).toHaveTextContent("$140.00");
    expect(screen.getByText("2 payments, $0.00 refunded")).toBeInTheDocument();

    const ontario = screen.getByRole("row", { name: /Ontario/ });

    expect(within(ontario).getByText("13%")).toBeInTheDocument();
    expect(within(ontario).getByText("$1.15")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Total in CAD/ })).getByText("$1.63")).toBeInTheDocument();
  });

  it("charts the whole site's earnings and tax", () => {
    const row: AdminChartRow = {
      period: "2026-11-01",
      currency: "cad",
      sales: 1,
      sold_cents: 21000,
      transactions: 2,
      paid_cents: 14000,
      kept_cents: 2000,
      tax_cents: 163,
      earned_cents: 1837,
    };

    mocks.chart = { unit: "month", periods: ["2026-10-01", "2026-11-01"], rows: [row] };

    render(
      <MemoryRouter>
        <AdminSales />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: /Tax to set aside/ })).toHaveTextContent("$1.63");
    expect(screen.getByRole("button", { name: /Total earnings/ })).toHaveTextContent("$18.37");
    expect(screen.getByRole("option", { name: "Last 12 months" })).toBeInTheDocument();
  });

  it("shows a milestone project as one sale", () => {
    mocks.adminSaleRows = [
      {
        listing_request_id: "r1",
        completed_at: "2026-11-02T12:00:00+00:00",
        title: "Milestone project",
        creator_handle: "ada",
        currency: "cad",
        transactions: 3,
        sold_cents: 31500,
        kept_cents: 3000,
      },
    ];

    render(
      <MemoryRouter>
        <AdminSales />
      </MemoryRouter>,
    );

    const row = screen.getByRole("row", { name: /Milestone project/ });

    expect(within(row).getByText("@ada")).toBeInTheDocument();
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByText("$315.00")).toBeInTheDocument();
  });

  it("warns when a sale's location is unknown", () => {
    mocks.adminSummary = {
      ...summary,
      tax: [{ place: "?", bps: 500, currency: "cad", fees_cents: 1000, tax_cents: 48 }],
    };

    render(
      <MemoryRouter>
        <AdminSales />
      </MemoryRouter>,
    );

    expect(screen.getByText(/TAX-009/)).toBeInTheDocument();
  });
});

describe("<PaymentInvoice />", () => {
  it("shows the seller's tax number and the GST/HST inside the fees", () => {
    renderInvoice();

    expect(screen.getByText("Ada's Art Ltd")).toBeInTheDocument();
    expect(screen.getByText("Tax number: 123456789 RT0001")).toBeInTheDocument();
    expect(screen.getByText("Includes GST/HST at 13%")).toBeInTheDocument();
    expect(screen.getByText("$0.81")).toBeInTheDocument();
    expect(screen.getByText("$112.00")).toBeInTheDocument();
  });

  it("leaves off a tax number the creator didn't choose to show", () => {
    mocks.invoice = { ...invoice, seller_tax_number: null };

    renderInvoice();

    expect(screen.queryByText(/Tax number/)).not.toBeInTheDocument();
  });

  it("shows a creator their own fee and no rate for the buyer", () => {
    mocks.invoice = {
      ...invoice,
      buyer_tax_bps: null,
      buyer_fee_tax_cents: null,
      creator_fee_cents: 500,
      creator_tax_bps: 500,
      creator_fee_tax_cents: 24,
    };

    renderInvoice();

    expect(screen.getByText("Creator platform fee")).toBeInTheDocument();
    expect(screen.getByText("Includes GST/HST at 5%")).toBeInTheDocument();
    expect(screen.queryByText("Includes GST/HST at 13%")).not.toBeInTheDocument();
  });

  it("says so when the invoice can't be found", () => {
    mocks.invoice = null;
    mocks.invoiceError = new Error("That invoice could not be found.");

    renderInvoice();

    expect(screen.getByText("That invoice could not be found.")).toBeInTheDocument();
  });
});
