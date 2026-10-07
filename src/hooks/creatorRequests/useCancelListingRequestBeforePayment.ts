import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { expireCancelledCheckoutSessions } from "../payments/expireCancelledCheckoutSessions";
import { useAuth } from "../../providers/AuthProvider";

type CancelListingRequestBeforePaymentInput = {
  requestId: string;
  reason: string;
};

type CancelListingRequestBeforePaymentResult = {
  listing_request_id: string;
  request_status: string;
  cancelled_at: string;
  agreement_id: string | null;
  payments_to_expire: string[];
};

export const useCancelListingRequestBeforePayment = () => {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      requestId,
      reason,
    }: CancelListingRequestBeforePaymentInput) => {
      if (!user?.id) {
        throw new Error("You must be signed in to cancel this commission.");
      }

      const { data, error } = await supabase.rpc(
        "cancel_listing_request_before_payment",
        {
          p_request_id: requestId,
          p_reason: reason,
        }
      );

      if (error) {
        throw new Error(
          error.message || "This commission could not be cancelled."
        );
      }

      const result = (
        Array.isArray(data) ? data[0] : null
      ) as CancelListingRequestBeforePaymentResult | null;

      if (!result?.listing_request_id) {
        throw new Error("This commission could not be cancelled.");
      }

      if (result.payments_to_expire?.length) {
        await expireCancelledCheckoutSessions({
          listingRequestId: requestId,
          accessToken: session?.access_token,
        });
      }

      return result;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["myBuyerRequests"] }),
        queryClient.invalidateQueries({ queryKey: ["buyerRequest"] }),
        queryClient.invalidateQueries({ queryKey: ["myCreatorRequests"] }),
        queryClient.invalidateQueries({ queryKey: ["creatorRequest"] }),
        queryClient.invalidateQueries({ queryKey: ["requestConversation"] }),
        queryClient.invalidateQueries({ queryKey: ["conversationMessages"] }),
        queryClient.invalidateQueries({ queryKey: ["messagesInbox"] }),
        queryClient.invalidateQueries({ queryKey: ["adminRequests"] }),
        queryClient.invalidateQueries({
          queryKey: ["listingRequestAgreements"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["listingRequestPayments"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["listingRequestMilestones"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["listingRequestChangeOrders"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["listingRequestFinalDeliveries"],
        }),
      ]);
    },
  });
};
