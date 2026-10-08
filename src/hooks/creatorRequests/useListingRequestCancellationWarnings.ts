import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";

// Cancellation warnings (20261007_149): either side of an active commission
// can start a 7, 10 or 14 day timer. With no reply in the chat by the end,
// the commission is cancelled automatically. Every rule is enforced by the
// database; these hooks only call it.
export const CANCELLATION_WARNING_DAYS = [7, 10, 14] as const;

export type CancellationWarningDays = (typeof CANCELLATION_WARNING_DAYS)[number];

export type ListingRequestCancellationWarning = {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  requested_action: string;
  response_days: number;
  status: "open" | "answered" | "withdrawn" | "cancelled_request" | "lapsed";
  sent_at: string;
  expires_at: string;
};

// The database prefixes its refusals with an id for support ("WARN-002: ").
// People do not need to read that part.
const cleanMessage = (message: string | undefined, fallback: string): string =>
  message?.replace(/^WARN-\d+:\s*/, "") || fallback;

export const useListingRequestCancellationWarnings = (requestId: string | null) =>
  useQuery<ListingRequestCancellationWarning[]>({
    queryKey: ["listingRequestCancellationWarnings", requestId],
    enabled: Boolean(requestId),
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_request_cancellation_warnings")
        .select(
          "id, sender_user_id, recipient_user_id, requested_action, response_days, status, sent_at, expires_at",
        )
        .eq("listing_request_id", requestId as string)
        .order("sent_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as ListingRequestCancellationWarning[];
    },
  });

const useInvalidateWarnings = () => {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["listingRequestCancellationWarnings"] }),
      queryClient.invalidateQueries({ queryKey: ["requestConversation"] }),
      queryClient.invalidateQueries({ queryKey: ["conversationMessages"] }),
    ]);
};

export const useSendListingRequestCancellationWarning = () => {
  const invalidate = useInvalidateWarnings();

  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      requestedAction: string;
      responseDays: CancellationWarningDays;
    }) => {
      const { error } = await supabase.rpc("send_listing_request_cancellation_warning", {
        p_request_id: input.requestId,
        p_requested_action: input.requestedAction,
        p_response_days: input.responseDays,
      });

      if (error) {
        throw new Error(cleanMessage(error.message, "The cancellation warning could not be sent."));
      }
    },
    onSuccess: invalidate,
  });
};

export const useWithdrawListingRequestCancellationWarning = () => {
  const invalidate = useInvalidateWarnings();

  return useMutation({
    mutationFn: async (warningId: string) => {
      const { error } = await supabase.rpc("withdraw_listing_request_cancellation_warning", {
        p_warning_id: warningId,
      });

      if (error) {
        throw new Error(
          cleanMessage(error.message, "The cancellation warning could not be withdrawn."),
        );
      }
    },
    onSuccess: invalidate,
  });
};
