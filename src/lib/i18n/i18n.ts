import { useCallback, useSyncExternalStore } from "react";

import { DEFAULT_LANGUAGE, resolveLanguage, type LanguageCode } from "./languages";
import { en, type Message, type MessageKey } from "./messages/en";

// English is always here, as the fallback for any missing text. The others are
// downloaded only by people reading them.
const messages: Partial<Record<LanguageCode, Record<MessageKey, Message>>> = { en };

export const loadLanguage = async (language: LanguageCode): Promise<void> => {
  if (language === "en" || messages[language]) return;

  messages[language] =
    language === "fr"
      ? (await import("./messages/fr")).fr
      : (await import("./messages/es")).es;
};
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
  const message = messages[language]?.[key] ?? en[key];

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

// A word for a value saved as a code (`category`, "emotes"). A value the lists
// do not know, such as an old one on a listing, is shown as written.
export const wordFor = (prefix: string, value: string, t: Translate): string => {
  const key = `${prefix}.${value}`;

  return hasMessage(key) ? t(key) : value.replace(/[_-]+/g, " ");
};

// The locale for a date on the page. English keeps the reader's own style
// (a.m. in Canada, 24-hour in the UK). Other languages use the reader's own
// variant when the browser asks for one: es-US keeps a 12-hour clock.
export const dateLocale = (language: LanguageCode): string | undefined => {
  if (language === DEFAULT_LANGUAGE) return undefined;

  const browser = typeof navigator === "undefined" ? [] : navigator.languages;

  return browser.find((tag) => tag.toLowerCase().startsWith(`${language}-`)) ?? language;
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
let wantedLanguage = currentLanguage;

const loadOrWarn = (language: LanguageCode) =>
  loadLanguage(language).catch((error: unknown) => {
    console.warn("PAGE-002: a language could not be downloaded, so English is showing.", error);
  });

// The browser's language, before the first page draws, so nobody sees English
// flash up first.
export const loadStartingLanguage = () => loadOrWarn(currentLanguage);

// Waits for the words before switching. If they cannot be downloaded the page
// shows English, which translate() falls back to.
export const setCurrentLanguage = async (language: LanguageCode) => {
  wantedLanguage = language;

  await loadOrWarn(language);

  if (language === currentLanguage || language !== wantedLanguage) return;

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
