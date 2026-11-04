import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  active: [] as unknown[],
  counts: { newRequests: 0, inProgress: 0, completed: 0, liveListings: 0, draftListings: 0 },
  unread: 0,
  paymentAccount: { payouts_enabled: true } as { payouts_enabled: boolean } | null,
  requestedPageSize: 0,
  sales: [] as unknown[],
  salesMonths: [] as string[],
}));

vi.mock("../../hooks/creatorRequests/useMyCreatorRequests", () => ({
  useMyCreatorRequests: ({ pageSize }: { pageSize: number }) => {
    mocks.requestedPageSize = pageSize;

    return { data: { items: mocks.active, totalCount: mocks.active.length }, isLoading: false };
  },
}));

vi.mock("../../hooks/creatorRequests/useCreatorDashboardCounts", () => ({
  useCreatorDashboardCounts: () => ({ data: mocks.counts }),
}));

// The same one-number read as the top bar: never the inbox itself.
vi.mock("../../hooks/conversations/useUnreadMessageCount", () => ({
  useUnreadMessageCount: () => ({ data: mocks.unread }),
}));

vi.mock("../../hooks/payments/useSales", () => ({
  useMySalesSummary: (month: string) => {
    mocks.salesMonths.push(month);

    return { data: mocks.sales, isLoading: false };
  },
  useMySalesChart: () => ({ data: { unit: "day", periods: [], rows: [] }, error: null, isPlaceholderData: false }),
}));

vi.mock("../../hooks/payments/useCreatorPaymentAccount", () => ({
  useCreatorPaymentAccount: () => ({ data: mocks.paymentAccount, isLoading: false }),
  getCreatorPaymentAccountIsReady: (account: { payouts_enabled?: boolean } | null) =>
    Boolean(account?.payouts_enabled),
}));

import CreatorDashboard from "../creator/CreatorDashboard";
import { currentSalesMonth } from "../../domain/payments/sales";

const commission = (id: string, status: string, hasUnread = false) => ({
  request: {
    id,
    status,
    request_title: `Commission ${id}`,
    listing_snapshot: { title: "Emote Pack" },
  },
  buyer: { handle: "buyer", display_name: "Buyer" },
  conversation: { has_unread: hasUnread },
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <CreatorDashboard />
    </MemoryRouter>,
  );

const stat = (label: string) => screen.getByText(label).closest("a") as HTMLElement;

describe("<CreatorDashboard />", () => {
  beforeEach(() => {
    mocks.active = [];
    mocks.counts = { newRequests: 0, inProgress: 0, completed: 0, liveListings: 0, draftListings: 0 };
    mocks.unread = 0;
    mocks.paymentAccount = { payouts_enabled: true };
  });

  it("shows the counts the database worked out, and downloads only the few commissions it lists", () => {
    mocks.active = [commission("a", "submitted"), commission("b", "accepted", true)];
    mocks.counts = { newRequests: 61, inProgress: 240, completed: 1200, liveListings: 7, draftListings: 1 };
    mocks.unread = 3;

    renderPage();

    expect(stat("New requests")).toHaveTextContent("61");
    expect(stat("In progress")).toHaveTextContent("240");
    expect(stat("In progress")).toHaveTextContent("1200 completed so far");
    expect(stat("Unread messages")).toHaveTextContent("3");
    expect(stat("Unread messages")).toHaveAttribute("href", "/messages");
    expect(stat("Live listings")).toHaveTextContent("7");
    expect(stat("Live listings")).toHaveTextContent("1 draft");

    // However many commissions there are, five rows are asked for.
    expect(mocks.requestedPageSize).toBe(5);

    const latest = within(screen.getByRole("region", { name: "Active commissions" }));
    expect(latest.getAllByRole("listitem")).toHaveLength(2);
    expect(latest.getByText("New message")).toBeInTheDocument();
    expect(latest.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/creator/requests");
  });

  it("lists what needs the creator: payouts, new requests, then unread messages", () => {
    mocks.paymentAccount = null;
    mocks.counts = { ...mocks.counts, newRequests: 2 };
    mocks.unread = 1;

    renderPage();

    const attention = within(screen.getByRole("region", { name: "Needs your attention" }));

    expect(attention.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/settings/profile",
      "/creator/requests",
      "/messages",
    ]);
    expect(attention.getByText("Finish payout setup")).toBeInTheDocument();
    expect(attention.getByText("2 new commission requests")).toBeInTheDocument();
    expect(attention.getByText("1 unread message")).toBeInTheDocument();
  });

  it("links only to creator pages the top bar does not have", () => {
    renderPage();

    const pages = within(screen.getByRole("navigation", { name: "Creator pages" }));

    expect(pages.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/creator/listings",
      "/creator/requests",
      "/creator/earnings",
      "/apply/creator",
      "/guide/creators",
    ]);
  });

  it("totals this month beside the chart, with no month to choose", () => {
    mocks.salesMonths = [];

    renderPage();

    expect(screen.getByRole("heading", { name: "This month's sales" })).toBeInTheDocument();
    expect(screen.queryByText("Month")).not.toBeInTheDocument();
    expect(new Set(mocks.salesMonths)).toEqual(new Set([currentSalesMonth()]));
  });

  it("keeps the same two month cards, and sends other currencies to Earnings", () => {
    mocks.sales = [];

    const { unmount } = renderPage();
    const month = () => within(screen.getByRole("region", { name: "This month's sales" }));

    expect(month().getByText("Total earnings").nextSibling).toHaveTextContent("–");
    expect(month().getByText("No sales this month.")).toBeInTheDocument();

    unmount();
    mocks.sales = [
      { currency: "cad", earned_cents: 200000, sales: 1, commissions: 1, downloads: 0 },
      { currency: "usd", earned_cents: 5000, sales: 1, commissions: 1, downloads: 0 },
    ];
    renderPage();

    expect(month().getAllByText("Total earnings")).toHaveLength(1);
    expect(month().getByText("$2,000.00")).toBeInTheDocument();
    expect(month().getByRole("link", { name: /1 other currency/ })).toHaveAttribute("href", "/creator/earnings");
    mocks.sales = [];
  });

  it("says so when nothing is waiting and nothing is active", () => {
    renderPage();

    expect(screen.getByText("Nothing is waiting on you.")).toBeInTheDocument();
    expect(screen.getByText(/No active commissions/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create listing" })).toHaveAttribute(
      "href",
      "/creator/listings/new",
    );
  });
});
