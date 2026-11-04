import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { GuideFacts, GuideProgress } from "../../domain/guide/guide";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import { useSellerAccess } from "../creatorApplication/useSellerAccess";
import {
  getCreatorPaymentAccountIsReady,
  useCreatorPaymentAccount,
} from "../payments/useCreatorPaymentAccount";

// What the guide ticks off: setup facts the site already reads, plus
// my_guide_progress() for what the account has done (migration 188).
export const useGuideFacts = (): { facts: GuideFacts; isLoading: boolean } => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;
  const access = useSellerAccess();
  const paymentAccount = useCreatorPaymentAccount();

  const progress = useQuery({
    queryKey: ["guideProgress", userId],
    enabled: !loading && Boolean(userId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_guide_progress");
      if (error) throw error;
      return data as GuideProgress;
    },
  });

  return {
    isLoading: loading || access.isLoading || (Boolean(userId) && progress.isLoading),
    facts: {
      signedIn: Boolean(userId),
      isCreator: access.isCreatorApproved,
      profileReady: access.profileReady,
      applicationStatus: access.sellerApplication?.status ?? null,
      payoutsReady: getCreatorPaymentAccountIsReady(paymentAccount.data ?? null),
      progress: progress.data ?? null,
    },
  };
};

const welcomeKey = (userId: string | null) => ["guideWelcomeSeen", userId];

// Whether this person has closed the welcome window, on any device.
export const useGuideWelcomeSeen = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery({
    queryKey: welcomeKey(userId),
    enabled: !loading && Boolean(userId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_site_update_preferences")
        .select("guide_welcome_seen_at")
        .eq("user_id", userId as string)
        .maybeSingle();

      if (error) throw error;
      return Boolean(data?.guide_welcome_seen_at);
    },
  });
};

export const useMarkGuideWelcomeSeen = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  return useMutation({
    mutationFn: async () => {
      if (!userId) return;

      const { error } = await supabase
        .from("user_site_update_preferences")
        .upsert(
          { user_id: userId, guide_welcome_seen_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );

      if (error) throw error;
    },
    // Closed straight away; a failed save only means it shows once more.
    onMutate: () => queryClient.setQueryData(welcomeKey(userId), true),
  });
};
