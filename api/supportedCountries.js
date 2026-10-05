// The countries a creator can connect a payout account in, each with its
// local currency. src/domain/payments/supportedCountries.ts keeps its own
// copy for the dropdown; supportedCountriesSync.test.ts keeps the two
// aligned (the same arrangement as supportedCurrencies.js).
//
// A country is listed when all three hold:
//   1. Stripe supports connected accounts there.
//   2. A platform outside that country may onboard them. Brazil, Malaysia
//      and Thailand are domestic-only, so a Canadian platform cannot.
//   3. Its local currency is one projects can be priced in
//      (supportedCurrencies.js), so the creator is paid without conversion.
//      That rules out Japan (JPY is zero-decimal), Czechia, Hungary, Romania,
//      the UAE and Gibraltar until their currencies are added.
//
// From Stripe's published availability as understood on 2026-10-05; not
// confirmed against this platform's own Dashboard. Stripe is still the final
// word: it refuses a country it will not onboard, whatever is listed here.
// See docs/support/payments/connect-onboarding.md (CON-005).

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
};

export const isSupportedPayoutCountry = (value) =>
  Object.hasOwn(SUPPORTED_PAYOUT_COUNTRIES, String(value || "").trim().toUpperCase());

export const getUnsupportedPayoutCountryMessage = (value) =>
  `Payouts are not available in ${String(value || "(none)").trim().toUpperCase()} yet. Choose a country from the list in payout settings.`;
