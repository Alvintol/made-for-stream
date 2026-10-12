import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRespondListingRequestAgreement } from "../useRespondListingRequestAgreement";
import { currentPolicyVersions } from "../../../domain/legal/policyAcceptance";

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

describe("useRespondListingRequestAgreement", () => {
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
          id: "agreement-1",
          status: "buyer_accepted",
          starting_payment_status: "payment_required",
        },
      ],
      error: null,
    });
  });

  it("accepts a sent project agreement through the focused RPC with acknowledgement keys", async () => {
    const { wrapper, invalidateSpy } = createWrapper();

    const { result } = renderHook(() => useRespondListingRequestAgreement(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        agreementId: "agreement-1",
        response: "buyer_accepted",
        acknowledgementKeys: [
          "agreement:scope_summary",
          "agreement:payment_schedule",
        ],
        earlyServiceRequested: true,
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "respond_listing_request_agreement",
      {
        p_agreement_id: "agreement-1",
        p_response: "buyer_accepted",
        p_acknowledgement_keys: [
          "agreement:scope_summary",
          "agreement:payment_schedule",
        ],
        p_early_service_request_version: currentPolicyVersions.early_service_request,
      }
    );

    // The payment that is now due only shows once this list is refreshed.
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["listingRequestPayments"],
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["listingRequestAgreements"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["buyerRequest"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["creatorRequest"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["messagesInbox"],
    });
  });

  it("declines a sent project agreement through the focused RPC without acknowledgement keys", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: "agreement-1",
          status: "buyer_declined",
          starting_payment_status: "payment_required",
        },
      ],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRespondListingRequestAgreement(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        agreementId: "agreement-1",
        response: "buyer_declined",
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "respond_listing_request_agreement",
      {
        p_agreement_id: "agreement-1",
        p_response: "buyer_declined",
        p_acknowledgement_keys: [],
        p_early_service_request_version: null,
      }
    );
  });

  it("sends no early-start version when the buyer has not asked for an early start, so the database refuses acceptance", async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRespondListingRequestAgreement(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        agreementId: "agreement-1",
        response: "buyer_accepted",
        acknowledgementKeys: [],
      });
    });

    expect(mocks.rpc).toHaveBeenCalledWith(
      "respond_listing_request_agreement",
      expect.objectContaining({ p_early_service_request_version: null }),
    );
  });

  it("throws when the buyer is not signed in", async () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRespondListingRequestAgreement(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
        response: "buyer_accepted",
        acknowledgementKeys: ["agreement:scope_summary"],
      })
    ).rejects.toThrow("You must be signed in to respond to this agreement.");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("throws when the RPC returns no agreement", async () => {
    mocks.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRespondListingRequestAgreement(), {
      wrapper,
    });

    await expect(
      result.current.mutateAsync({
        agreementId: "agreement-1",
        response: "buyer_accepted",
        acknowledgementKeys: ["agreement:scope_summary"],
      })
    ).rejects.toThrow("The project agreement response could not be saved.");
  });
});