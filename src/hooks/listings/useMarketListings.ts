import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { toPageOfRows, type PageOfRows } from "../../lib/pageOfRows";
import { supabase } from "../../lib/supabaseClient";

// A page of cards: enough to fill the screen a few times, and divisible by the
// grid's 2 and 3 columns so the last row is never left short.
export const MARKET_PAGE_SIZE = 24;

const FEATURED_COUNT = 6;

export type MarketListingRow = {
  id: string;
  user_id: string;
  title: string;
  short: string;
  offering_type: string;
  category: string;
  video_subtype: string | null;
  price_type: "fixed" | "starting_at" | "range";
  price_min: number;
  price_max: number | null;
  currency: string;
  preview_url: string | null;
  is_free: boolean;
  created_at: string;
  creator_handle: string | null;
  creator_name: string | null;
  twitch_login: string | null;
};

export type MarketFilters = {
  q: string;
  category: string | null;
  type: string | null;
  video: string | null;
  freeOnly: boolean;
};

type MarketCursor = { createdAt: string; id: string };

const noFilters: MarketFilters = {
  q: "",
  category: null,
  type: null,
  video: null,
  freeOnly: false,
};

// Search and filters run in the database, which returns one page of matches.
const fetchMarketPage = async (
  filters: MarketFilters,
  cursor: MarketCursor | null,
  pageSize: number
): Promise<PageOfRows<MarketListingRow, MarketCursor>> => {
  const { data, error } = await supabase.rpc("market_listings", {
    p_q: filters.q || null,
    p_category: filters.category,
    p_type: filters.type,
    p_video: filters.video,
    p_free_only: filters.freeOnly,
    p_after_created_at: cursor?.createdAt ?? null,
    p_after_id: cursor?.id ?? null,
    p_limit: pageSize,
  });

  if (error) throw error;

  return toPageOfRows((data ?? []) as MarketListingRow[], pageSize, (lastRow) => ({
    createdAt: lastRow.created_at,
    id: lastRow.id,
  }));
};

export const useMarketListings = (filters: MarketFilters) =>
  useInfiniteQuery({
    queryKey: ["marketListings", filters],
    queryFn: ({ pageParam }) => fetchMarketPage(filters, pageParam, MARKET_PAGE_SIZE),
    initialPageParam: null as MarketCursor | null,
    getNextPageParam: (lastPage) => lastPage.next,
    // The old results stay up while a new search loads.
    placeholderData: keepPreviousData,
    // Coming back to the tab would otherwise reload every page opened so far.
    refetchOnWindowFocus: false,
  });

// Until listings have a featured flag, the home page shows the newest.
export const useFeaturedListings = () =>
  useQuery<MarketListingRow[]>({
    queryKey: ["marketListings", "featured"],
    queryFn: async () => (await fetchMarketPage(noFilters, null, FEATURED_COUNT)).rows,
    staleTime: 5 * 60_000,
  });
