import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import { drainFlaggedListingRequestRefunds } from "../payments/drainFlaggedListingRequestRefunds";

type CloseListingRequestBranch = "buyer_unresponsive" | "creator_unresponsive";

type CloseResult = {
  closure_id: string;
  branch: CloseListingRequestBranch;
  request_status: string;
  flagged_payment_ids: string[];
};

// Sprint 6 (launch-scope.md section 7): admin_close_listing_request_for_non_response
// (20260922_133) is admin-only and checks that itself, matching every other
// admin RPC in this codebase (see useAdminWriteOffCreatorRecoveryBalance).
// On the creator_unresponsive branch it flags unearned amounts for refund
// but cannot itself call Stripe -- this immediately fires the same drain
// route the cancellation-acceptance flow uses, reusing Sprint 5's refund
// engine rather than a parallel path.
export const useAdminCloseListingRequestForNonResponse = () => {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({
      requestId,
      branch,
      requestedByUserId,
      reason,
      earlyReviewFlagId,
    }: {
      requestId: string;
      branch: CloseListingRequestBranch;
      requestedByUserId: string;
      reason: string;
      earlyReviewFlagId?: string | null;
    }): Promise<CloseResult> => {
      const { data, error } = await supabase.rpc(
        "admin_close_listing_request_for_non_response",
        {
          p_request_id: requestId,
          p_branch: branch,
          p_requested_by_user_id: requestedByUserId,
          p_reason: reason,
          p_early_review_flag_id: earlyReviewFlagId ?? null,
        }
      );

      if (error) {
        throw new Error(error.message || "This commission could not be closed.");
      }

      const result = (Array.isArray(data) ? data[0] : null) as CloseResult | null;

      if (!result?.closure_id) {
        throw new Error("This commission could not be closed.");
      }

      if (result.branch === "creator_unresponsive") {
        await drainFlaggedListingRequestRefunds({
          listingRequestId: requestId,
          accessToken: session?.access_token,
        });
      }

      return result;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["adminRequest"] }),
        queryClient.invalidateQueries({ queryKey: ["buyerRequest"] }),
        queryClient.invalidateQueries({ queryKey: ["creatorRequest"] }),
        queryClient.invalidateQueries({ queryKey: ["listingRequestNotices"] }),
        queryClient.invalidateQueries({ queryKey: ["adminStaleListingRequests"] }),
        queryClient.invalidateQueries({ queryKey: ["requestConversation"] }),
        queryClient.invalidateQueries({ queryKey: ["conversationMessages"] }),
      ]);
    },
  });
};
