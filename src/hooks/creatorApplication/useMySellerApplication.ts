import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type SellerApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "needs_changes"
  | "suspended";

export type TwitchStatus = "none" | "affiliate" | "partner";

export type SellerApplicationRow = {
  id: string;
  profile_user_id: string;

  status: SellerApplicationStatus;

  applicant_notes: string | null;
  agreed_to_terms: boolean;
  agreed_to_original_work: boolean;
  agreed_to_manual_review: boolean;
  agreed_to_age_and_capacity: boolean;

  // The applicant's own numbers (20261110_193); checked by hand at review.
  twitch_status: TwitchStatus | null;
  twitch_follower_count: number | null;
  youtube_subscriber_count: number | null;

  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;

  reviewer_notes: string | null;
  rejection_reason: string | null;

  created_at: string;
  updated_at: string;
};

// Loads the signed-in user's seller application
const fetchMySellerApplication = async (
  userId: string
): Promise<SellerApplicationRow | null> => {
  const { data, error } = await supabase
    .from("seller_applications")
    .select(`
  id,
  profile_user_id,
  status,
  applicant_notes,
  agreed_to_terms,
  agreed_to_original_work,
  agreed_to_manual_review,
  agreed_to_age_and_capacity,
  twitch_status,
  twitch_follower_count,
  youtube_subscriber_count,
  submitted_at,
  reviewed_at,
  reviewed_by,
  reviewer_notes,
  rejection_reason,
  created_at,
  updated_at
`)
    .eq("profile_user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return (data as SellerApplicationRow | null) ?? null;
};

// Returns the current signed-in user's seller application
export const useMySellerApplication = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<SellerApplicationRow | null>({
    queryKey: ["mySellerApplication", userId],
    enabled: !loading && Boolean(userId),
    staleTime: 30_000,
    queryFn: () =>
      userId ? fetchMySellerApplication(userId) : Promise.resolve(null),
  });
};