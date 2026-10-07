import { useMemo, useState } from "react";
import { getPayoutCountryOptions } from "../../domain/payments/supportedCountries";
import { SUPPORTED_CURRENCY_CODES } from "../../domain/payments/supportedCurrencies";
import {
  useDisplayPreferences,
  useSaveDisplayPreferences,
} from "../../hooks/money/useDisplayCurrency";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "../../lib/i18n/languages";
import { getCurrencyForCountry, getCurrencyName } from "../../lib/money/displayCurrency";

const classes = {
  text: "text-sm text-zinc-600",
  form: "grid gap-3 sm:grid-cols-2",
  field: "flex flex-col gap-1.5",
  wideField: "flex flex-col gap-1.5 sm:col-span-2",
  label: "formLabel",
  hint: "formHint",
  input: "formControl",
  actions: "flex flex-wrap items-center gap-3",
  button: "btnPrimary",
  success: "notice noticeSuccess",
  error: "notice noticeError",
} as const;

// Where a signed-in person says which country they are in and which
// currency they want prices shown in. Used only to show approximate
// converted prices; it never changes what anyone is charged.
const DisplayCurrencySettings = () => {
  const preferencesQuery = useDisplayPreferences();
  const savePreferences = useSaveDisplayPreferences();

  const saved = preferencesQuery.data ?? null;

  // Null until the person changes something, so the saved values show.
  const [countryDraft, setCountryDraft] = useState<string | null>(null);
  const [currencyDraft, setCurrencyDraft] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const country = countryDraft ?? saved?.country_code ?? "";
  const currency = currencyDraft ?? saved?.display_currency ?? "";

  const countryOptions = useMemo(() => getPayoutCountryOptions(), []);
  const countryCurrency = getCurrencyForCountry(country);

  const save = async () => {
    setJustSaved(false);

    try {
      await savePreferences.mutateAsync({
        country_code: country || null,
        display_currency: currency || null,
      });
      setJustSaved(true);
    } catch {
      // Shown below from the mutation's error.
    }
  };

  return (
    <>
      <p className={classes.text}>
        Creators set prices in their own currency. Tell us where you are and we will also show
        an approximate price in yours. We use this only to choose the currency you see. It is
        not shown on your profile, and you always pay in the creator's currency.
      </p>

      <div className={classes.form}>
        <label className={classes.wideField}>
          <span className={classes.label}>Language</span>
          {/* ponytail: one language, so there is nothing to save yet. See
              lib/i18n/languages.ts for what a second one needs. */}
          <select className={classes.input} defaultValue={DEFAULT_LANGUAGE}>
            {SUPPORTED_LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.name}
              </option>
            ))}
          </select>
          <span className={classes.hint}>More languages are planned.</span>
        </label>

        <label className={classes.field}>
          <span className={classes.label}>Country</span>
          <select
            className={classes.input}
            value={country}
            disabled={preferencesQuery.isLoading}
            onChange={(event) => {
              setCountryDraft(event.target.value);
              setJustSaved(false);
            }}
          >
            <option value="">Another country, or prefer not to say</option>
            {countryOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
          <span className={classes.hint}>
            The list covers countries whose currency we can show. If yours is missing, choose a
            currency on the right.
          </span>
        </label>

        <label className={classes.field}>
          <span className={classes.label}>Show prices in</span>
          <select
            className={classes.input}
            value={currency}
            disabled={preferencesQuery.isLoading}
            onChange={(event) => {
              setCurrencyDraft(event.target.value);
              setJustSaved(false);
            }}
          >
            <option value="">
              {countryCurrency
                ? `My country's currency (${countryCurrency.toUpperCase()})`
                : "The creator's own currency (no conversion)"}
            </option>
            {SUPPORTED_CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code.toUpperCase()} · {getCurrencyName(code)}
              </option>
            ))}
          </select>
          <span className={classes.hint}>
            Converted prices are estimates and are marked with ≈.
          </span>
        </label>
      </div>

      <div className={classes.actions}>
        <button
          className={classes.button}
          type="button"
          disabled={savePreferences.isPending || preferencesQuery.isLoading}
          onClick={() => void save()}
        >
          {savePreferences.isPending ? "Saving…" : "Save"}
        </button>
      </div>

      {justSaved && (
        <div className={classes.success} role="status">
          Saved. Prices across the site now follow this choice.
          {savePreferences.isGuest &&
            " Sign in to keep it: without an account it lasts until you reload or close this page."}
        </div>
      )}

      {savePreferences.error && (
        <div className={classes.error} role="alert">
          Your choice could not be saved. Please try again.
        </div>
      )}
    </>
  );
};

export default DisplayCurrencySettings;
