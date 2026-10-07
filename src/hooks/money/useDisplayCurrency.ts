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

// A signed-out visitor's choice. Held in memory only, so it lasts until the
// page is reloaded: keeping it longer means browser storage, and that needs
// an entry in the Cookie Policy's Storage Register first.
let guestPreferences: DisplayPreferences | null = null;

// The saved country and display currency. For a signed-in person it is
// private to them (user_display_preferences, 20261007_146); for a visitor
// it is whatever they picked on this page view.
export const useDisplayPreferences = () => {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  return useQuery<DisplayPreferences | null>({
    queryKey: ["displayPreferences", userId],
    enabled: !loading,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return guestPreferences;

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

  const mutation = useMutation({
    mutationFn: async (preferences: DisplayPreferences) => {
      if (!user?.id) {
        guestPreferences = preferences;
        return;
      }

      const { error } = await supabase
        .from("user_display_preferences")
        .upsert({ user_id: user.id, ...preferences }, { onConflict: "user_id" });

      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["displayPreferences", user?.id ?? null] }),
  });

  // isGuest: the choice will not outlive this page view.
  return { ...mutation, isGuest: !user };
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
