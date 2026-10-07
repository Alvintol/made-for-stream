import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCancelListingRequestBeforePayment } from "../useCancelListingRequestBeforePayment";

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
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { wrapper, invalidateSpy };
};

describe("useCancelListingRequestBeforePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    );

    mocks.useAuth.mockReturnValue({
      user: { id: "buyer-1" },
      session: { access_token: "token-123" },
    });

    mocks.rpc.mockResolvedValue({
      data: [
        {
          listing_request_id: "request-1",
          request_status: "cancelled",
          cancelled_at: "2026-09-22T00:00:00.000Z",
          agreement_id: "agreement-1",
          payments_to_expire: [],
        },
      ],
      error: null,
    });
  });

  it("cancels a commission through the RPC with the given reason", async () => {
    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(() => useCancelListingRequestBeforePayment(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        requestId: "request-1",
        reason: "Buyer no longer needs this commission.",
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "cancel_listing_request_before_payment",
      {
        p_request_id: "request-1",
        p_reason: "Buyer no longer needs this commission.",
      }
    );

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["buyerRequest"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["listingRequestAgreements"],
    });
  });

  it("expires cancelled checkout sessions when the RPC reports open payments", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          listing_request_id: "request-1",
          request_status: "cancelled",
          cancelled_at: "2026-09-22T00:00:00.000Z",
          agreement_id: "agreement-1",
          payments_to_expire: ["payment-1"],
        },
      ],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCancelListingRequestBeforePayment(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        requestId: "request-1",
        reason: "Buyer no longer needs this commission.",
      });
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/stripe/checkout/expire-cancelled-sessions"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
        }),
      })
    );
  });

  it("throws when not signed in", async () => {
    mocks.useAuth.mockReturnValue({ user: null, session: null });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCancelListingRequestBeforePayment(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({
        requestId: "request-1",
        reason: "Buyer no longer needs this commission.",
      })
    ).rejects.toThrow("You must be signed in to cancel this commission.");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("throws when the RPC returns no cancelled commission", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCancelListingRequestBeforePayment(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({
        requestId: "request-1",
        reason: "Buyer no longer needs this commission.",
      })
    ).rejects.toThrow("This commission could not be cancelled.");
  });
});
