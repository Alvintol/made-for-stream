import { getPayoutCountryCurrency } from "../../domain/payments/supportedCountries";
import { isSupportedCurrency } from "../../domain/payments/supportedCurrencies";

// Listing prices and their approximate conversions.
//
// A listing is priced in its creator's payout currency (listings.currency,
// 20261007_146). A visitor may ask to see prices in another currency; that
// figure is an estimate from the European Central Bank's daily reference
// rates and is for display only. Agreements, checkout and receipts always
// use the creator's currency and never go through this file.

// Units of each currency per one euro, as served by GET /api/exchange-rates.
export type ExchangeRates = {
  base: "eur";
  date: string;
  rates: Record<string, number>;
};

type ListingPriceInput = {
  price_type: string;
  price_min: number;
  price_max: number | null;
  // Missing on snapshots taken before listings had a currency: those were CAD.
  currency?: string | null;
};

export const LEGACY_LISTING_CURRENCY = "cad";

const normalise = (currency?: string | null) =>
  (currency || LEGACY_LISTING_CURRENCY).trim().toLowerCase();

// "$68 CAD", "€50 EUR", "kr500 SEK". The code is always shown, because "$"
// alone could be any of six currencies the site supports.
export const formatCurrencyAmount = (amount: number, currency?: string | null): string => {
  const code = normalise(currency).toUpperCase();

  try {
    const formatted = new Intl.NumberFormat("en", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);

    return `${formatted} ${code}`;
  } catch {
    return `${amount} ${code}`;
  }
};

// "$100 CAD", or "$100–$150 CAD" for a range: one code for the pair.
export const formatCurrencyAmountRange = (
  low: number,
  high: number | null | undefined,
  currency?: string | null,
): string => {
  const highText = formatCurrencyAmount(high ?? low, currency);

  if (high === null || high === undefined || high === low) return highText;

  const code = normalise(currency).toUpperCase();

  return `${formatCurrencyAmount(low, currency).replace(` ${code}`, "")}–${highText}`;
};

const priceRange = (listing: ListingPriceInput): { min: number; max: number | null } => ({
  min: listing.price_min,
  max:
    listing.price_type === "range" ? (listing.price_max ?? listing.price_min) : null,
});

const formatRange = (
  priceType: string,
  min: number,
  max: number | null,
  currency: string,
): string => {
  if (priceType === "starting_at") {
    return `From ${formatCurrencyAmount(min, currency)}`;
  }

  if (priceType === "range" && max !== null) {
    // One code for the pair: "€50–€80 EUR".
    const code = currency.toUpperCase();
    const low = formatCurrencyAmount(min, currency).replace(` ${code}`, "");

    return `${low}–${formatCurrencyAmount(max, currency)}`;
  }

  return formatCurrencyAmount(min, currency);
};

// The listing's real price, in the creator's currency.
export const formatListingPrice = (listing: ListingPriceInput): string => {
  const { min, max } = priceRange(listing);

  return formatRange(listing.price_type, min, max, normalise(listing.currency));
};

// Null when the amount cannot be converted (same currency is not a
// conversion; an unknown currency or missing rates cannot be one).
export const convertAmount = (
  amount: number,
  from: string,
  to: string,
  rates: ExchangeRates | null | undefined,
): number | null => {
  const fromRate = rates?.rates[normalise(from)];
  const toRate = rates?.rates[normalise(to)];

  if (!fromRate || !toRate || normalise(from) === normalise(to)) {
    return null;
  }

  return (amount / fromRate) * toRate;
};

// The listing's price in the visitor's currency, rounded to whole units and
// marked as approximate: "≈ $68 CAD". Null when there is nothing to convert.
export const formatApproximateListingPrice = (
  listing: ListingPriceInput,
  displayCurrency: string | null | undefined,
  rates: ExchangeRates | null | undefined,
): string | null => {
  if (!displayCurrency) return null;

  const from = normalise(listing.currency);
  const { min, max } = priceRange(listing);
  const convertedMin = convertAmount(min, from, displayCurrency, rates);
  const convertedMax = max === null ? null : convertAmount(max, from, displayCurrency, rates);

  if (convertedMin === null || (max !== null && convertedMax === null)) {
    return null;
  }

  return `≈ ${formatRange(
    listing.price_type,
    Math.round(convertedMin),
    convertedMax === null ? null : Math.round(convertedMax),
    normalise(displayCurrency),
  )}`;
};

export const getCurrencyName = (currency: string): string => {
  const code = currency.toUpperCase();

  try {
    return new Intl.DisplayNames(["en"], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
};

// The local currency for a country, when it is one the site supports.
export const getCurrencyForCountry = (countryCode?: string | null): string | null => {
  const currency = countryCode ? getPayoutCountryCurrency(countryCode.toUpperCase()) : null;

  return currency && isSupportedCurrency(currency) ? currency : null;
};

// The country part of the browser's language setting ("en-CA" gives "CA").
// A guess for visitors who are not signed in; never stored or sent anywhere.
export const getBrowserCountry = (languages: readonly string[]): string | null => {
  for (const language of languages) {
    const region = /^[a-z]{2,3}(?:-[A-Za-z]{4})?-([A-Za-z]{2})\b/.exec(language)?.[1];

    if (region) return region.toUpperCase();
  }

  return null;
};

// Which currency to show approximate prices in:
//   1. the currency the person chose in settings,
//   2. else their country's currency,
//   3. else, signed out or nothing saved, a guess from the browser.
// Null means "show the creator's prices as they are".
export const resolveDisplayCurrency = ({
  preference,
  browserLanguages,
}: {
  preference?: { country_code: string | null; display_currency: string | null } | null;
  browserLanguages: readonly string[];
}): string | null => {
  if (preference?.display_currency && isSupportedCurrency(preference.display_currency)) {
    return preference.display_currency.toLowerCase();
  }

  return (
    getCurrencyForCountry(preference?.country_code) ??
    getCurrencyForCountry(getBrowserCountry(browserLanguages))
  );
};

// What the settings section's header says about the saved choice.
export const getDisplayCurrencySummary = (
  preference: { country_code: string | null; display_currency: string | null } | null | undefined,
): string => {
  const currency = preference?.display_currency ?? getCurrencyForCountry(preference?.country_code);

  return currency ? `Prices shown in ${currency.toUpperCase()}` : "Not set";
};
