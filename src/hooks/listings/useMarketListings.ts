import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { ProfilePlatformAccountRow } from "../profile/useProfilePlatformAccounts";

export type MarketListingRow = {
  id: string;
  user_id: string;
  title: string;
  short: string;
  offering_type: string;
  fulfilment_mode: "request" | "instant";
  category: string;
  video_subtype: string | null;
  price_type: "fixed" | "starting_at" | "range";
  price_min: number;
  price_max: number | null;
  currency: string;
  deliverables: string[];
  tags: string[];
  preview_url: string | null;
  status: string;
  is_active: boolean;
  is_free: boolean;
  free_delivery_type: "download" | "external_link" | null;
  free_external_url: string | null;
  free_file_path: string | null;
  free_file_name: string | null;
};

export type MarketCreatorRow = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type MarketListingItem = {
  listing: MarketListingRow;
  creator: MarketCreatorRow | null;
  platformAccounts: ProfilePlatformAccountRow[];
};

const emptyResult: MarketListingItem[] = [];

const fetchMarketListings = async (): Promise<MarketListingItem[]> => {
  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select(`
      id,
      user_id,
      title,
      short,
      offering_type,
      category,
      video_subtype,
      price_type,
      price_min,
      price_max,
      currency,
      deliverables,
      tags,
      preview_url,
      status,
      is_active,
      fulfilment_mode,
      is_free,
      free_delivery_type,
      free_external_url,
      free_file_path,
      free_file_name
    `)
    .eq("status", "published")
    .eq("is_active", true)
    .is("admin_hidden_at", null)
    .order("created_at", { ascending: false });

  if (listingsError) throw listingsError;

  const listingRows = (listings ?? []) as MarketListingRow[];
  if (listingRows.length === 0) return emptyResult;

  const userIds = Array.from(new Set(listingRows.map((listing) => listing.user_id)));

  const [
    { data: profiles, error: profilesError },
    { data: platformAccounts, error: platformAccountsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, handle, display_name, avatar_url")
      .in("user_id", userIds),

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
  ]);

  if (profilesError) throw profilesError;
  if (platformAccountsError) throw platformAccountsError;

  const creatorByUserId = Object.fromEntries(
    ((profiles ?? []) as MarketCreatorRow[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, MarketCreatorRow>;

  const platformAccountsByUserId = ((platformAccounts ?? []) as ProfilePlatformAccountRow[])
    .reduce<Record<string, ProfilePlatformAccountRow[]>>((acc, account) => {
      const key = account.profile_user_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(account);
      return acc;
    }, {});

  return listingRows.map((listing) => ({
    listing,
    creator: creatorByUserId[listing.user_id] ?? null,
    platformAccounts: platformAccountsByUserId[listing.user_id] ?? [],
  }));
};

export const useMarketListings = () =>
  useQuery<MarketListingItem[]>({
    queryKey: ["marketListings"],
    queryFn: fetchMarketListings,
    staleTime: 30_000,
  });