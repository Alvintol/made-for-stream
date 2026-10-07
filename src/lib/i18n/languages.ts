// The languages the site can be shown in. English is the only one so far.
//
// ponytail: this list is the whole foundation. There is no translation
// library and no extracted strings yet. When a second language is added:
// store the choice beside display_currency (user_display_preferences),
// set <html lang>, and load that language's strings.
export const SUPPORTED_LANGUAGES = [{ code: "en", name: "English" }] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: LanguageCode = "en";
