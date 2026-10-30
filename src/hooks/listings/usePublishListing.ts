import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useT } from "../../lib/i18n/i18n";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import { requireCreatorPaymentAccountReadyForPublishing } from "./listingPaymentAccountGuards";

export const usePublishListing = () => {
  const t = useT();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (listingId: string) => {
      if (!user?.id) {
        throw new Error("You must be signed in to publish a listing.");
      }

      await requireCreatorPaymentAccountReadyForPublishing(user.id, listingId);

      const { data, error } = await supabase
        .from("listings")
        .update({
          status: "published",
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", listingId)
        .eq("user_id", user.id)
        .eq("status", "draft")
        .eq("is_active", false)
        .is("admin_hidden_at", null)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data?.id) {
        throw new Error(t("listingDetails.publishRefused"));
      }

      return data.id as string;
    },
    onSuccess: async (listingId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["myListings", user?.id ?? null],
        }),
        queryClient.invalidateQueries({
          queryKey: ["myListing", user?.id ?? null, listingId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["marketListings"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["publicListing", listingId],
        }),
      ]);
    },
  });
};