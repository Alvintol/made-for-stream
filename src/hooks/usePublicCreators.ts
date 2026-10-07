import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import type { ProfilePlatformAccountRow } from "./profile/useProfilePlatformAccounts";
import type { PublicCreatorListing, PublicCreatorProfile } from "./profile/usePublicCreatorProfile";

export type PublicCreatorItem = {
  profile: PublicCreatorProfile;
  platformAccounts: ProfilePlatformAccountRow[];
  listings: PublicCreatorListing[];
};

const emptyResult: PublicCreatorItem[] = [];

const fetchPublicCreators = async (): Promise<PublicCreatorItem[]> => {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, bio, avatar_url")
    .not("handle", "is", null)
    .order("handle", { ascending: true });

  if (profilesError) throw profilesError;

  const profileRows = (profiles ?? []) as PublicCreatorProfile[];
  if (profileRows.length === 0) return emptyResult;

  const userIds = profileRows.map((profile) => profile.user_id);

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
      .in("profile_user_id", userIds)
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
      .in("user_id", userIds)
      .eq("status", "published")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
  ]);

  if (platformError) throw platformError;
  if (listingsError) throw listingsError;

  const platformAccountsByUserId = ((platformAccounts ?? []) as ProfilePlatformAccountRow[])
    .reduce<Record<string, ProfilePlatformAccountRow[]>>((acc, account) => {
      const key = account.profile_user_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(account);
      return acc;
    }, {});

  const listingsByUserId = ((listings ?? []) as PublicCreatorListing[])
    .reduce<Record<string, PublicCreatorListing[]>>((acc, listing) => {
      const key = listing.user_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(listing);
      return acc;
    }, {});

  return profileRows.map((profile) => ({
    profile,
    platformAccounts: platformAccountsByUserId[profile.user_id] ?? [],
    listings: listingsByUserId[profile.user_id] ?? [],
  }));
};

export const usePublicCreators = () =>
  useQuery<PublicCreatorItem[]>({
    queryKey: ["publicCreators"],
    queryFn: fetchPublicCreators,
    staleTime: 30_000,
  });