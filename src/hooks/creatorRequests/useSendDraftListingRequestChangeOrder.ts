import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

type SendDraftListingRequestChangeOrderInput = {
  changeOrderId: string;
};

type SentDraftListingRequestChangeOrderRow = {
  id: string;
  listing_request_id: string;
  agreement_id: string;
  status: "sent";
  version_number: number;
  sent_at: string;
};

export const useSendDraftListingRequestChangeOrder = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (
      input: SendDraftListingRequestChangeOrderInput
    ): Promise<SentDraftListingRequestChangeOrderRow> => {
      if (!user?.id) {
        throw new Error(
          "You must be signed in to send this change order."
        );
      }

      const { data, error } = await supabase.rpc(
        "send_draft_listing_request_change_order",
        {
          p_change_order_id: input.changeOrderId,
        }
      );

      if (error) {
        throw error;
      }

      const changeOrder = Array.isArray(data)
        ? (data[0] as
            | SentDraftListingRequestChangeOrderRow
            | undefined)
        : undefined;

      if (!changeOrder?.id) {
        throw new Error(
          "The project change order could not be sent."
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