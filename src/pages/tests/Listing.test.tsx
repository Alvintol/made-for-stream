import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ListingPage from "../listings/Listing";

const mocks = vi.hoisted(() => ({
  usePublicListing: vi.fn(),
  useTwitchStreams: vi.fn(),
  useAuth: vi.fn(),
  submitListingReport: vi.fn(),
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

vi.mock("../../hooks/listings/usePublicListing", () => ({
  usePublicListing: mocks.usePublicListing,
}));

vi.mock("../../hooks/useTwitchStreams", () => ({
  useTwitchStreams: mocks.useTwitchStreams,
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../hooks/moderation/useSubmitListingModerationReport", () => ({
  useSubmitListingModerationReport: () => ({
    mutateAsync: mocks.submitListingReport,
    isPending: false,
  }),
}));

vi.mock("../../hooks/listings/useActiveListingRequestForListing", () => ({
  useActiveListingRequestForListing: mocks.useActiveListingRequestForListing,
}));

const createListingData = () => ({
  listing: {
    id: "listing-1",
    user_id: "creator-1",
    title: "Custom Emote Pack",
    short: "A custom emote pack for streamers.",
    preview_url: null,
    offering_type: "commission",
    category: "emotes",
    video_subtype: "",
    deliverables: ["3 emotes", "PNG files"],
    price_type: "fixed",
    price_min: 50,
    price_max: null,
    fulfilment_mode: "request",
    updated_at: "2026-05-09T12:00:00.000Z",
  },
  creator: {
    user_id: "creator-1",
    handle: "creatoruser",
    display_name: "Creator User",
  },
  platformAccounts: [],
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/listing/listing-1"]}>
      <Routes>
        <Route path="/listing/:id" element={<ListingPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("<ListingPage /> report UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.usePublicListing.mockReturnValue({
      data: createListingData(),
      isLoading: false,
      error: null,
    });

    mocks.useTwitchStreams.mockReturnValue({
      twitchByLogin: {},
    });

    mocks.useAuth.mockReturnValue({
      user: null,
    });

    mocks.submitListingReport.mockResolvedValue("report-1");

    mocks.useActiveListingRequestForListing.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
  });

  it("shows a sign-in prompt for signed-out users", () => {
    renderPage();

    expect(screen.getByText("Report listing")).toBeInTheDocument();
    expect(
      screen.getByText("You need to sign in before reporting a listing.")
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Sign in to report" })).toHaveAttribute(
      "href",
      "/signin"
    );
  });

  it("lets signed-in users open the listing report form", () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Report listing" }));

    expect(screen.getByLabelText("Reason")).toBeInTheDocument();
    expect(screen.getByLabelText("Details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled();
  });

  it("submits a listing report with details", async () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Report listing" }));

    fireEvent.change(screen.getByLabelText("Details"), {
      target: {
        value: "This listing appears misleading.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    await waitFor(() => {
      expect(mocks.submitListingReport).toHaveBeenCalledWith(
        expect.objectContaining({
          listingId: "listing-1",
          reasonDetails: "This listing appears misleading.",
        })
      );
    });

    expect(
      await screen.findByText("Listing report submitted. An admin will review it soon.")
    ).toBeInTheDocument();
  });

  it("shows a useful error when listing report submission fails", async () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
    });

    mocks.submitListingReport.mockRejectedValue(
      new Error("You already have an active report for this listing.")
    );

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Report listing" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    expect(
      await screen.findByText("You already have an active report for this listing.")
    ).toBeInTheDocument();
  });

  it("does not allow users to report their own listing", () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: "creator-1",
      },
    });

    renderPage();

    expect(
      screen.getByText("You cannot report your own listing.")
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Report listing" })
    ).not.toBeInTheDocument();
  });

  it("points commission-mode listing CTA to the buyer commission flow", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Send commission request" })).toHaveAttribute(
      "href",
      "/listing/listing-1/request"
    );
  });

  it("points commission-mode listing CTA to the existing active commission when one exists", () => {
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
      screen.getByRole("link", { name: "View existing commission" })
    ).toHaveAttribute("href", "/requests/request-1");

    expect(
      screen.queryByRole("link", { name: "Send commission request" })
    ).not.toBeInTheDocument();
  });

  it("shows a checking state while loading the buyer active commission", () => {
    mocks.useActiveListingRequestForListing.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Checking commission…")).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: "Send commission request" })
    ).not.toBeInTheDocument();
  });
});