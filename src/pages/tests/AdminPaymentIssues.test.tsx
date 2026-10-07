import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminPaymentIssues from "../admin/AdminPaymentIssues";

const mocks = vi.hoisted(() => ({
  useAdminPaymentIssues: vi.fn(),
}));

vi.mock("../../hooks/admin/useAdminPaymentIssues", () => ({
  useAdminPaymentIssues: mocks.useAdminPaymentIssues,
}));

const createIssueItem = (overrides = {}) => ({
  payment: {
    id: "payment-1",
    listing_request_id: "request-1",
    payment_type: "milestone_payment",
    status: "paid",
    currency: "cad",
    base_amount_cents: 5000,
    total_checkout_cents: 5250,
    payer_user_id: "buyer-1",
    creator_user_id: "creator-1",
    stripe_charge_id: "ch_test123",
    stripe_refund_id: "re_test123",
    stripe_dispute_id: null,
    refunded_at: "2026-09-20T12:00:00.000Z",
    disputed_at: null,
    created_at: "2026-09-01T12:00:00.000Z",
    updated_at: "2026-09-20T12:00:00.000Z",
    ...overrides,
  },
  request: {
    id: "request-1",
    request_title: "Custom cozy emote pack",
    listing_snapshot: { title: "Custom Emote Pack" },
  },
  buyer: { user_id: "buyer-1", handle: "buyeruser", display_name: "Buyer User" },
  creator: { user_id: "creator-1", handle: "creatoruser", display_name: "Creator User" },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminPaymentIssues />
    </MemoryRouter>
  );

describe("<AdminPaymentIssues />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAdminPaymentIssues.mockReturnValue({
      data: {
        items: [createIssueItem()],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        pageCount: 1,
      },
      isLoading: false,
      error: null,
    });
  });

  it("shows a refunded payment with the still-paid status called out", () => {
    renderPage();

    const card = screen
      .getByRole("heading", { name: "Custom cozy emote pack" })
      .closest(".card") as HTMLElement;

    expect(card).not.toBeNull();

    expect(within(card).getByText("Buyer: @buyeruser")).toBeInTheDocument();
    expect(within(card).getByText("Creator: @creatoruser")).toBeInTheDocument();
    expect(within(card).getByText("Refunded")).toBeInTheDocument();
    expect(within(card).queryByText("Disputed")).not.toBeInTheDocument();

    expect(within(card).getByText(/Status still reads/)).toBeInTheDocument();

    expect(within(card).getByRole("link", { name: "View commission" })).toHaveAttribute(
      "href",
      "/admin/requests/request-1"
    );
  });

  it("shows a disputed payment and does not flag divergence once status is no longer paid", () => {
    mocks.useAdminPaymentIssues.mockReturnValue({
      data: {
        items: [
          createIssueItem({
            status: "disputed",
            stripe_refund_id: null,
            stripe_dispute_id: "dp_test123",
            refunded_at: null,
            disputed_at: "2026-09-21T09:00:00.000Z",
          }),
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        pageCount: 1,
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    const card = screen
      .getByRole("heading", { name: "Custom cozy emote pack" })
      .closest(".card") as HTMLElement;

    expect(within(card).getByText("Disputed")).toBeInTheDocument();
    expect(within(card).queryByText("Refunded")).not.toBeInTheDocument();
    expect(within(card).queryByText(/Status still reads/)).not.toBeInTheDocument();
  });

  it("shows a commission-not-found fallback when the joined commission is missing", () => {
    mocks.useAdminPaymentIssues.mockReturnValue({
      data: {
        items: [{ ...createIssueItem(), request: null }],
        totalCount: 1,
        page: 1,
        pageSize: 20,
        pageCount: 1,
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Commission not found")).toBeInTheDocument();
  });

  it("renders the empty state when nothing matches", () => {
    mocks.useAdminPaymentIssues.mockReturnValue({
      data: { items: [], totalCount: 0, page: 1, pageSize: 20, pageCount: 0 },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText("No refunded or disputed payments matched the current filter.")
    ).toBeInTheDocument();
  });

  it("renders an error state", () => {
    mocks.useAdminPaymentIssues.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("failed"),
    });

    renderPage();

    expect(
      screen.getByText("Payment issues could not be loaded right now.")
    ).toBeInTheDocument();
  });
});
