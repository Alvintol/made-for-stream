import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type MyListingRow = {
  id: string;
  user_id: string;
  title: string;
  short: string;
  offering_type: "digital" | "commission" | "service";
  fulfilment_mode: "request" | "instant";
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

const emptyResult: MyListingRow[] = [];

const fetchMyListings = async (userId: string): Promise<MyListingRow[]> => {
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
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as MyListingRow[];
};

export const useMyListings = () => {
  const { user } = useAuth();

  return useQuery<MyListingRow[]>({
    queryKey: ["myListings", user?.id ?? null],
    enabled: Boolean(user?.id),
    queryFn: () =>
      user?.id ? fetchMyListings(user.id) : Promise.resolve(emptyResult),
    staleTime: 15_000,
  });
};