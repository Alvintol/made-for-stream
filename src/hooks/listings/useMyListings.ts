import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type MyListingRow = {
  id: string;
  user_id: string;
  title: string;
  short: string;
  offering_type: "digital" | "commission" | "service";
  fulfilment_mode: "request" | "instant";
  instant_licence?: string | null;
  category: string;
  video_subtype: "long-form" | "short-form" | null;
  price_type: "fixed" | "starting_at" | "range";
  price_min: number;
  price_max: number | null;
  currency: string;
  deliverables: string[];
  tags: string[];
  preview_url: string | null;
  animated_preview_url: string | null;
  status: "draft" | "published";
  is_active: boolean;
  created_at: string;
  updated_at: string;
  admin_hidden_at: string | null;
  admin_hidden_by_user_id: string | null;
  admin_hidden_report_id: string | null;
};

// My listings shows this many at a time, most recently changed first.
export const MY_LISTINGS_PAGE_SIZE = 24;

export type MyListingsPage = { rows: MyListingRow[]; nextOffset: number | null };

const fetchMyListings = async (userId: string, offset: number): Promise<MyListingsPage> => {
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
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    // One more than a page, to know whether there is another.
    .range(offset, offset + MY_LISTINGS_PAGE_SIZE);

  if (error) throw error;

  const rows = (data ?? []) as MyListingRow[];
  const hasMore = rows.length > MY_LISTINGS_PAGE_SIZE;

  return {
    rows: hasMore ? rows.slice(0, MY_LISTINGS_PAGE_SIZE) : rows,
    nextOffset: hasMore ? offset + MY_LISTINGS_PAGE_SIZE : null,
  };
};

export const useMyListings = () => {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ["myListings", user?.id ?? null],
    enabled: Boolean(user?.id),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      user?.id
        ? fetchMyListings(user.id, pageParam)
        : Promise.resolve<MyListingsPage>({ rows: [], nextOffset: null }),
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    staleTime: 15_000,
  });
};