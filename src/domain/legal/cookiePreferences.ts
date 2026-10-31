import { getAdsenseConfig } from "../ads/ads";
import { cookiePolicyVersion } from "./cookiePolicy";
// Optional categories from Cookie Policy section 3. Necessary categories
// (sign-in sessions, requested payments, and remembering this choice) are not
// listed: they do not need consent and cannot be switched off here.
export type OptionalCookieCategory =
  | "preferences"
  | "analytics"
  | "advertising"
  | "externalMedia";

export type OptionalCookieCategoryInfo = {
  key: OptionalCookieCategory;
  label: string;
  description: string;
};

export const optionalCookieCategoryInfo: OptionalCookieCategoryInfo[] = [
  {
    key: "preferences",
    label: "Optional preferences",
    description: "Remembers non-essential customisation.",
  },
  {
    key: "analytics",
    label: "Analytics",
    description: "Measures how the product is used, beyond necessary operational logging.",
  },
  {
    key: "advertising",
    label: "Advertising",
    description: "Tracks or profiles for advertising or advertising measurement.",
  },
  {
    key: "externalMedia",
    label: "External media",
    description: "Loads third-party players or similar features that store data or track you.",
  },
];

// Optional categories Made for Stream actually uses. Empty today: nothing optional
// is active (Cookie Policy section 3), so visitors are not asked anything.
// Add a category here when a feature that needs it ships. Every visitor is
// then asked again, because a new purpose is not covered by an earlier
// choice (section 6). Advertising turns on with the AdSense publisher id.
export const activeOptionalCookieCategories: OptionalCookieCategory[] = getAdsenseConfig()
  ? ["advertising"]
  : [];

export type CookieCategoryChoices = Record<OptionalCookieCategory, boolean>;

export type CookiePreferences = {
  policyVersion: string;
  // Categories that were active, and so actually offered, when the choice
  // was made. Consent never extends to a category that was not offered.
  offeredCategories: OptionalCookieCategory[];
  categories: CookieCategoryChoices;
  decidedAt: number;
  expiresAt: number;
};

// Every optional category starts off; nothing is preselected (section 4).
export const noOptionalCategories: CookieCategoryChoices = {
  preferences: false,
  analytics: false,
  advertising: false,
  externalMedia: false,
};

// Choices are remembered for up to six months (section 4).
const CHOICE_LIFETIME_MONTHS = 6;

const addMonths = (timestamp: number, months: number): number => {
  const date = new Date(timestamp);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.getTime();
};

export const createCookiePreferences = (
  choices: CookieCategoryChoices,
  offeredCategories: OptionalCookieCategory[],
  now: number = Date.now(),
): CookiePreferences => ({
  policyVersion: cookiePolicyVersion,
  offeredCategories: [...offeredCategories],
  // A category that was not offered cannot be accepted.
  categories: {
    preferences: choices.preferences && offeredCategories.includes("preferences"),
    analytics: choices.analytics && offeredCategories.includes("analytics"),
    advertising: choices.advertising && offeredCategories.includes("advertising"),
    externalMedia: choices.externalMedia && offeredCategories.includes("externalMedia"),
  },
  decidedAt: now,
  expiresAt: addMonths(now, CHOICE_LIFETIME_MONTHS),
});

export const acceptOfferedCategories = (
  offeredCategories: OptionalCookieCategory[],
): CookieCategoryChoices => ({
  preferences: offeredCategories.includes("preferences"),
  analytics: offeredCategories.includes("analytics"),
  advertising: offeredCategories.includes("advertising"),
  externalMedia: offeredCategories.includes("externalMedia"),
});

// A stored choice stops counting when it expires or the policy version
// changes.
export const isCookieChoiceCurrent = (
  preferences: CookiePreferences | null,
  now: number = Date.now(),
): preferences is CookiePreferences =>
  Boolean(preferences) &&
  preferences?.policyVersion === cookiePolicyVersion &&
  now < (preferences?.expiresAt ?? 0);

// Visitors are asked only when an optional category is active and they have
// no current choice that covered it.
export const needsCookieChoice = (
  preferences: CookiePreferences | null,
  activeCategories: OptionalCookieCategory[],
  now: number = Date.now(),
): boolean => {
  if (activeCategories.length === 0) return false;
  if (!isCookieChoiceCurrent(preferences, now)) return true;

  return activeCategories.some(
    (category) => !preferences.offeredCategories.includes(category),
  );
};

// The one check optional features should use before running.
export const hasCookieConsent = (
  preferences: CookiePreferences | null,
  category: OptionalCookieCategory,
  now: number = Date.now(),
): boolean =>
  isCookieChoiceCurrent(preferences, now) &&
  preferences.offeredCategories.includes(category) &&
  preferences.categories[category] === true;
