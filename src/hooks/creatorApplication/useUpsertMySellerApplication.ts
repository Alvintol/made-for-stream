import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type { SellerApplicationStatus, TwitchStatus } from "./useMySellerApplication";

type UpsertSellerApplicationInput = {
  id?: string;
  status: Extract<SellerApplicationStatus, "draft" | "submitted" | "needs_changes">;
  applicant_notes?: string | null;
  agreed_to_terms?: boolean;
  agreed_to_original_work?: boolean;
  agreed_to_manual_review?: boolean;
  agreed_to_age_and_capacity?: boolean;
  twitch_status?: TwitchStatus | null;
  twitch_follower_count?: number | null;
  youtube_subscriber_count?: number | null;
  offering_types?: string[];
  submitted_at?: string | null;
};

// Creates or updates the current user's seller application
const upsertMySellerApplication = async (
  userId: string,
  input: UpsertSellerApplicationInput
) => {
  const now = new Date().toISOString();

  const patch = {
    id: input.id,
    profile_user_id: userId,
    status: input.status,
    applicant_notes: input.applicant_notes ?? null,
    agreed_to_terms: input.agreed_to_terms ?? false,
    agreed_to_original_work: input.agreed_to_original_work ?? false,
    agreed_to_manual_review: input.agreed_to_manual_review ?? false,
    agreed_to_age_and_capacity: input.agreed_to_age_and_capacity ?? false,
    twitch_status: input.twitch_status ?? null,
    twitch_follower_count: input.twitch_follower_count ?? null,
    youtube_subscriber_count: input.youtube_subscriber_count ?? null,
    offering_types: input.offering_types ?? [],
    submitted_at:
      input.status === "submitted"
        ? input.submitted_at ?? now
        : input.submitted_at ?? null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("seller_applications")
    .upsert(patch, {
      onConflict: "profile_user_id",
    })
    .select()
    .maybeSingle();

  if (error) throw error;

  return data;
};

// Mutation hook for the current user's seller application
export const useUpsertMySellerApplication = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertSellerApplicationInput) => {
      if (!user?.id) throw new Error("You must be signed in.");
      return upsertMySellerApplication(user.id, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["mySellerApplication", user?.id],
      });
    },
  });
};