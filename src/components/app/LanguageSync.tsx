import { useEffect } from "react";

import { useDisplayPreferences } from "../../hooks/money/useDisplayCurrency";
import { setCurrentLanguage } from "../../lib/i18n/i18n";
import { resolveLanguage } from "../../lib/i18n/languages";

// Keeps the page's language in step with the saved choice (or the browser's
// language, for a visitor) and tells the browser and screen readers which
// language the page is in. Rendered once, in the layout. Draws nothing.
const LanguageSync = () => {
  const { data: preferences } = useDisplayPreferences();
  const language = resolveLanguage(
    preferences?.language,
    typeof navigator === "undefined" ? [] : navigator.languages,
  );

  useEffect(() => {
    setCurrentLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  return null;
};

export default LanguageSync;
