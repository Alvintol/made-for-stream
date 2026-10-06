import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import type { MyListingRow } from "../listings/useMyListings";

export type AdminListingCreator = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export type AdminListingsFilters = {
  q: string;
  creatorHandle: string;
  updatedFrom: string;
  updatedTo: string;
  offeringType: "all" | "digital" | "commission" | "service";
  priceType: "all" | "fixed" | "starting_at" | "range";
  minPrice: string;
  maxPrice: string;
  status: "all" | "draft" | "published";
  activeState: "all" | "active" | "inactive";
};

export type AdminListingItem = {
  listing: MyListingRow;
  creator: AdminListingCreator | null;
};

export type AdminListingsResult = {
  items: AdminListingItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type UseAdminListingsInput = {
  filters: AdminListingsFilters;
  page: number;
  pageSize?: number;
};

// Normalises a handle search so admins can search with or without @
const normaliseHandle = (value: string) => value.trim().replace(/^@+/, "");

// Cleans free-text search input for ilike filters
const normaliseSearchTerm = (value: string) =>
  value.trim().replace(/[,%()]/g, " ");

// Parses an integer filter while keeping empty input as null
const parseInteger = (value: string) => {
  if (!value.trim()) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

// Converts a YYYY-MM-DD input into the local start-of-day ISO timestamp
const toStartOfDayIso = (value: string) => {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

// Converts a YYYY-MM-DD input into the local end-of-day ISO timestamp
const toEndOfDayIso = (value: string) => {
  if (!value) return null;

  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const fetchAdminListings = async (
  input: UseAdminListingsInput
): Promise<AdminListingsResult> => {
  const { filters, page, pageSize = 25 } = input;

  const creatorHandle = normaliseHandle(filters.creatorHandle);
  let creatorUserIds: string[] | null = null;

  // Resolve creator handle filter first so listings can be narrowed by user_id
  if (creatorHandle) {
    const { data: matchingProfiles, error: matchingProfilesError } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("handle", `%${creatorHandle}%`);

    if (matchingProfilesError) {
      throw matchingProfilesError;
    }

    creatorUserIds = (matchingProfiles ?? [])
      .map((profile) => profile.user_id as string)
      .filter(Boolean);

    if (creatorUserIds.length === 0) {
      return {
        items: [],
        totalCount: 0,
        page,
        pageSize,
        pageCount: 0,
      };
    }
  }

  let query = supabase
    .from("listings")
    .select(
      `
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
        deliverables,
        tags,
        preview_url,
        status,
        is_active,
        created_at,
        updated_at
      `,
      { count: "exact" }
    )
    .order("updated_at", { ascending: false });

  const searchTerm = normaliseSearchTerm(filters.q);
  const updatedFrom = toStartOfDayIso(filters.updatedFrom);
  const updatedTo = toEndOfDayIso(filters.updatedTo);
  const minPrice = parseInteger(filters.minPrice);
  const maxPrice = parseInteger(filters.maxPrice);

  if (searchTerm) {
    const likeValue = `%${searchTerm}%`;

    query = query.or(
      `title.ilike.${likeValue},short.ilike.${likeValue},category.ilike.${likeValue}`
    );
  }

  if (creatorUserIds) {
    query = query.in("user_id", creatorUserIds);
  }

  if (updatedFrom) {
    query = query.gte("updated_at", updatedFrom);
  }

  if (updatedTo) {
    query = query.lte("updated_at", updatedTo);
  }

  if (filters.offeringType !== "all") {
    query = query.eq("offering_type", filters.offeringType);
  }

  if (filters.priceType !== "all") {
    query = query.eq("price_type", filters.priceType);
  }

  if (minPrice !== null) {
    query = query.gte("price_min", minPrice);
  }

  if (maxPrice !== null) {
    query = query.lte("price_min", maxPrice);
  }

  if (filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  if (filters.activeState === "active") {
    query = query.eq("is_active", true);
  }

  if (filters.activeState === "inactive") {
    query = query.eq("is_active", false);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: listings, error: listingsError, count } = await query.range(from, to);

  if (listingsError) {
    throw listingsError;
  }

  const listingRows = (listings ?? []) as MyListingRow[];
  const totalCount = count ?? 0;
  const pageCount = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

  if (listingRows.length === 0) {
    return {
      items: [],
      totalCount,
      page,
      pageSize,
      pageCount,
    };
  }

  const userIds = Array.from(new Set(listingRows.map((listing) => listing.user_id)));

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, avatar_url")
    .in("user_id", userIds);

  if (profilesError) {
    throw profilesError;
  }

  const creatorByUserId = Object.fromEntries(
    ((profiles ?? []) as AdminListingCreator[]).map((profile) => [
      profile.user_id,
      profile,
    ])
  ) as Record<string, AdminListingCreator>;

  return {
    items: listingRows.map((listing) => ({
      listing,
      creator: creatorByUserId[listing.user_id] ?? null,
    })),
    totalCount,
    page,
    pageSize,
    pageCount,
  };
};

export const useAdminListings = (input: UseAdminListingsInput) =>
  useQuery<AdminListingsResult>({
    queryKey: ["adminListings", input],
    queryFn: () => fetchAdminListings(input),
    staleTime: 15_000,
  });