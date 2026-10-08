import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RequestListing from "../listings/RequestListing";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  usePublicListing: vi.fn(),
  createRequest: vi.fn(),
  useActiveListingRequestForListing: vi.fn(),
  feeRate: { feeBps: 500, reason: "standard" },
  display: { displayCurrency: null, rates: null } as {
    displayCurrency: string | null;
    rates: { base: "eur"; date: string; rates: Record<string, number> } | null;
  },
}));

// Prices are shown in the creator's own currency in these tests; the
// conversion has its own tests (ListingPriceText, displayCurrency).
vi.mock("../../hooks/money/useDisplayCurrency", () => ({
  useDisplayCurrency: () => mocks.display,
  useDisplayPreferences: () => ({ data: null, isLoading: false }),
  useSaveDisplayPreferences: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useExchangeRates: () => ({ data: null }),
}));

vi.mock("../../hooks/payments/useBuyerServiceFeeRate", () => ({
  useBuyerServiceFeeRate: () => mocks.feeRate,
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../hooks/listings/usePublicListing", () => ({
  usePublicListing: mocks.usePublicListing,
}));

vi.mock("../../hooks/listings/useCreateListingRequest", () => ({
  useCreateListingRequest: () => ({
    mutateAsync: mocks.createRequest,
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../hooks/listings/useActiveListingRequestForListing", () => ({
  useActiveListingRequestForListing: mocks.useActiveListingRequestForListing,
}));

// Sprint 5: none of this file's scenarios involve a blocked creator.
vi.mock("../../hooks/listings/useCreatorHasOutstandingRecoveryBalance", () => ({
  useCreatorHasOutstandingRecoveryBalance: () => ({ data: false }),
}));

const createListingData = (overrides = {}) => ({
  listing: {
    id: "listing-1",
    user_id: "creator-1",
    title: "Custom Emote Pack",
    short: "A custom emote pack for streamers.",
    offering_type: "commission",
    fulfilment_mode: "request",
    category: "emotes",
    video_subtype: null,
    price_type: "fixed",
    price_min: 50,
    price_max: null,
    deliverables: ["3 emotes", "PNG files"],
    tags: ["emotes"],
    preview_url: null,
    status: "published",
    is_active: true,
    updated_at: "2026-05-09T12:00:00.000Z",
    ...overrides,
  },
  creator: {
    user_id: "creator-1",
    handle: "creatoruser",
    display_name: "Creator User",
    avatar_url: null,
  },
  platformAccounts: [],
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/listing/listing-1/request"]}>
      <Routes>
        <Route path="/listing/:id/request" element={<RequestListing />} />
        <Route path="/requests/:id" element={<div>Commission detail loaded</div>} />
      </Routes>
    </MemoryRouter>
  );

describe("RequestListing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.display = { displayCurrency: null, rates: null };
    mocks.feeRate = { feeBps: 500, reason: "standard" };

    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
    });

    mocks.usePublicListing.mockReturnValue({
      data: createListingData(),
      isLoading: false,
      error: null,
    });

    mocks.createRequest.mockResolvedValue("request-1");

    mocks.useActiveListingRequestForListing.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
  });

  it("shows a sign-in prompt for signed-out users", () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    renderPage();

    expect(
      screen.getByRole("heading", { name: "Sign in to send a commission request" })
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/signin"
    );
  });

  it("blocks listing owners from requesting their own listing", () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: "creator-1",
      },
    });

    renderPage();

    expect(screen.getByRole("heading", { name: "Own listing" })).toBeInTheDocument();
    expect(
      screen.getByText("You cannot send a commission request for your own listing.")
    ).toBeInTheDocument();
  });

  it("renders listing context and the structured commission form", () => {
    renderPage();

    expect(screen.getByText("Custom Emote Pack")).toBeInTheDocument();
    expect(screen.getByText("@creatoruser")).toBeInTheDocument();
    expect(screen.getAllByText("$50 CAD").length).toBeGreaterThan(0);
    expect(screen.getByText("3 emotes")).toBeInTheDocument();

    expect(screen.getByLabelText("Commission title / summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Details")).toBeInTheDocument();
    expect(screen.getByLabelText("Deadline / timeline optional")).toBeInTheDocument();
    expect(screen.getByLabelText("Budget optional")).toBeInTheDocument();
    expect(screen.getByLabelText("References optional")).toBeInTheDocument();
  });

  it("shows an example invoice from the listing price, with the buyer service fee", () => {
    renderPage();

    const invoice = within(screen.getByRole("region", { name: "Estimated invoice" }));

    expect(invoice.getByText("Listing price")).toBeInTheDocument();
    expect(invoice.getByText("Buyer service fee (5%)")).toBeInTheDocument();
    expect(invoice.getByText("$2.50 CAD")).toBeInTheDocument();
    expect(invoice.getByText("$52.50 CAD")).toBeInTheDocument();
    expect(invoice.getByText(/An example, not a quote/)).toBeInTheDocument();
    // The fee is also stated right under the budget box.
    expect(screen.getByText(/A 5% buyer service fee is added on top when you pay/)).toBeInTheDocument();
    expect(invoice.queryByText(/discount/i)).not.toBeInTheDocument();
  });

  it("takes a budget range, and shows the range on every line of the invoice", async () => {
    // 1 EUR = 1.5 CAD = 1 USD here.
    mocks.display = {
      displayCurrency: "usd",
      rates: { base: "eur", date: "2026-10-08", rates: { eur: 1, cad: 1.5, usd: 1 } },
    };

    renderPage();

    fireEvent.change(screen.getByLabelText(/^Budget/), { target: { value: "300 to 600" } });

    const invoice = within(screen.getByRole("region", { name: "Estimated invoice" }));

    expect(invoice.getByText("$300–$600 CAD")).toBeInTheDocument();
    expect(invoice.getByText("$15–$30 CAD")).toBeInTheDocument();
    expect(invoice.getByText("$315–$630 CAD")).toBeInTheDocument();
    expect(invoice.getByText("≈ $210–$420 USD in your currency")).toBeInTheDocument();
    expect(screen.getByText(/≈ \$200–\$400 USD\s+in your currency\./)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Commission title / summary"), {
      target: { value: "Custom cozy emote pack" },
    });
    fireEvent.change(screen.getByLabelText("Details"), {
      target: { value: "I need three cozy emotes for my Twitch channel launch." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send commission request" }));

    await waitFor(() =>
      expect(mocks.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({ budgetAmount: 300, budgetAmountMax: 600 }),
      ),
    );
  });

  it("keeps showing the listing price while the budget is text it cannot read", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/^Budget/), { target: { value: "around 100" } });

    const invoice = within(screen.getByRole("region", { name: "Estimated invoice" }));

    expect(invoice.getByText("Listing price")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send commission request" }));

    expect(screen.getByLabelText("Budget optional")).toHaveAccessibleDescription("Enter an amount such as 100, or a range such as 100-150. Put anything else about your budget in the details.");
    expect(mocks.createRequest).not.toHaveBeenCalled();
  });

  it("puts the estimated invoice above the listing summary", () => {
    renderPage();

    const invoice = screen.getByRole("region", { name: "Estimated invoice" });
    const listingTitle = within(screen.getByRole("complementary", { name: "Listing summary" })).getByText(
      "Custom Emote Pack",
    );

    expect(invoice.compareDocumentPosition(listingTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a subscriber's waived fee as a discount, ready for when subscriptions exist", () => {
    mocks.feeRate = { feeBps: 0, reason: "subscription" };

    renderPage();

    const invoice = within(screen.getByRole("region", { name: "Estimated invoice" }));

    expect(invoice.getByText("Buyer service fee (5%)")).toBeInTheDocument();
    expect(invoice.getByText("Subscriber discount")).toBeInTheDocument();
    expect(invoice.getByText("−$2.50 CAD")).toBeInTheDocument();
    // Listing price 50, fee waived: the total is the price.
    expect(invoice.getAllByText("$50 CAD")).toHaveLength(2);
    expect(screen.getByText(/No buyer service fee is added when you pay\./)).toBeInTheDocument();
  });

  it("shows a reduced rate as a partial discount", () => {
    mocks.feeRate = { feeBps: 250, reason: "promotional" };

    renderPage();

    const invoice = within(screen.getByRole("region", { name: "Estimated invoice" }));

    expect(invoice.getByText("Promotional discount")).toBeInTheDocument();
    expect(invoice.getByText("−$1.25 CAD")).toBeInTheDocument();
    expect(invoice.getByText("$51.25 CAD")).toBeInTheDocument();
  });

  it("follows the budget as it is typed, and estimates it in the buyer's own currency", () => {
    // 1 EUR = 1.5 CAD = 1 USD here, so 300 CAD is 200 USD.
    mocks.display = {
      displayCurrency: "usd",
      rates: { base: "eur", date: "2026-10-08", rates: { eur: 1, cad: 1.5, usd: 1 } },
    };

    renderPage();

    fireEvent.change(screen.getByLabelText(/^Budget/), { target: { value: "300" } });

    const invoice = within(screen.getByRole("region", { name: "Estimated invoice" }));

    expect(invoice.getByText("Your budget")).toBeInTheDocument();
    expect(invoice.getByText("$300 CAD")).toBeInTheDocument();
    expect(invoice.getByText("$15 CAD")).toBeInTheDocument();
    expect(invoice.getByText("$315 CAD")).toBeInTheDocument();
    expect(invoice.getByText("≈ $210 USD in your currency")).toBeInTheDocument();
    expect(screen.getByText(/≈ \$200 USD\s+in your currency\./)).toBeInTheDocument();
  });

  it("submits a normal buyer commission with listing id and snapshot", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Commission title / summary"), {
      target: {
        value: "Custom cozy emote pack",
      },
    });

    fireEvent.change(screen.getByLabelText("Details"), {
      target: {
        value: "I need three cozy emotes for my Twitch channel launch.",
      },
    });

    fireEvent.change(screen.getByLabelText("Deadline / timeline optional"), {
      target: {
        value: "Flexible, ideally before June 10.",
      },
    });

    fireEvent.change(screen.getByLabelText("Budget optional"), {
      target: {
        value: "75",
      },
    });

    fireEvent.change(screen.getByLabelText("References optional"), {
      target: {
        value: "https://example.com/reference",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send commission request" }));

    await waitFor(() => {
      expect(mocks.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: "listing-1",
          creatorUserId: "creator-1",
          requestTitle: "Custom cozy emote pack",
          requestDetails:
            "I need three cozy emotes for my Twitch channel launch.",
          requestedTimeline: "Flexible, ideally before June 10.",
          budgetAmount: 75,
          referenceLinks: ["https://example.com/reference"],
          listingSnapshot: expect.objectContaining({
            listing_id: "listing-1",
            title: "Custom Emote Pack",
            fulfilment_mode: "request",
            price_min: 50,
          }),
        })
      );
    });
  });

  it("routes to the buyer commission detail after success", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Commission title / summary"), {
      target: {
        value: "Custom cozy emote pack",
      },
    });

    fireEvent.change(screen.getByLabelText("Details"), {
      target: {
        value: "I need three cozy emotes for my Twitch channel launch.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send commission request" }));

    expect(await screen.findByText("Commission detail loaded")).toBeInTheDocument();
  });

  it("shows a link to the existing commission when the buyer already has an active commission", () => {
    mocks.useActiveListingRequestForListing.mockReturnValue({
      data: {
        id: "request-1",
        listing_id: "listing-1",
        buyer_user_id: "buyer-1",
        status: "submitted",
        created_at: "2026-05-20T12:00:00.000Z",
        updated_at: "2026-05-20T12:00:00.000Z",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByRole("heading", { name: "Commission request already sent" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "View existing commission" })
    ).toHaveAttribute("href", "/requests/request-1");

    expect(
      screen.queryByRole("button", { name: "Send commission request" })
    ).not.toBeInTheDocument();
  });

  it("flags invalid fields, focuses the first one, and does not submit", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Budget optional"), { target: { value: "-4" } });
    fireEvent.click(screen.getByRole("button", { name: "Send commission request" }));

    const title = screen.getByLabelText("Commission title / summary");

    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveFocus();
    expect(screen.getByLabelText("Details")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Budget optional")).toHaveAccessibleDescription(
      "Enter an amount such as 100, or a range such as 100-150. Put anything else about your budget in the details."
    );
    expect(screen.getByLabelText("Deadline / timeline optional")).toHaveAttribute("aria-invalid", "false");
    expect(mocks.createRequest).not.toHaveBeenCalled();
  });

  it("counts reference links as they are added", () => {
    renderPage();

    expect(screen.getByText("0/5 links")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("References optional"), {
      target: { value: "https://a.com\n\nhttps://b.com" },
    });

    expect(screen.getByText("2/5 links")).toBeInTheDocument();
  });

  it("explains when a listing does not take commissions", () => {
    mocks.usePublicListing.mockReturnValue({
      data: createListingData({ fulfilment_mode: "instant" }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByRole("heading", { name: "Commission flow unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send commission request" })).not.toBeInTheDocument();
  });
});
