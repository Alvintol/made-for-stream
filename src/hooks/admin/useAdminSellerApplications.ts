import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { SellerApplicationRow, SellerApplicationStatus } from "../creatorApplication/useMySellerApplication";

type UseAdminSellerApplicationsOptions = {
  statuses?: SellerApplicationStatus[];
};

const defaultStatuses: SellerApplicationStatus[] = [
  "submitted",
  "under_review",
  "needs_changes",
];

const fetchAdminSellerApplications = async (
  statuses: SellerApplicationStatus[]
): Promise<SellerApplicationRow[]> => {
  const { data, error } = await supabase
    .from("seller_applications")
    .select(`
      id,
      profile_user_id,
      status,
      twitch_status,
      twitch_follower_count,
      youtube_subscriber_count,
      submitted_at,
      reviewed_at,
      reviewer_notes,
      rejection_reason,
      created_at,
      updated_at
    `)
    .in("status", statuses)
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []) as SellerApplicationRow[];
};

export const useAdminSellerApplications = (
  options?: UseAdminSellerApplicationsOptions
) => {
  const statuses = options?.statuses ?? defaultStatuses;

  return useQuery<SellerApplicationRow[]>({
    queryKey: ["adminSellerApplications", statuses],
    staleTime: 15_000,
    queryFn: () => fetchAdminSellerApplications(statuses),
  });
};