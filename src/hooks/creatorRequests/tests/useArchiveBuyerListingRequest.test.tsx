import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useArchiveBuyerListingRequest } from "../useArchiveBuyerListingRequest";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../../../providers/AuthProvider", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    rpc: mocks.rpc,
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

describe("useArchiveBuyerListingRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
    });

    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: "request-1",
          status: "archived",
        },
      ],
      error: null,
    });
  });

  it("archives a buyer commission through the focused RPC", async () => {
    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(() => useArchiveBuyerListingRequest(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        requestId: "request-1",
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith("archive_my_listing_request", {
      p_request_id: "request-1",
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["myBuyerRequests"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["buyerRequest"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["messagesInbox"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["activeListingRequestForListing"],
    });
  });

  it("throws when the buyer is not signed in", async () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useArchiveBuyerListingRequest(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({
        requestId: "request-1",
      })
    ).rejects.toThrow("You must be signed in to archive this commission.");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("throws when the RPC returns no archived commission", async () => {
    mocks.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useArchiveBuyerListingRequest(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({
        requestId: "request-1",
      })
    ).rejects.toThrow("This commission could not be archived.");
  });
});