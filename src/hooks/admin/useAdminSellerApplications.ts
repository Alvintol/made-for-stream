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

// The applicant's public name and handle, for the queue card.
export type AdminSellerApplicationRow = SellerApplicationRow & {
  applicant: { handle: string | null; display_name: string | null } | null;
};

const fetchAdminSellerApplications = async (
  statuses: SellerApplicationStatus[]
): Promise<AdminSellerApplicationRow[]> => {
  const { data, error } = await supabase
    .from("seller_applications")
    .select(`
      id,
      profile_user_id,
      status,
      twitch_status,
      twitch_follower_count,
      youtube_subscriber_count,
      offering_types,
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

  const rows = (data ?? []) as SellerApplicationRow[];
  const userIds = [...new Set(rows.map((row) => row.profile_user_id))];

  // One read for every applicant's name, not one per card.
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from("profiles").select("user_id, handle, display_name").in("user_id", userIds)
    : { data: [], error: null };

  if (profilesError) throw profilesError;

  const byUser = new Map(
    ((profiles ?? []) as Array<{ user_id: string; handle: string | null; display_name: string | null }>).map(
      (profile) => [profile.user_id, { handle: profile.handle, display_name: profile.display_name }],
    ),
  );

  return rows.map((row) => ({ ...row, applicant: byUser.get(row.profile_user_id) ?? null }));
};

export const useAdminSellerApplications = (
  options?: UseAdminSellerApplicationsOptions
) => {
  const statuses = options?.statuses ?? defaultStatuses;

  return useQuery<AdminSellerApplicationRow[]>({
    queryKey: ["adminSellerApplications", statuses],
    staleTime: 15_000,
    queryFn: () => fetchAdminSellerApplications(statuses),
  });
};