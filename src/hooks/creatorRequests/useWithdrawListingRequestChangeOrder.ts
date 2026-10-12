import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type WithdrawListingRequestChangeOrderInput = {
  changeOrderId: string;
};

type WithdrawnListingRequestChangeOrderRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string;
  status: "cancelled";
  cancelled_at: string;
};

export const useWithdrawListingRequestChangeOrder = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (
      input: WithdrawListingRequestChangeOrderInput
    ): Promise<WithdrawnListingRequestChangeOrderRow> => {
      if (!user?.id) {
        throw new Error(
          "You must be signed in to withdraw this change order."
        );
      }

      const { data, error } = await supabase.rpc(
        "withdraw_listing_request_change_order",
        {
          p_change_order_id: input.changeOrderId,
        }
      );

      if (error) {
        throw error;
      }

      const changeOrder = Array.isArray(data)
        ? (data[0] as
            | WithdrawnListingRequestChangeOrderRow
            | undefined)
        : undefined;

      if (!changeOrder?.id) {
        throw new Error(
          "The project change order could not be withdrawn."
        );
      }

      return changeOrder;
    },


    onSuccess: async (changeOrder) => {
      await Promise.all([
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
            "creatorRequest",
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
            "adminRequest",
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
