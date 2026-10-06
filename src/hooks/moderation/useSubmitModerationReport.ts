import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type {
  ModerationReportReasonCode,
  ModerationReportTargetType,
} from "../../domain/moderation/moderationReports";

type SubmitModerationReportInput = {
  targetType: ModerationReportTargetType;
  conversationId?: string | null;
  messageId?: string | null;
  listingId?: string | null;
  profileUserId?: string | null;
  reasonCode: ModerationReportReasonCode;
  reasonDetails?: string;
};

const normaliseDetails = (value?: string) => value?.trim() ?? "";

export const useSubmitModerationReport = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: SubmitModerationReportInput) => {
      if (!user?.id) {
        throw new Error("You must be signed in to submit a report.");
      }

      const details = normaliseDetails(input.reasonDetails);

      if (!input.reasonCode) {
        throw new Error("Please choose a reason for the report.");
      }

      if (input.reasonCode === "other" && details.length < 10) {
        throw new Error(
          "Please add at least 10 characters of detail when choosing Other."
        );
      }

      if (details.length > 1000) {
        throw new Error("Additional details must be 1000 characters or less.");
      }

      const { data, error } = await supabase.rpc("submit_moderation_report", {
        p_target_type: input.targetType,
        p_conversation_id: input.conversationId ?? null,
        p_message_id: input.messageId ?? null,
        p_listing_id: input.listingId ?? null,
        p_profile_user_id: input.profileUserId ?? null,
        p_reason_code: input.reasonCode,
        p_reason_details: details || null,
      });

      if (error) {
        throw error;
      }

      if (!data?.id) {
        throw new Error("The report could not be submitted.");
      }

      return data.id as string;
    },

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["moderationReports"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myModerationReports"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["adminModerationReports"],
        }),
      ]);
    },
  });
};