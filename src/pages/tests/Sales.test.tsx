import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AdminSalesSummary,
  CreatorSaleRow,
  CreatorSalesTotals,
  PaymentInvoice as Invoice,
} from "../../domain/payments/sales";

const mocks = vi.hoisted(() => ({
  months: [] as string[],
  totals: [] as unknown[],
  rows: [] as unknown[],
  adminRows: [] as unknown[],
  adminSummary: { totals: [], tax: [] } as unknown,
  invoice: null as unknown,
  invoiceError: null as unknown,
}));

vi.mock("../../hooks/payments/useSales", () => ({
  useMySalesSummary: (month: string) => {
    mocks.months.push(month);

    return { data: mocks.totals, isLoading: false };
  },
  useMySales: () => ({ data: { pages: [{ rows: mocks.rows }] }, hasNextPage: false }),
  useAdminSalesSummary: () => ({ data: mocks.adminSummary, isLoading: false }),
  useAdminSales: () => ({ data: { pages: [{ rows: mocks.adminRows }] }, hasNextPage: false }),
  usePaymentInvoice: () => ({ data: mocks.invoice, error: mocks.invoiceError, isLoading: false }),
}));

import AdminSales from "../admin/AdminSales";
import CreatorSales from "../creator/CreatorSales";
import PaymentInvoice from "../payments/PaymentInvoice";

const totals: CreatorSalesTotals = {
  currency: "cad",
  sales: 3,
  sold_cents: 20000,
  refunded_cents: 5000,
  fee_cents: 1000,
  fee_tax_cents: 48,
  earned_cents: 19000,
};

const sale: CreatorSaleRow = {
  movement_id: "m1",
  payment_id: "p1",
  listing_request_id: "r1",
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
  mocks.rows = [];
  mocks.adminRows = [];
  mocks.adminSummary = { totals: [], tax: [] };
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

    expect(screen.getByText("Total sales").nextSibling).toHaveTextContent("$200.00");
    expect(screen.getByText("Total earnings").nextSibling).toHaveTextContent("$190.00");
    expect(screen.getByText("Fees to Made for Stream").nextSibling).toHaveTextContent("$10.00");
    expect(screen.getByText("After $50.00 in refunds")).toBeInTheDocument();
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

  it("lists each sale with its invoice, and marks a refund", () => {
    mocks.rows = [
      sale,
      { ...sale, movement_id: "m2", kind: "refund", sold_cents: -10000, fee_cents: -500, earned_cents: -9500 },
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

describe("<AdminSales />", () => {
  const summary: AdminSalesSummary = {
    totals: [
      {
        currency: "cad",
        sales: 2,
        sold_cents: 21000,
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

    const ontario = screen.getByRole("row", { name: /Ontario/ });

    expect(within(ontario).getByText("13%")).toBeInTheDocument();
    expect(within(ontario).getByText("$1.15")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /Total in CAD/ })).getByText("$1.63")).toBeInTheDocument();
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
