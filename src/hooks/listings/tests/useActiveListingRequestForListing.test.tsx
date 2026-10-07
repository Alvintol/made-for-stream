import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useActiveListingRequestForListing } from "../useActiveListingRequestForListing";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  inFilter: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
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

describe("useActiveListingRequestForListing", () => {
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
        listing_id: "listing-1",
        buyer_user_id: "buyer-1",
        status: "submitted",
        created_at: "2026-05-20T12:00:00.000Z",
        updated_at: "2026-05-20T12:00:00.000Z",
      },
      error: null,
    });

    mocks.limit.mockReturnValue({
      maybeSingle: mocks.maybeSingle,
    });

    mocks.order.mockReturnValue({
      limit: mocks.limit,
    });

    mocks.inFilter.mockReturnValue({
      order: mocks.order,
    });

    mocks.eq.mockReturnValue({
      eq: mocks.eq,
      in: mocks.inFilter,
    });

    mocks.select.mockReturnValue({
      eq: mocks.eq,
    });

    mocks.from.mockReturnValue({
      select: mocks.select,
    });
  });

  it("loads the buyer active commission for a listing", async () => {
    const { result } = renderHook(
      () => useActiveListingRequestForListing("listing-1"),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.data?.id).toBe("request-1");
    });

    expect(mocks.from).toHaveBeenCalledWith("listing_requests");
    expect(mocks.eq).toHaveBeenCalledWith("listing_id", "listing-1");
    expect(mocks.eq).toHaveBeenCalledWith("buyer_user_id", "buyer-1");
    expect(mocks.inFilter).toHaveBeenCalledWith("status", [
      "submitted",
      "accepted",
    ]);
    expect(mocks.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(mocks.limit).toHaveBeenCalledWith(1);
  });

  it("does not query when the user is signed out", () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    renderHook(() => useActiveListingRequestForListing("listing-1"), {
      wrapper: createWrapper(),
    });

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not query when no listing id is provided", () => {
    renderHook(() => useActiveListingRequestForListing(null), {
      wrapper: createWrapper(),
    });

    expect(mocks.from).not.toHaveBeenCalled();
  });
});