import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RequestListing from "../listings/RequestListing";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  usePublicListing: vi.fn(),
  createRequest: vi.fn(),
  useActiveListingRequestForListing: vi.fn(),
}));

// Prices are shown in the creator's own currency in these tests; the
// conversion has its own tests (ListingPriceText, displayCurrency).
vi.mock("../../hooks/money/useDisplayCurrency", () => ({
  useDisplayCurrency: () => ({ displayCurrency: null, rates: null }),
  useDisplayPreferences: () => ({ data: null, isLoading: false }),
  useSaveDisplayPreferences: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useExchangeRates: () => ({ data: null }),
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
        <Route path="/requests/:id" element={<div>Request detail loaded</div>} />
      </Routes>
    </MemoryRouter>
  );

describe("RequestListing", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
      screen.getByRole("heading", { name: "Sign in to submit a request" })
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
      screen.getByText("You cannot submit a buyer request for your own listing.")
    ).toBeInTheDocument();
  });

  it("renders listing context and the structured request form", () => {
    renderPage();

    expect(screen.getByText("Custom Emote Pack")).toBeInTheDocument();
    expect(screen.getByText("@creatoruser")).toBeInTheDocument();
    expect(screen.getByText("$50 CAD")).toBeInTheDocument();
    expect(screen.getByText("3 emotes")).toBeInTheDocument();

    expect(screen.getByLabelText("Request title / summary")).toBeInTheDocument();
    expect(screen.getByLabelText("Details")).toBeInTheDocument();
    expect(screen.getByLabelText("Deadline / timeline optional")).toBeInTheDocument();
    expect(screen.getByLabelText("Budget optional")).toBeInTheDocument();
    expect(screen.getByLabelText("References optional")).toBeInTheDocument();
  });

  it("submits a normal buyer request with listing id and snapshot", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Request title / summary"), {
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

    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

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

  it("routes to the buyer request detail after success", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Request title / summary"), {
      target: {
        value: "Custom cozy emote pack",
      },
    });

    fireEvent.change(screen.getByLabelText("Details"), {
      target: {
        value: "I need three cozy emotes for my Twitch channel launch.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("Request detail loaded")).toBeInTheDocument();
  });

  it("shows a link to the existing request when the buyer already has an active request", () => {
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
      screen.getByRole("heading", { name: "Request already submitted" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "View existing request" })
    ).toHaveAttribute("href", "/requests/request-1");

    expect(
      screen.queryByRole("button", { name: "Submit request" })
    ).not.toBeInTheDocument();
  });

  it("flags invalid fields, focuses the first one, and does not submit", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Budget optional"), { target: { value: "-4" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    const title = screen.getByLabelText("Request title / summary");

    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveFocus();
    expect(screen.getByLabelText("Details")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Budget optional")).toHaveAccessibleDescription(
      "Budget must be a valid amount between 0 and 999999.99."
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

  it("explains when a listing does not take requests", () => {
    mocks.usePublicListing.mockReturnValue({
      data: createListingData({ fulfilment_mode: "instant" }),
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByRole("heading", { name: "Request flow unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit request" })).not.toBeInTheDocument();
  });
});
