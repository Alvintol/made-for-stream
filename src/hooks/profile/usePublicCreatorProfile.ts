import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { ProfilePlatformAccountRow } from "./useProfilePlatformAccounts";

export type PublicCreatorProfile = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export type PublicCreatorListing = {
  id: string;
  user_id: string;
  title: string;
  short: string;
  preview_url: string | null;
  offering_type: string;
  category: string;
  video_subtype: string | null;
  price_type: "fixed" | "starting_at" | "range";
  price_min: number;
  price_max: number | null;
  currency: string;
  deliverables: string[];
  tags: string[];
  status: string;
  is_active: boolean;
};

export type PublicCreatorProfilePayload = {
  profile: PublicCreatorProfile | null;
  platformAccounts: ProfilePlatformAccountRow[];
  listings: PublicCreatorListing[];
};

const emptyResult: PublicCreatorProfilePayload = {
  profile: null,
  platformAccounts: [],
  listings: [],
};

const fetchPublicCreatorProfile = async (
  handle: string
): Promise<PublicCreatorProfilePayload> => {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, bio, avatar_url")
    .eq("handle", handle)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile?.user_id) return emptyResult;

  const [
    { data: platformAccounts, error: platformError },
    { data: listings, error: listingsError },
  ] = await Promise.all([
    supabase
      .from("profile_platform_accounts")
      .select(`
        id,
        profile_user_id,
        platform,
        platform_user_id,
        platform_login,
        platform_display_name,
        profile_url,
        account_created_at,
        connected_at,
        last_activity_at,
        activity_checked_at,
        is_active_recently,
        metadata,
        created_at,
        updated_at
      `)
      .eq("profile_user_id", profile.user_id)
      .order("connected_at", { ascending: false }),

    supabase
      .from("listings")
      .select(`
        id,
        user_id,
        title,
        short,
        preview_url,
        offering_type,
        category,
        video_subtype,
        price_type,
        price_min,
        price_max,
        currency,
        deliverables,
        tags,
        status,
        is_active
      `)
      .eq("user_id", profile.user_id)
      .eq("status", "published")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  if (platformError) throw platformError;
  if (listingsError) throw listingsError;

  return {
    profile: profile as PublicCreatorProfile,
    platformAccounts: (platformAccounts ?? []) as ProfilePlatformAccountRow[],
    listings: (listings ?? []) as PublicCreatorListing[],
  };
};

export const usePublicCreatorProfile = (handle: string | null) =>
  useQuery<PublicCreatorProfilePayload>({
    queryKey: ["publicCreatorProfile", handle],
    enabled: Boolean(handle),
    queryFn: () => (handle ? fetchPublicCreatorProfile(handle) : Promise.resolve(emptyResult)),
    staleTime: 30_000,
  });