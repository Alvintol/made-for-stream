import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCreateListingRequest } from "../useCreateListingRequest";
import type { ListingRequestSnapshot } from "../../../lib/listings/listingRequestSnapshot";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("../../../providers/AuthProvider", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: mocks.from,
  },
}));

const listingSnapshot: ListingRequestSnapshot = {
  listing_id: "listing-1",
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
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useCreateListingRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
    });

    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "request-1",
      },
      error: null,
    });

    mocks.select.mockReturnValue({
      maybeSingle: mocks.maybeSingle,
    });

    mocks.insert.mockReturnValue({
      select: mocks.select,
    });

    mocks.from.mockReturnValue({
      insert: mocks.insert,
    });
  });

  it("inserts a structured listing commission payload with a frozen listing snapshot", async () => {
    const { result } = renderHook(() => useCreateListingRequest(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        listingId: "listing-1",
        creatorUserId: "creator-1",
        requestTitle: "  Custom cozy emote pack  ",
        requestDetails:
          "  I need three cozy emotes for my Twitch channel launch.  ",
        requestedTimeline: "  Flexible, ideally before June 10.  ",
        budgetAmount: 75,
        referenceLinks: [
          " https://example.com/reference-one ",
          "",
          "https://example.com/reference-two",
        ],
        listingSnapshot,
      });
    });

    await waitFor(() => {
      expect(mocks.from).toHaveBeenCalledWith("listing_requests");
    });

    expect(mocks.insert).toHaveBeenCalledWith({
      listing_id: "listing-1",
      buyer_user_id: "buyer-1",
      creator_user_id: "creator-1",
      status: "submitted",

      // Legacy field stays populated for old request UI/message fallbacks.
      message: "I need three cozy emotes for my Twitch channel launch.",

      // New structured request fields.
      request_title: "Custom cozy emote pack",
      request_details: "I need three cozy emotes for my Twitch channel launch.",
      requested_timeline: "Flexible, ideally before June 10.",
      budget_amount: 75,
      reference_links: [
        "https://example.com/reference-one",
        "https://example.com/reference-two",
      ],

      listing_snapshot: listingSnapshot,
    });

    expect(mocks.select).toHaveBeenCalledWith("id");
    expect(mocks.maybeSingle).toHaveBeenCalled();
  });

  it("stores optional commission fields as empty-safe values", async () => {
    const { result } = renderHook(() => useCreateListingRequest(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        listingId: "listing-1",
        creatorUserId: "creator-1",
        requestTitle: "Simple emote commission",
        requestDetails: "Please make a simple cozy emote.",
        requestedTimeline: "   ",
        budgetAmount: null,
        referenceLinks: ["   "],
        listingSnapshot,
      });
    });

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        request_title: "Simple emote commission",
        request_details: "Please make a simple cozy emote.",
        requested_timeline: null,
        budget_amount: null,
        reference_links: [],
        message: "Please make a simple cozy emote.",
      })
    );
  });

  it("throws when the user is not signed in", async () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    const { result } = renderHook(() => useCreateListingRequest(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        listingId: "listing-1",
        creatorUserId: "creator-1",
        requestTitle: "Simple emote commission",
        requestDetails: "Please make a simple cozy emote.",
        listingSnapshot,
      })
    ).rejects.toThrow("You must be signed in to send a commission request.");

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("throws a clear error when Supabase does not return a commission id", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(() => useCreateListingRequest(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        listingId: "listing-1",
        creatorUserId: "creator-1",
        requestTitle: "Simple emote commission",
        requestDetails: "Please make a simple cozy emote.",
        listingSnapshot,
      })
    ).rejects.toThrow("The commission request could not be sent.");
  });

  it("throws buyer-friendly copy when Supabase blocks the insert", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "new row violates row-level security policy",
      },
    });

    const { result } = renderHook(() => useCreateListingRequest(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        listingId: "listing-1",
        creatorUserId: "creator-1",
        requestTitle: "Simple emote commission",
        requestDetails: "Please make a simple cozy emote.",
        listingSnapshot,
      })
    ).rejects.toThrow("This listing is no longer available for commission requests.");
  });
});