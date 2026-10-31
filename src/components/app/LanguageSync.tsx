import { useEffect } from "react";

import { useDisplayPreferences } from "../../hooks/money/useDisplayCurrency";
import { setCurrentLanguage } from "../../lib/i18n/i18n";
import { DEFAULT_LANGUAGE, resolveLanguage } from "../../lib/i18n/languages";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
// Keeps the page's language in step with the saved choice (or the browser's
// language, for a visitor) and tells the browser and screen readers which
// language the page is in. Rendered once, in the layout. Draws nothing.
//
// Someone who never chose a language follows their browser, which the API
// cannot see: it is saved so their emails can match. Best effort, and an
// English reader is never written (nothing saved means English).
const LanguageSync = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: preferences } = useDisplayPreferences();
  const language = resolveLanguage(
    preferences?.language,
    typeof navigator === "undefined" ? [] : navigator.languages,
  );

  useEffect(() => {
    setCurrentLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!userId || preferences === undefined || preferences?.language) return;
    if (language === (preferences?.browser_language ?? DEFAULT_LANGUAGE)) return;

    void supabase
      .from("user_display_preferences")
      .upsert({ user_id: userId, browser_language: language }, { onConflict: "user_id" });
  }, [language, preferences, userId]);
  return null;
};

export default LanguageSync;
