import { english, type Translate } from "../../lib/i18n/i18n";
import { isOpenCountry } from "../payments/supportedCountries";
// The private legal details behind an account (public.user_account_details,
// 20261008_150). The database trigger validate_user_account_details() is the
// real check; this mirrors it so the form can point at the field.

export type AccountType = "individual" | "business";

export type AccountDetails = {
  account_type: AccountType;
  legal_first_name: string;
  legal_last_name: string;
  // YYYY-MM-DD
  date_of_birth: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  region: string | null;
  postal_code: string | null;
  country_code: string;
  business_legal_name: string | null;
  business_registration_number: string | null;
  tax_number: string | null;
};

// What the form holds: every field a string, so an empty box is "".
export type AccountDetailsForm = { [K in keyof AccountDetails]: string };

export type AccountDetailsErrors = Partial<Record<keyof AccountDetails, string>>;

export const MINIMUM_AGE = 18;

export const emptyAccountDetailsForm: AccountDetailsForm = {
  account_type: "individual",
  legal_first_name: "",
  legal_last_name: "",
  date_of_birth: "",
  address_line1: "",
  address_line2: "",
  city: "",
  region: "",
  postal_code: "",
  country_code: "",
  business_legal_name: "",
  business_registration_number: "",
  tax_number: "",
};

export const toAccountDetailsForm = (details: AccountDetails | null): AccountDetailsForm =>
  details
    ? (Object.fromEntries(
        Object.keys(emptyAccountDetailsForm).map((key) => [
          key,
          details[key as keyof AccountDetails] ?? "",
        ]),
      ) as AccountDetailsForm)
    : emptyAccountDetailsForm;

// Tax depends on the province or state in these two countries, so it is a
// fixed two-letter code there and free text everywhere else.
const REGION_CODES: Record<string, string> = {
  CA: "AB BC MB NB NL NS NT NU ON PE QC SK YT",
  US: "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY",
};

export const getRegionOptions = (
  countryCode: string,
  locale = "en",
): Array<{ code: string; name: string }> | null => {
  const codes = REGION_CODES[countryCode];

  if (!codes) return null;

  // Intl has no names for provinces and states, so the code is the label;
  // people know their own.
  return codes
    .split(" ")
    .map((code) => ({ code, name: code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
};

// Places Made for Stream does not serve, as the database's
// blocked_location_message() (20261031_177) says them: sanctioned countries,
// Quebec until the site is in French, and anywhere outside Canada and the
// United States during the beta.
export const SANCTIONED_COUNTRIES = ["BY", "CU", "IR", "KP", "RU", "SY"] as const;

export const SANCTIONED_COUNTRY_MESSAGE = english("account.sanctioned");

export const QUEBEC_MESSAGE = english("account.quebec");

export const BETA_COUNTRY_MESSAGE = english("account.betaCountries");
const yearsAgo = (years: number, today: Date): string => {
  const date = new Date(Date.UTC(today.getFullYear() - years, today.getMonth(), today.getDate()));

  return date.toISOString().slice(0, 10);
};

export const validateAccountDetails = (
  form: AccountDetailsForm,
  today = new Date(),
  t: Translate = english,
): { values: AccountDetails | null; errors: AccountDetailsErrors } => {
  const trimmed = Object.fromEntries(
    Object.entries(form).map(([key, value]) => [key, value.trim()]),
  ) as AccountDetailsForm;

  const errors: AccountDetailsErrors = {};
  const require = (key: keyof AccountDetails, message: string) => {
    if (!trimmed[key]) errors[key] = message;
  };

  require("legal_first_name", t("account.errorFirstName"));
  require("legal_last_name", t("account.errorLastName"));
  require("address_line1", t("account.errorStreet"));
  require("city", t("account.errorCity"));
  require("country_code", t("account.errorCountry"));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed.date_of_birth) || trimmed.date_of_birth < "1900-01-01") {
    errors.date_of_birth = t("account.errorDob");
  } else if (trimmed.date_of_birth > yearsAgo(MINIMUM_AGE, today)) {
    errors.date_of_birth = t("account.errorAge", { age: MINIMUM_AGE });
  }

  if (REGION_CODES[trimmed.country_code]) {
    require("region", t("account.errorRegion"));
    require("postal_code", t("account.errorPostal"));
  }

  if ((SANCTIONED_COUNTRIES as readonly string[]).includes(trimmed.country_code.toUpperCase())) {
    errors.country_code = t("account.sanctioned");
  } else if (trimmed.country_code === "CA" && trimmed.region.toUpperCase() === "QC") {
    errors.region = t("account.quebec");
  } else if (trimmed.country_code && !isOpenCountry(trimmed.country_code)) {
    errors.country_code = t("account.betaCountries");
  }
  if (trimmed.account_type === "business") {
    require("business_legal_name", t("account.errorBusiness"));
  }

  if (Object.keys(errors).length > 0) return { values: null, errors };

  const optional = (value: string): string | null => value || null;

  return {
    errors,
    values: {
      account_type: trimmed.account_type === "business" ? "business" : "individual",
      legal_first_name: trimmed.legal_first_name,
      legal_last_name: trimmed.legal_last_name,
      date_of_birth: trimmed.date_of_birth,
      address_line1: trimmed.address_line1,
      address_line2: optional(trimmed.address_line2),
      city: trimmed.city,
      region: optional(trimmed.region),
      postal_code: optional(trimmed.postal_code),
      country_code: trimmed.country_code,
      business_legal_name: optional(trimmed.business_legal_name),
      business_registration_number: optional(trimmed.business_registration_number),
      tax_number: optional(trimmed.tax_number),
    },
  };
};

// For someone with their settings on a stream: the same length whatever the
// value, so not even its size shows.
export const MASKED_VALUE = "********";
