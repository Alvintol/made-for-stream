import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  chartPresetRange,
  formatSalesMonth,
  type AdminChartRow,
  type AdminSalesSummary,
  type CreatorChartRow,
  type CreatorSaleRow,
  type CreatorSalesTotals,
  type CreatorTaxSummary,
  type CreatorTransactionRow,
  type PaymentInvoice as Invoice,
  type SalesChartData,
  type SalesChartQuery,
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
  chartQueries: [] as unknown[],
  invoice: null as unknown,
  invoiceError: null as unknown,
  tax: null as unknown,
  taxYears: [] as number[],
}));

vi.mock("../../hooks/payments/useSales", () => ({
  useMySalesSummary: (month: string) => {
    mocks.months.push(month);

    return { data: mocks.totals, isLoading: false };
  },
  useMyCompletedSales: () => ({ data: { pages: [{ rows: mocks.saleRows }] }, hasNextPage: false }),
  useMyTaxSummary: (year: number) => {
    mocks.taxYears.push(year);

    return { data: mocks.tax, error: null, isLoading: false };
  },
  useMyTransactions: () => ({ data: { pages: [{ rows: mocks.rows }] }, hasNextPage: false }),
  useMySalesChart: (query: unknown) => {
    mocks.chartQueries.push(query);

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

import AdminSalesChart from "../../components/sales/AdminSalesChart";
import CreatorEarningsChart from "../../components/sales/CreatorEarningsChart";
import AdminSales from "../admin/AdminSales";
import CreatorSales from "../creator/CreatorSales";
import PaymentInvoice from "../payments/PaymentInvoice";

const totals: CreatorSalesTotals = {
  currency: "cad",
  sales: 3,
  commissions: 2,
  downloads: 1,
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

const taxSummary: CreatorTaxSummary = {
  creator_country: "CA",
  totals: [
    { currency: "cad", payments: 6, sold_cents: 219300, fee_cents: 10450, fee_tax_cents: 498, earned_cents: 208850 },
  ],
  regions: [
    {
      country: "CA",
      region: "AB",
      currency: "cad",
      payments: 4,
      sold_cents: 200000,
      earned_cents: 190000,
      commission_sold_cents: 150000,
      bps: 500,
      tax_cents: 7500,
    },
    {
      country: "US",
      region: "WA",
      currency: "cad",
      payments: 1,
      sold_cents: 12000,
      earned_cents: 11400,
      commission_sold_cents: 12000,
      bps: null,
      tax_cents: null,
    },
    {
      country: "-",
      region: "",
      currency: "cad",
      payments: 1,
      sold_cents: 7300,
      earned_cents: 7000,
      commission_sold_cents: 7300,
      bps: null,
      tax_cents: null,
    },
  ],
  small_supplier: { from: "2026-01-01", sold_cents: 219300 },
};

const emptyTax: CreatorTaxSummary = {
  creator_country: "CA",
  totals: [],
  regions: [],
  small_supplier: { from: "2026-01-01", sold_cents: 0 },
};

const renderInvoice = () =>
  render(
    <MemoryRouter initialEntries={["/payments/invoice/p1"]}>
      <Routes>
        <Route path="/payments/invoice/:paymentId" element={<PaymentInvoice />} />
      </Routes>
    </MemoryRouter>,
  );

const renderPage = (page: ReactElement) => render(<MemoryRouter>{page}</MemoryRouter>);

const lastQuery = () => mocks.chartQueries.at(-1) as SalesChartQuery;

beforeEach(() => {
  mocks.months = [];
  mocks.totals = [];
  mocks.saleRows = [];
  mocks.rows = [];
  mocks.adminRows = [];
  mocks.adminSaleRows = [];
  mocks.adminSummary = { totals: [], tax: [] };
  mocks.chart = { unit: "day", periods: [], rows: [] };
  mocks.chartQueries = [];
  mocks.invoice = invoice;
  mocks.invoiceError = null;
  mocks.tax = emptyTax;
  mocks.taxYears = [];
});

describe("<CreatorSales />", () => {
  it("shows only the month's earnings and how many were completed", () => {
    mocks.totals = [totals];

    renderPage(<CreatorSales />);

    expect(screen.getByText("Total earnings").nextSibling).toHaveTextContent("$190.00");
    expect(screen.getByText("Completed").nextSibling).toHaveTextContent("3");
    expect(screen.getByText("Commissions: 2 · Downloads: 1")).toBeInTheDocument();
    expect(screen.queryByText("Fees to Made for Stream")).not.toBeInTheDocument();
    expect(screen.queryByText("Total sales")).not.toBeInTheDocument();
  });

  it("gives each currency its own row, because they can't be added", () => {
    mocks.totals = [totals, { ...totals, currency: "usd" }];

    renderPage(<CreatorSales />);

    expect(screen.getAllByText("Total earnings")).toHaveLength(2);
    expect(screen.getByText("US$190.00")).toBeInTheDocument();
  });

  it("shows a milestone project as one sale, with its fee", () => {
    mocks.saleRows = [completedSale];

    renderPage(<CreatorSales />);

    const row = screen.getByRole("row", { name: /Milestone project/ });

    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByText("$300.00")).toBeInTheDocument();
    expect(within(row).getByText("$15.00")).toBeInTheDocument();
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

    renderPage(<CreatorSales />);

    expect(screen.getByText("Refund")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Invoice" })[0]).toHaveAttribute(
      "href",
      "/payments/invoice/p1",
    );
  });

  it("picks a month from a calendar, and can't pick one that hasn't happened", () => {
    renderPage(<CreatorSales />);

    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);

    fireEvent.click(screen.getByRole("button", { name: formatSalesMonth(thisMonth) }));

    expect(screen.getByRole("button", { name: "Next year" })).toBeDisabled();

    if (now.getUTCMonth() < 11) {
      const next = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 2).padStart(2, "0")}`;

      expect(screen.getByRole("button", { name: formatSalesMonth(next) })).toBeDisabled();
    }

    fireEvent.click(screen.getByRole("button", { name: "Previous year" }));

    const january = `${now.getUTCFullYear() - 1}-01`;

    fireEvent.click(screen.getByRole("button", { name: formatSalesMonth(january) }));

    expect(mocks.months.at(-1)).toBe(january);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("tax help", () => {
  const taxHelp = () => within(screen.getByRole("region", { name: "Tax help" }));

  it("shows the year's earnings and fees, with the GST/HST in the fees", () => {
    mocks.tax = taxSummary;

    renderPage(<CreatorSales />);

    expect(taxHelp().getByText("Total earnings").nextSibling).toHaveTextContent("$2,088.50");
    expect(taxHelp().getByText("Fees to Made for Stream").nextSibling).toHaveTextContent("$104.50");
    expect(taxHelp().getByText(/Includes \$4\.98 GST\/HST/)).toBeInTheDocument();
    expect(taxHelp().getByText(/isn't tax advice/)).toBeInTheDocument();
  });

  it("reads an earlier year", () => {
    renderPage(<CreatorSales />);

    const thisYear = new Date().getUTCFullYear();

    expect(mocks.taxYears.at(-1)).toBe(thisYear);

    fireEvent.change(taxHelp().getByLabelText("Year"), { target: { value: String(thisYear - 1) } });

    expect(mocks.taxYears.at(-1)).toBe(thisYear - 1);
    expect(taxHelp().getByRole("link", { name: "Yearly statement" })).toHaveAttribute(
      "href",
      `/creator/earnings/statement/${thisYear - 1}`,
    );
  });

  it("tracks a creator in Canada against the $30,000 limit, and warns past it", () => {
    mocks.tax = taxSummary;

    const { unmount } = renderPage(<CreatorSales />);

    expect(taxHelp().getByText("$2,193.00 of $30,000.00")).toBeInTheDocument();
    expect(taxHelp().getByText(/since January 2026/)).toBeInTheDocument();
    expect(taxHelp().queryByText(/have passed \$30,000/)).not.toBeInTheDocument();

    unmount();
    mocks.tax = { ...taxSummary, small_supplier: { from: "2026-01-01", sold_cents: 3_000_000 } };
    renderPage(<CreatorSales />);

    expect(taxHelp().getByText(/have passed \$30,000/)).toBeInTheDocument();
  });

  it("adds up sales by the buyer's region, with the GST/HST rate in Canada", () => {
    mocks.tax = taxSummary;

    renderPage(<CreatorSales />);

    const alberta = taxHelp().getByRole("row", { name: /Alberta/ });

    expect(within(alberta).getByText("5%")).toBeInTheDocument();
    expect(within(alberta).getByText("$75.00")).toBeInTheDocument();
    expect(within(taxHelp().getByRole("row", { name: /WA, United States/ })).getAllByText("—")).toHaveLength(2);
    expect(taxHelp().getByRole("row", { name: /Not shared/ })).toBeInTheDocument();
  });

  it("leaves out the GST/HST limit and rates for a creator outside Canada", () => {
    mocks.tax = { ...taxSummary, creator_country: "US" };

    renderPage(<CreatorSales />);

    expect(taxHelp().queryByText("GST/HST small supplier limit")).not.toBeInTheDocument();
    expect(taxHelp().queryByText("GST/HST rate")).not.toBeInTheDocument();
    expect(taxHelp().getByRole("row", { name: /Alberta/ })).toBeInTheDocument();
  });
});

describe("the earnings graph", () => {
  const row: CreatorChartRow = {
    period: "2026-11-01",
    currency: "cad",
    sales: 2,
    instant_sales: 1,
    sold_cents: 30000,
    transactions: 2,
    paid_cents: 20000,
    fee_cents: 1000,
    earned_cents: 19000,
  };

  const chart: SalesChartData<CreatorChartRow> = {
    unit: "day",
    periods: ["2026-10-31", "2026-11-01", "2026-11-02"],
    rows: [row, { ...row, period: "2026-11-02", sales: 0, instant_sales: 0, earned_cents: 500 }],
  };

  const tab = (name: RegExp) => screen.getByRole("button", { name });

  it("shows earnings and completed sales, and no fee total", () => {
    mocks.chart = chart;

    renderPage(<CreatorEarningsChart />);

    expect(tab(/Total earnings/)).toHaveTextContent("$195.00");
    expect(tab(/Completed/)).toHaveTextContent("2");
    expect(screen.queryByRole("button", { name: /Fees/ })).not.toBeInTheDocument();

    fireEvent.click(tab(/Completed/));

    expect(tab(/Completed/)).toHaveAttribute("aria-pressed", "true");
  });

  it("starts on the last 28 days of everything", () => {
    renderPage(<CreatorEarningsChart />);

    expect(lastQuery()).toEqual({ ...chartPresetRange("28", new Date()), kind: "all" });
  });

  it("separates commissions from instant downloads", () => {
    renderPage(<CreatorEarningsChart />);

    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "instant" } });

    expect(lastQuery().kind).toBe("instant");
  });

  it("reads a whole year by month", () => {
    renderPage(<CreatorEarningsChart />);

    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "year" } });

    const year = new Date().getUTCFullYear();

    expect(lastQuery()).toMatchObject({ from: `${year}-01-01`, to: `${year}-12-31` });

    fireEvent.change(screen.getByLabelText("Year"), { target: { value: String(year - 1) } });

    expect(lastQuery()).toMatchObject({ from: `${year - 1}-01-01`, to: `${year - 1}-12-31` });
  });

  it("reads exact dates, and refuses an end before the start", () => {
    renderPage(<CreatorEarningsChart />);

    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-10" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-01" } });

    expect(screen.getByText("Choose a start date on or before the end date.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Show" }));

    expect(lastQuery()).toEqual({ from: "2026-10-10", to: "2026-10-20", kind: "all" });
  });

  it("draws months as bars, with each month named", () => {
    mocks.chart = { unit: "month", periods: ["2026-10-01", "2026-11-01"], rows: [{ ...row, period: "2026-11-01" }] };

    renderPage(<CreatorEarningsChart />);

    expect(screen.getByText("Oct")).toBeInTheDocument();
    expect(screen.getByText("Nov")).toBeInTheDocument();
  });

  it("reads out a day from the keyboard, with commissions and downloads", () => {
    mocks.chart = chart;

    renderPage(<CreatorEarningsChart />);

    fireEvent.click(tab(/Completed/));
    fireEvent.keyDown(screen.getByRole("group", { name: "Completed" }), { key: "ArrowLeft" });

    const status = screen.getByRole("status");

    expect(status).toHaveTextContent("2");
    expect(status).toHaveTextContent("Commissions: 1 · Downloads: 1");
  });

  it("shows one currency at a time, because they can't be added", () => {
    mocks.chart = { ...chart, rows: [...chart.rows, { ...row, currency: "usd", earned_cents: 7000 }] };

    renderPage(<CreatorEarningsChart />);

    fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "usd" } });

    expect(tab(/Total earnings/)).toHaveTextContent("US$70.00");
  });

  it("gives every number as a table too, and says when there's nothing", () => {
    mocks.chart = chart;

    const { unmount } = renderPage(<CreatorEarningsChart />);

    expect(
      within(screen.getAllByRole("table", { hidden: true })[0]).getAllByRole("row", { hidden: true }),
    ).toHaveLength(3);

    unmount();
    mocks.chart = { ...chart, rows: [] };
    renderPage(<CreatorEarningsChart />);

    expect(screen.getByText("No sales or transactions in this period.")).toBeInTheDocument();
  });
});

describe("<AdminSales />", () => {
  const summary: AdminSalesSummary = {
    totals: [
      {
        currency: "cad",
        sales: 1,
        commissions: 1,
        downloads: 0,
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
    regions: [
      { country: "US", region: "WA", currency: "cad", payments: 2, paid_cents: 14000, tax_cents: 0 },
      { country: "CA", region: "ON", currency: "cad", payments: 1, paid_cents: 5000, tax_cents: 58 },
    ],
  };

  it("shows totals, and the tax to set aside for each place with a total", () => {
    mocks.adminSummary = summary;

    renderPage(<AdminSales />);

    expect(screen.getByText("Total earnings").nextSibling).toHaveTextContent("$18.37");
    expect(screen.getByText("Total sales").nextSibling).toHaveTextContent("$210.00");
    expect(screen.getByText("1 commissions · 0 downloads")).toBeInTheDocument();

    const ontario = screen.getAllByRole("row", { name: /Ontario/ })[0];

    expect(within(ontario).getByText("13%")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Total in CAD/ })).getByText("$1.63")).toBeInTheDocument();
  });

  it("adds up sales by the buyer's state or province", () => {
    mocks.adminSummary = summary;

    renderPage(<AdminSales />);

    const washington = screen.getByRole("row", { name: /WA, United States/ });

    expect(within(washington).getByText("2")).toBeInTheDocument();
    expect(within(washington).getByText("$140.00")).toBeInTheDocument();
    expect(screen.getAllByRole("row", { name: /Ontario/ })).toHaveLength(2);
  });

  it("has no graph: it's on the dashboard", () => {
    renderPage(<AdminSales />);

    expect(screen.queryByText("Over time")).not.toBeInTheDocument();
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

    renderPage(<AdminSales />);

    const row = screen.getByRole("row", { name: /Milestone project/ });

    expect(within(row).getByText("@ada")).toBeInTheDocument();
    expect(within(row).getByText("$315.00")).toBeInTheDocument();
  });

  it("warns when a sale's location is unknown", () => {
    mocks.adminSummary = {
      ...summary,
      tax: [{ place: "?", bps: 500, currency: "cad", fees_cents: 1000, tax_cents: 48 }],
    };

    renderPage(<AdminSales />);

    expect(screen.getByText(/TAX-009/)).toBeInTheDocument();
  });
});

describe("<AdminSalesChart />", () => {
  it("charts the whole site's earnings and tax", () => {
    const row: AdminChartRow = {
      period: "2026-11-01",
      currency: "cad",
      sales: 1,
      instant_sales: 0,
      sold_cents: 21000,
      transactions: 2,
      paid_cents: 14000,
      kept_cents: 2000,
      tax_cents: 163,
      earned_cents: 1837,
    };

    mocks.chart = { unit: "month", periods: ["2026-10-01", "2026-11-01"], rows: [row] };

    renderPage(<AdminSalesChart />);

    expect(screen.getByRole("button", { name: /Tax to set aside/ })).toHaveTextContent("$1.63");
    expect(screen.getByRole("button", { name: /Total earnings/ })).toHaveTextContent("$18.37");
    expect(screen.getByRole("option", { name: "Instant downloads" })).toBeInTheDocument();
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
