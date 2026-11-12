import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";

export type AdminApplicantProfileRow = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  offering_types: string[] | null;
  offering_other: string | null;
};

const fetchAdminApplicantProfile = async (
  userId: string
): Promise<AdminApplicantProfileRow | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      user_id,
      handle,
      display_name,
      avatar_url,
      offering_types,
      offering_other
    `)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return (data as AdminApplicantProfileRow | null) ?? null;
};

export const useAdminApplicantProfile = (userId: string | null) => {
  return useQuery<AdminApplicantProfileRow | null>({
    queryKey: ["adminApplicantProfile", userId],
    enabled: Boolean(userId),
    staleTime: 15_000,
    queryFn: () =>
      userId ? fetchAdminApplicantProfile(userId) : Promise.resolve(null),
  });
};