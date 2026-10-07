import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import type { MyListingRow } from "./useMyListings";

const fetchMyListing = async (
  userId: string,
  id: string
): Promise<MyListingRow | null> => {
  const { data, error } = await supabase
    .from("listings")
    .select(`
      id,
      user_id,
      title,
      short,
      offering_type,
      fulfilment_mode,
      category,
      video_subtype,
      price_type,
      price_min,
      price_max,
      currency,
      deliverables,
      tags,
      preview_url,
      animated_preview_url,
      status,
      is_active,
      created_at,
      updated_at,
      admin_hidden_at,
      admin_hidden_by_user_id,
      admin_hidden_report_id
    `)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return (data ?? null) as MyListingRow | null;
};

export const useMyListing = (id: string | null) => {
  const { user } = useAuth();

  return useQuery<MyListingRow | null>({
    queryKey: ["myListing", user?.id ?? null, id],
    enabled: Boolean(user?.id && id),
    queryFn: () =>
      user?.id && id
        ? fetchMyListing(user.id, id)
        : Promise.resolve(null),
    staleTime: 15_000,
  });
};