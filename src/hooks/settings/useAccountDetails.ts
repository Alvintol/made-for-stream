import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccountDetails } from "../../domain/settings/accountDetails";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";

const COLUMNS =
  "account_type, legal_first_name, legal_last_name, date_of_birth, address_line1, address_line2, city, region, postal_code, country_code, business_legal_name, business_registration_number, tax_number";

// The signed-in person's private account details, or null when they have
// not filled them in yet. A row only exists once it is complete
// (public.user_account_details, 20261008_150).
export const useAccountDetails = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<AccountDetails | null>({
    queryKey: ["accountDetails", userId],
    enabled: !loading && Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_account_details")
        .select(COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      return (data ?? null) as AccountDetails | null;
    },
  });
};

export const useSaveAccountDetails = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (details: AccountDetails) => {
      if (!user?.id) throw new Error("You must be signed in to save your account details.");

      const { error } = await supabase
        .from("user_account_details")
        .upsert({ user_id: user.id, ...details }, { onConflict: "user_id" });

      // The database's own messages are written for the person reading them.
      if (error) throw new Error(error.message);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accountDetails", user?.id ?? null] }),
        // Saving copies the country to the display preferences.
        queryClient.invalidateQueries({ queryKey: ["displayPreferences", user?.id ?? null] }),
      ]),
  });
};

// Whether the person has opted in to promotional email. No row means no.
export const useMarketingEmails = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<boolean>({
    queryKey: ["marketingEmails", userId],
    enabled: !loading && Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_email_preferences")
        .select("marketing_emails")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      return Boolean(data?.marketing_emails);
    },
  });
};

export const useSaveMarketingEmails = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (marketingEmails: boolean) => {
      if (!user?.id) throw new Error("You must be signed in to change email preferences.");

      const { error } = await supabase
        .from("user_email_preferences")
        .upsert({ user_id: user.id, marketing_emails: marketingEmails }, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["marketingEmails", user?.id ?? null] }),
  });
};
