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

import { useRespondListingRequestMilestone } from "../useRespondListingRequestMilestone";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock(
  "../../../providers/AuthProvider",
  () => ({
    useAuth: mocks.useAuth,
  })
);

vi.mock(
  "../../../lib/supabaseClient",
  () => ({
    supabase: {
      rpc: mocks.rpc,
    },
  })
);

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

describe(
  "useRespondListingRequestMilestone",
  () => {
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
            submission_id: "submission-1",
            milestone_id: "milestone-1",
            listing_request_id: "request-1",
            agreement_id: "agreement-1",
            response_status: "buyer_approved",
            milestone_status:
              "payment_required",
            payment_status:
              "payment_required",
            responded_at:
              "2026-06-18T12:00:00.000Z",
          },
        ],
        error: null,
      });
    });

    it("approves a milestone through the buyer RPC", async () => {
      const { wrapper, invalidateSpy } =
        createWrapper();

      const { result } = renderHook(
        () =>
          useRespondListingRequestMilestone(),
        {
          wrapper,
        }
      );

      await act(async () => {
        await result.current.mutateAsync({
          milestoneId: "milestone-1",
          response: "buyer_approved",
        });
      });

      expect(mocks.rpc).toHaveBeenCalledWith(
        "respond_listing_request_milestone",
        {
          p_milestone_id: "milestone-1",
          p_response: "buyer_approved",
          p_revision_request_reason: null,
        }
      );

      expect(
        invalidateSpy
      ).toHaveBeenCalledWith({
        queryKey: [
          "listingRequestMilestones",
          "request-1",
        ],
      });

      expect(
        invalidateSpy
      ).toHaveBeenCalledWith({
        queryKey: [
          "listingRequestMilestoneSubmissions",
          "request-1",
        ],
      });

      expect(
        invalidateSpy
      ).toHaveBeenCalledWith({
        queryKey: [
          "listingRequestAgreements",
          "request-1",
        ],
      });

      expect(
        invalidateSpy
      ).toHaveBeenCalledWith({
        queryKey: [
          "buyerRequest",
          "request-1",
        ],
      });

      expect(
        invalidateSpy
      ).toHaveBeenCalledWith({
        queryKey: [
          "creatorRequest",
          "request-1",
        ],
      });

      expect(
        invalidateSpy
      ).toHaveBeenCalledWith({
        queryKey: [
          "adminRequest",
          "request-1",
        ],
      });

      expect(
        invalidateSpy
      ).toHaveBeenCalledWith({
        queryKey: ["conversationMessages"],
      });
    });

    it("commissions milestone revisions with a trimmed reason", async () => {
      mocks.rpc.mockResolvedValue({
        data: [
          {
            submission_id: "submission-1",
            milestone_id: "milestone-1",
            listing_request_id: "request-1",
            agreement_id: "agreement-1",
            response_status:
              "revision_requested",
            milestone_status:
              "revision_requested",
            payment_status: "pending",
            responded_at:
              "2026-06-18T12:00:00.000Z",
          },
        ],
        error: null,
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useRespondListingRequestMilestone(),
        {
          wrapper,
        }
      );

      await act(async () => {
        await result.current.mutateAsync({
          milestoneId: "milestone-1",
          response: "revision_requested",
          revisionRequestReason:
            " Please adjust the colour direction. ",
        });
      });

      expect(mocks.rpc).toHaveBeenCalledWith(
        "respond_listing_request_milestone",
        {
          p_milestone_id: "milestone-1",
          p_response: "revision_requested",
          p_revision_request_reason:
            "Please adjust the colour direction.",
        }
      );
    });

    it("throws while signed out", async () => {
      mocks.useAuth.mockReturnValue({
        user: null,
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useRespondListingRequestMilestone(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          milestoneId: "milestone-1",
          response: "buyer_approved",
        })
      ).rejects.toThrow(
        "You must be signed in to respond to a milestone."
      );

      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("surfaces RPC errors", async () => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: new Error(
          "This milestone is not awaiting your response."
        ),
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useRespondListingRequestMilestone(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          milestoneId: "milestone-1",
          response: "buyer_approved",
        })
      ).rejects.toThrow(
        "This milestone is not awaiting your response."
      );
    });

    it("throws when the RPC returns no response row", async () => {
      mocks.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useRespondListingRequestMilestone(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          milestoneId: "milestone-1",
          response: "buyer_approved",
        })
      ).rejects.toThrow(
        "The milestone response could not be saved."
      );
    });
  }
);