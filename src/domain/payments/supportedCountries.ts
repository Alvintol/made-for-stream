// The countries a creator can connect a payout account in, each with its
// local currency. Mirrors api/supportedCountries.js, which is what refuses
// anything else and explains how the list is chosen;
// supportedCountriesSync.test.ts keeps the two aligned.

export const SUPPORTED_PAYOUT_COUNTRIES = {
  AT: "eur",
  AU: "aud",
  BE: "eur",
  BG: "eur",
  CA: "cad",
  CH: "chf",
  CY: "eur",
  DE: "eur",
  DK: "dkk",
  EE: "eur",
  ES: "eur",
  FI: "eur",
  FR: "eur",
  GB: "gbp",
  GR: "eur",
  HK: "hkd",
  HR: "eur",
  IE: "eur",
  IT: "eur",
  LI: "chf",
  LT: "eur",
  LU: "eur",
  LV: "eur",
  MT: "eur",
  MX: "mxn",
  NL: "eur",
  NO: "nok",
  NZ: "nzd",
  PL: "pln",
  PT: "eur",
  SE: "sek",
  SG: "sgd",
  SI: "eur",
  SK: "eur",
  US: "usd",
} as const;

export type SupportedPayoutCountryCode = keyof typeof SUPPORTED_PAYOUT_COUNTRIES;

export const isSupportedPayoutCountry = (
  value: string | null | undefined,
): value is SupportedPayoutCountryCode =>
  Object.hasOwn(SUPPORTED_PAYOUT_COUNTRIES, String(value ?? "").trim().toUpperCase());

// The currency a creator in this country is paid in, or null if unsupported.
export const getPayoutCountryCurrency = (
  value: string | null | undefined,
): string | null => {
  const code = String(value ?? "").trim().toUpperCase();

  return isSupportedPayoutCountry(code) ? SUPPORTED_PAYOUT_COUNTRIES[code] : null;
};

export type PayoutCountryOption = { code: string; name: string };

// Dropdown options, named in the reader's language and sorted by name.
export const getPayoutCountryOptions = (locale = "en"): PayoutCountryOption[] => {
  let displayNames: Intl.DisplayNames | null = null;

  try {
    displayNames = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    displayNames = null;
  }

  return Object.keys(SUPPORTED_PAYOUT_COUNTRIES)
    .map((code) => ({ code, name: displayNames?.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
};
