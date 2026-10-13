import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

// Whether this person asked to be shown what is new after an update, and the
// last version they were shown (public.user_site_update_preferences,
// 20261012_161). No row means no. Nothing here sends email.

export type SiteUpdatePreference = {
  showSiteUpdates: boolean;
  lastSeenVersion: string | null;
};

const fetchPreference = async (userId: string): Promise<SiteUpdatePreference> => {
  const { data, error } = await supabase
    .from("user_site_update_preferences")
    .select("show_site_updates, last_seen_version")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return {
    showSiteUpdates: Boolean(data?.show_site_updates),
    lastSeenVersion: (data?.last_seen_version as string | null | undefined) ?? null,
  };
};

// For the checkbox in Settings: always the current choice.
export const useSiteUpdatePreference = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: ["siteUpdatePreference", userId],
    enabled: !loading && Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchPreference(userId as string),
  });
};

// For the window: the choice as it stood when this person signed in or
// opened the site. It is read once and never refreshed, so ticking the box
// in Settings does not make the window pop up in the middle of a visit; it
// appears the next time they sign in.
export const useSiteUpdatePreferenceAtSignIn = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: ["siteUpdatePreferenceAtSignIn", userId],
    enabled: !loading && Boolean(userId),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: () => fetchPreference(userId as string),
  });
};

export const useSaveSiteUpdatePreference = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (showSiteUpdates: boolean) => {
      if (!user?.id) throw new Error("You must be signed in to change this setting.");

      const { error } = await supabase
        .from("user_site_update_preferences")
        .upsert({ user_id: user.id, show_site_updates: showSiteUpdates }, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["siteUpdatePreference", user?.id ?? null] }),
  });
};

// Records that this version's changes were shown, so they are shown once.
export const useMarkSiteUpdatesSeen = () => {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (version: string) => {
      if (!user?.id) return;

      const { error } = await supabase
        .from("user_site_update_preferences")
        .upsert({ user_id: user.id, last_seen_version: version }, { onConflict: "user_id" });

      if (error) throw error;
    },
  });
};
