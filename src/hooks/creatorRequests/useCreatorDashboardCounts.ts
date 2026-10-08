import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

export type CreatorDashboardCounts = {
  newRequests: number;
  inProgress: number;
  completed: number;
  liveListings: number;
  draftListings: number;
};

// The numbers on the creator dashboard. Each is a count the database works
// out from an index; no commission or listing rows are downloaded for them,
// however many the creator has.
const fetchCreatorDashboardCounts = async (userId: string): Promise<CreatorDashboardCounts> => {
  const requests = (status: string) =>
    supabase
      .from("listing_requests")
      .select("id", { count: "exact", head: true })
      .eq("creator_user_id", userId)
      .eq("status", status);

  const listings = () =>
    supabase.from("listings").select("id", { count: "exact", head: true }).eq("user_id", userId);

  const results = await Promise.all([
    requests("submitted"),
    requests("accepted"),
    requests("completed"),
    listings().eq("status", "published").eq("is_active", true),
    listings().eq("status", "draft"),
  ]);

  const failed = results.find((result) => result.error);

  if (failed?.error) throw failed.error;

  const [newRequests, inProgress, completed, liveListings, draftListings] = results.map(
    (result) => result.count ?? 0,
  );

  return { newRequests, inProgress, completed, liveListings, draftListings };
};

export const useCreatorDashboardCounts = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<CreatorDashboardCounts>({
    queryKey: ["creatorDashboardCounts", userId],
    enabled: !loading && Boolean(userId),
    queryFn: () => fetchCreatorDashboardCounts(userId as string),
    staleTime: 30_000,
  });
};
