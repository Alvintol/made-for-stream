// The languages the site can be shown in. Matches the check on
// user_display_preferences.language (20261029_173).
//
// A language stays "not ready" until every screen and every policy is
// translated: until then it is offered only on a local development server,
// or where VITE_OFFER_UNFINISHED_LANGUAGES is "true" (the dev website), so
// nobody else sees half-translated pages. Quebec stays blocked
// (20261029_171) until French is ready.
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", ready: true },
  { code: "fr", name: "Français", ready: false },
  { code: "es", name: "Español", ready: false },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "en";

const offerUnfinished =
  import.meta.env.DEV || import.meta.env.VITE_OFFER_UNFINISHED_LANGUAGES === "true";

export const OFFERED_LANGUAGES = SUPPORTED_LANGUAGES.filter(
  (language) => language.ready || offerUnfinished,
);

const isOffered = (code: string | null | undefined): code is LanguageCode =>
  OFFERED_LANGUAGES.some((language) => language.code === code);

// The saved choice if it is offered, else the first offered language the
// browser asks for ("fr-CA" counts as French, "es-US" as Spanish), else English.
export const resolveLanguage = (
  saved: string | null | undefined,
  browserLanguages: readonly string[],
): LanguageCode => {
  if (isOffered(saved)) return saved;

  for (const tag of browserLanguages) {
    const code = tag.toLowerCase().split("-")[0];

    if (isOffered(code)) return code;
  }

  return DEFAULT_LANGUAGE;
};
