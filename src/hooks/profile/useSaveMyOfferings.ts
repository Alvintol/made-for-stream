import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getOfferingsError,
  toOfferingsPatch,
  type ApplicationOffering,
} from "../../domain/creatorApplication/creatorApplication";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

// Saves what the signed-in person offers on their profile (20261112_197).
// The database refuses an unknown answer, or "other" without a description.
export const useSaveMyOfferings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ offerings, other }: { offerings: ApplicationOffering[]; other: string }) => {
      if (!user?.id) throw new Error("You must be signed in.");

      const problem = getOfferingsError(offerings, other);
      if (problem) throw new Error(problem);

      const { error } = await supabase
        .from("profiles")
        .update(toOfferingsPatch(offerings, other))
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["myProfile", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["publicCreatorProfile"] }),
      ]);
    },
  });
};
