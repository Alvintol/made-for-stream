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
  // Shown to buyers, unlike everything else here (20261102_180).
  show_tax_number_on_invoices: boolean;
};

// What the form holds: every field a string, so an empty box is "". A ticked
// box is "true".
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
  show_tax_number_on_invoices: "",
};

export const toAccountDetailsForm = (details: AccountDetails | null): AccountDetailsForm =>
  details
    ? (Object.fromEntries(
        Object.keys(emptyAccountDetailsForm).map((key) => [
          key,
          details[key as keyof AccountDetails] === true
            ? "true"
            : (details[key as keyof AccountDetails] || ""),
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
// blocked_location_message() (20261112_195) says them: sanctioned countries,
// and anywhere outside Canada and the United States during the beta. Quebec
// is open for free listings only until the site is in French: its address
// can be saved, and QUEBEC_MESSAGE is what the database says when someone
// there tries anything else.
export const SANCTIONED_COUNTRIES = ["BY", "CU", "IR", "KP", "RU", "SY"] as const;

export const SANCTIONED_COUNTRY_MESSAGE = english("account.sanctioned");

export const QUEBEC_MESSAGE = english("account.quebec");

// Quebec until the site is in French (20261112_195, is_free_only_location()).
export const isFreeOnlyLocation = (countryCode: string | null | undefined, region: string | null | undefined) =>
  (countryCode ?? "").trim().toUpperCase() === "CA" && (region ?? "").trim().toUpperCase() === "QC";

export const BETA_COUNTRY_MESSAGE = english("account.betaCountries");
const yearsAgo = (years: number, today: Date): string => {
  const date = new Date(Date.UTC(today.getFullYear() - years, today.getMonth(), today.getDate()));

  return date.toISOString().slice(0, 10);
};

// Nine digits alone is the shape of a social insurance or social security
// number. The database refuses it too, because buyers would see it.
export const looksLikePrivateNumber = (value: string): boolean =>
  /^\d{9}$/.test(value.replace(/[^0-9A-Za-z]/g, ""));

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
  } else if (trimmed.country_code && !isOpenCountry(trimmed.country_code)) {
    errors.country_code = t("account.betaCountries");
  }
  if (trimmed.account_type === "business") {
    require("business_legal_name", t("account.errorBusiness"));
  }

  if (trimmed.show_tax_number_on_invoices === "true") {
    if (!trimmed.tax_number) {
      errors.tax_number = t("account.errorInvoiceNumber");
    } else if (looksLikePrivateNumber(trimmed.tax_number)) {
      errors.tax_number = t("account.errorInvoiceNumberPrivate");
    }
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
      show_tax_number_on_invoices: trimmed.show_tax_number_on_invoices === "true",
    },
  };
};

// For someone with their settings on a stream: the same length whatever the
// value, so not even its size shows.
export const MASKED_VALUE = "********";
