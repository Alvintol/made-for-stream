import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { useRespondListingRequestChangeOrder } from "../useRespondListingRequestChangeOrder";

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

  const invalidateSpy = vi.spyOn(
    queryClient,
    "invalidateQueries"
  );

  const wrapper = ({
    children,
  }: {
    children: ReactNode;
  }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return {
    wrapper,
    invalidateSpy,
  };
};

describe("useRespondListingRequestChangeOrder", () => {
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
          id: "change-order-1",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          status: "buyer_accepted",
          applied_at: "2026-06-08T12:00:00.000Z",
          buyer_response_reason: null,
        },
      ],
      error: null,
    });
  });

  it("accepts a sent change order through the RPC", async () => {
    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(
      () => useRespondListingRequestChangeOrder(),
      {
        wrapper,
      }
    );

    await act(async () => {
      await result.current.mutateAsync({
        changeOrderId: "change-order-1",
        response: "buyer_accepted",
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "respond_listing_request_change_order",
      {
        p_change_order_id: "change-order-1",
        p_response: "buyer_accepted",
        p_response_reason: null,
      }
    );

    // The payment that is now due only shows once this list is refreshed.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["listingRequestPayments"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [
        "listingRequestChangeOrders",
        "request-1",
      ],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: [
        "listingRequestAgreements",
        "request-1",
      ],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["buyerRequest", "request-1"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["creatorRequest", "request-1"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["conversationMessages"],
    });
  });

  it("declines a change order with an optional reason", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: "change-order-1",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          status: "buyer_declined",
          applied_at: null,
          buyer_response_reason:
            "The additional work is outside my current budget.",
        },
      ],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useRespondListingRequestChangeOrder(),
      {
        wrapper,
      }
    );

    await act(async () => {
      await result.current.mutateAsync({
        changeOrderId: "change-order-1",
        response: "buyer_declined",
        responseReason:
          " The additional work is outside my current budget. ",
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "respond_listing_request_change_order",
      {
        p_change_order_id: "change-order-1",
        p_response: "buyer_declined",
        p_response_reason:
          "The additional work is outside my current budget.",
      }
    );
  });

  it("throws when the buyer is signed out", async () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useRespondListingRequestChangeOrder(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        changeOrderId: "change-order-1",
        response: "buyer_accepted",
      })
    ).rejects.toThrow(
      "You must be signed in to respond to this change order."
    );

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("surfaces RPC errors", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: new Error(
        "This change order is not available for your response."
      ),
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useRespondListingRequestChangeOrder(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        changeOrderId: "change-order-1",
        response: "buyer_accepted",
      })
    ).rejects.toThrow(
      "This change order is not available for your response."
    );
  });

  it("throws when the RPC returns no response row", async () => {
    mocks.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useRespondListingRequestChangeOrder(),
      {
        wrapper,
      }
    );

    await expect(
      result.current.mutateAsync({
        changeOrderId: "change-order-1",
        response: "buyer_accepted",
      })
    ).rejects.toThrow(
      "The project change order response could not be saved."
    );
  });
});