import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ListingRequestChangeOrderStatus } from "../../domain/listings/listingRequestAgreements";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type ListingRequestChangeOrderResponse = Extract<
  ListingRequestChangeOrderStatus,
  "buyer_accepted" | "buyer_declined"
>;

export type RespondListingRequestChangeOrderInput = {
  changeOrderId: string;
  response: ListingRequestChangeOrderResponse;
  responseReason?: string | null;
};

export type RespondedListingRequestChangeOrderRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string;
  status: ListingRequestChangeOrderResponse;
  applied_at: string | null;
  buyer_response_reason: string | null;
};

export const useRespondListingRequestChangeOrder = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (
      input: RespondListingRequestChangeOrderInput
    ): Promise<RespondedListingRequestChangeOrderRow> => {
      if (!user?.id) {
        throw new Error(
          "You must be signed in to respond to this change order."
        );
      }

      const { data, error } = await supabase.rpc(
        "respond_listing_request_change_order",
        {
          p_change_order_id: input.changeOrderId,
          p_response: input.response,
          p_response_reason:
            input.response === "buyer_declined"
              ? input.responseReason?.trim() || null
              : null,
        }
      );

      if (error) {
        throw error;
      }

      const changeOrder = Array.isArray(data)
        ? (data[0] as
            | RespondedListingRequestChangeOrderRow
            | undefined)
        : undefined;

      if (!changeOrder?.id) {
        throw new Error(
          "The project change order response could not be saved."
        );
      }

      return changeOrder;
    },

    // A refusal here usually means the other person acted first (the buyer
    // answered, or the creator withdrew it). Reload the list so the screen
    // shows the change order as it is now, not a button that cannot work.
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: ["listingRequestChangeOrders"],
      });
    },

    onSuccess: async (changeOrder) => {
      await Promise.all([
        // Accepting or approving makes the database create the payment
        // that is now due, so the pay button needs the fresh list.
        queryClient.invalidateQueries({
          queryKey: ["listingRequestPayments"],
        }),

        queryClient.invalidateQueries({
          queryKey: [
            "listingRequestChangeOrders",
            changeOrder.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "listingRequestAgreements",
            changeOrder.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "buyerRequest",
            changeOrder.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "creatorRequest",
            changeOrder.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "adminRequest",
            changeOrder.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "listingRequestProgressUpdates",
            changeOrder.listing_request_id,
          ],
        }),
        queryClient.invalidateQueries({
          queryKey: ["requestConversation"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["conversationMessages"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["messagesInbox"],
        }),
      ]);
    },
  });
};