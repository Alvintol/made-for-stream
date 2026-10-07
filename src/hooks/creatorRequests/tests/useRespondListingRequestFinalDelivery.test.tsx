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

import {
  useRespondListingRequestFinalDelivery,
} from "../useRespondListingRequestFinalDelivery";

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

describe(
  "useRespondListingRequestFinalDelivery",
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
            id: "final-delivery-1",
            listing_request_id: "request-1",
            agreement_id: "agreement-1",
            status: "buyer_approved",
            revision_request_reason: null,
            revision_requested_at: null,
            buyer_approved_at:
              "2026-06-09T12:00:00.000Z",
          },
        ],
        error: null,
      });
    });

    it(
      "approves a submitted final delivery",
      async () => {
        const { wrapper, invalidateSpy } =
          createWrapper();

        const { result } = renderHook(
          () =>
            useRespondListingRequestFinalDelivery(),
          {
            wrapper,
          }
        );

        await act(async () => {
          await result.current.mutateAsync({
            finalDeliveryId:
              "final-delivery-1",
            response: "buyer_approved",
          });
        });

        expect(mocks.rpc).toHaveBeenCalledWith(
          "respond_listing_request_final_delivery",
          {
            p_final_delivery_id:
              "final-delivery-1",
            p_response: "buyer_approved",
            p_revision_request_reason: null,
          }
        );

        expect(
          invalidateSpy
        ).toHaveBeenCalledWith({
          queryKey: [
            "listingRequestFinalDeliveries",
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
          queryKey: ["conversationMessages"],
        });

        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["myBuyerRequests"],
        });

        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["myCreatorRequests"],
        });

        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["adminRequests"],
        });
      }
    );

    it(
      "commissions revisions with a trimmed reason",
      async () => {
        mocks.rpc.mockResolvedValue({
          data: [
            {
              id: "final-delivery-1",
              listing_request_id: "request-1",
              agreement_id: "agreement-1",
              status: "revision_requested",
              revision_request_reason:
                "Please adjust the final title alignment.",
              revision_requested_at:
                "2026-06-09T12:00:00.000Z",
              buyer_approved_at: null,
            },
          ],
          error: null,
        });

        const { wrapper } = createWrapper();

        const { result } = renderHook(
          () =>
            useRespondListingRequestFinalDelivery(),
          {
            wrapper,
          }
        );

        await act(async () => {
          await result.current.mutateAsync({
            finalDeliveryId:
              "final-delivery-1",
            response: "revision_requested",
            revisionRequestReason:
              " Please adjust the final title alignment. ",
          });
        });

        expect(mocks.rpc).toHaveBeenCalledWith(
          "respond_listing_request_final_delivery",
          {
            p_final_delivery_id:
              "final-delivery-1",
            p_response:
              "revision_requested",
            p_revision_request_reason:
              "Please adjust the final title alignment.",
          }
        );
      }
    );

    it("throws while signed out", async () => {
      mocks.useAuth.mockReturnValue({
        user: null,
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useRespondListingRequestFinalDelivery(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          finalDeliveryId:
            "final-delivery-1",
          response: "buyer_approved",
        })
      ).rejects.toThrow(
        "You must be signed in to respond to this final delivery."
      );

      expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it("surfaces RPC errors", async () => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: new Error(
          "The final balance must be paid before the delivery can be approved."
        ),
      });

      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () =>
          useRespondListingRequestFinalDelivery(),
        {
          wrapper,
        }
      );

      await expect(
        result.current.mutateAsync({
          finalDeliveryId:
            "final-delivery-1",
          response: "buyer_approved",
        })
      ).rejects.toThrow(
        "The final balance must be paid before the delivery can be approved."
      );
    });

    it(
      "throws when the RPC returns no delivery",
      async () => {
        mocks.rpc.mockResolvedValue({
          data: [],
          error: null,
        });

        const { wrapper } = createWrapper();

        const { result } = renderHook(
          () =>
            useRespondListingRequestFinalDelivery(),
          {
            wrapper,
          }
        );

        await expect(
          result.current.mutateAsync({
            finalDeliveryId:
              "final-delivery-1",
            response: "buyer_approved",
          })
        ).rejects.toThrow(
          "The final delivery response could not be saved."
        );
      }
    );
  }
);