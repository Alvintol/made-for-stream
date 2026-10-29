import { useCallback, useSyncExternalStore } from "react";

import { DEFAULT_LANGUAGE, resolveLanguage, type LanguageCode } from "./languages";
import { en, type Message, type MessageKey } from "./messages/en";
import { fr } from "./messages/fr";

// ponytail: both languages are bundled. Load French on demand once its
// strings grow large enough to matter for page weight.
const messages: Record<LanguageCode, Record<MessageKey, Message>> = { en, fr };

export type TranslationValues = Record<string, string | number>;

// Whether a key exists, for keys built from data (a listing's category or
// type): an unknown value is shown as it is instead.
export const hasMessage = (key: string): key is MessageKey => key in en;

// "{name}" in a message is replaced by values.name. A plural message picks
// its form from values.count by the language's own plural rules.
export const translate = (
  language: LanguageCode,
  key: MessageKey,
  values: TranslationValues = {},
): string => {
  const message = messages[language][key] ?? en[key];

  // Only reachable with a key built from data; hasMessage() guards those.
  if (message === undefined) return key;

  const text =
    typeof message === "string"
      ? message
      : (message[new Intl.PluralRules(language).select(Number(values.count ?? 0)) as keyof typeof message] ??
        message.other);

  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
};

// A translator for code outside components. Shared helpers take one and
// default to English, so callers that are not translated yet are unchanged.
export type Translate = (key: MessageKey, values?: TranslationValues) => string;
export const english: Translate = (key, values) => translate("en", key, values);

// The language the site is shown in right now. One value for the whole page,
// set by <LanguageSync /> from the saved choice; a guess from the browser
// until then.
let currentLanguage: LanguageCode = resolveLanguage(
  null,
  typeof navigator === "undefined" ? [] : navigator.languages,
);
const listeners = new Set<() => void>();

export const setCurrentLanguage = (language: LanguageCode) => {
  if (language === currentLanguage) return;

  currentLanguage = language;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  return () => listeners.delete(listener);
};

export const useLanguage = (): LanguageCode =>
  useSyncExternalStore(subscribe, () => currentLanguage, () => DEFAULT_LANGUAGE);

// t("nav.market"), t("nav.unread", { count: 3 }).
export const useT = () => {
  const language = useLanguage();

  return useCallback(
    (key: MessageKey, values?: TranslationValues) => translate(language, key, values),
    [language],
  );
};
