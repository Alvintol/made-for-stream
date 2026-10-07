import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { resolveDisplayCurrency, type ExchangeRates } from "../../lib/money/displayCurrency";
import { useAuth } from "../../providers/AuthProvider";

export type DisplayPreferences = {
  country_code: string | null;
  display_currency: string | null;
};

const getApiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

// The day's reference rates, from our own API. A failure is not an error
// worth showing: without rates, pages show creators' real prices only.
export const useExchangeRates = () =>
  useQuery<ExchangeRates | null>({
    queryKey: ["exchangeRates"],
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      try {
        const response = await fetch(`${getApiBase()}/api/exchange-rates`);

        return response.ok ? ((await response.json()) as ExchangeRates) : null;
      } catch {
        return null;
      }
    },
  });

// The signed-in person's saved country and display currency. Private to
// them (user_display_preferences, 20261007_146).
export const useDisplayPreferences = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<DisplayPreferences | null>({
    queryKey: ["displayPreferences", userId],
    enabled: !loading && Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("user_display_preferences")
        .select("country_code, display_currency")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      return (data ?? null) as DisplayPreferences | null;
    },
  });
};

export const useSaveDisplayPreferences = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: DisplayPreferences) => {
      if (!user?.id) {
        throw new Error("You must be signed in to save this.");
      }

      const { error } = await supabase
        .from("user_display_preferences")
        .upsert({ user_id: user.id, ...preferences }, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["displayPreferences", user?.id ?? null] }),
  });
};

// What a page needs to show approximate prices: the currency to show them
// in (null means "don't convert") and the rates to convert with.
export const useDisplayCurrency = (): {
  displayCurrency: string | null;
  rates: ExchangeRates | null;
} => {
  const { data: preference } = useDisplayPreferences();
  const { data: rates } = useExchangeRates();

  return {
    displayCurrency: resolveDisplayCurrency({
      preference,
      browserLanguages: typeof navigator === "undefined" ? [] : navigator.languages,
    }),
    rates: rates ?? null,
  };
};
