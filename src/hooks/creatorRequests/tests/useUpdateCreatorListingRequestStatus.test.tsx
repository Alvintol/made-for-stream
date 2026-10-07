import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateCreatorListingRequestStatus } from "../useUpdateCreatorListingRequestStatus";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
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

  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return {
    wrapper,
    invalidateSpy,
  };
};

describe("useUpdateCreatorListingRequestStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAuth.mockReturnValue({
      user: {
        id: "creator-1",
      },
    });

    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "request-1",
        status: "accepted",
      },
      error: null,
    });

    mocks.select.mockReturnValue({
      maybeSingle: mocks.maybeSingle,
    });

    mocks.eq.mockReturnValue({
      eq: mocks.eq,
      select: mocks.select,
    });

    mocks.update.mockReturnValue({
      eq: mocks.eq,
    });

    mocks.from.mockReturnValue({
      update: mocks.update,
    });
  });

  it("updates commission status and invalidates commission, inbox, and active-commission caches", async () => {
    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(() => useUpdateCreatorListingRequestStatus(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        requestId: "request-1",
        status: "accepted",
      });
    });

    expect(mocks.from).toHaveBeenCalledWith("listing_requests");

    expect(mocks.update).toHaveBeenCalledWith({
      status: "accepted",
      creator_status_reason: null,
    });

    expect(mocks.eq).toHaveBeenCalledWith("id", "request-1");
    expect(mocks.eq).toHaveBeenCalledWith("creator_user_id", "creator-1");
    expect(mocks.eq).toHaveBeenCalledWith("status", "submitted");
    expect(mocks.select).toHaveBeenCalledWith("id, status");

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["myCreatorRequests"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["creatorRequest"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["myBuyerRequests"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["buyerRequest"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["requestConversation"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["conversationMessages"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["messagesInbox"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["adminRequests"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["activeListingRequestForListing"],
    });
  });

  it("throws clear copy when the commission is no longer submitted", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateCreatorListingRequestStatus(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({
        requestId: "request-1",
        status: "accepted",
      })
    ).rejects.toThrow(
      "This commission request is no longer under review and cannot be updated."
    );

    expect(mocks.from).toHaveBeenCalledWith("listing_requests");
    expect(mocks.eq).toHaveBeenCalledWith("id", "request-1");
    expect(mocks.eq).toHaveBeenCalledWith("creator_user_id", "creator-1");
    expect(mocks.eq).toHaveBeenCalledWith("status", "submitted");
  });

  it("requires a useful decline reason when declining", async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateCreatorListingRequestStatus(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({
        requestId: "request-1",
        status: "declined",
        reason: "Too short",
      })
    ).rejects.toThrow("Decline reason must be between 10 and 1000 characters.");

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("throws when the creator is not signed in", async () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useUpdateCreatorListingRequestStatus(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({
        requestId: "request-1",
        status: "accepted",
      })
    ).rejects.toThrow("You must be signed in to update commission status.");

    expect(mocks.from).not.toHaveBeenCalled();
  });
});