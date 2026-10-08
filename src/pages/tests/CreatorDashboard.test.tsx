import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  active: [] as unknown[],
  counts: { newRequests: 0, inProgress: 0, completed: 0, liveListings: 0, draftListings: 0 },
  unread: 0,
  paymentAccount: { payouts_enabled: true } as { payouts_enabled: boolean } | null,
  requestedPageSize: 0,
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

vi.mock("../../hooks/conversations/useMessagesInbox", () => ({
  useMessagesInbox: () => ({ data: { items: [], totalUnreadCount: mocks.unread } }),
}));

vi.mock("../../hooks/payments/useCreatorPaymentAccount", () => ({
  useCreatorPaymentAccount: () => ({ data: mocks.paymentAccount, isLoading: false }),
  getCreatorPaymentAccountIsReady: (account: { payouts_enabled?: boolean } | null) =>
    Boolean(account?.payouts_enabled),
}));

import CreatorDashboard from "../creator/CreatorDashboard";

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
