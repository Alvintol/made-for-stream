import { useState } from "react";
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
  wideField: "flex flex-col gap-1.5 sm:col-span-2",
  label: "formLabel",
  hint: "formHint",
  input: "formControl",
  actions: "flex flex-wrap items-center gap-3",
  button: "btnPrimary",
  success: "notice noticeSuccess",
  error: "notice noticeError",
} as const;

// Where a person chooses the language and the currency prices are shown in.
// It only chooses how approximate converted prices are shown and never what
// anyone is charged. The country it defaults from is the one in the person's
// private account details (Settings → Personal details), copied here by the
// database; a visitor has none.
const DisplayCurrencySettings = () => {
  const preferencesQuery = useDisplayPreferences();
  const savePreferences = useSaveDisplayPreferences();

  const saved = preferencesQuery.data ?? null;

  // Unsaved edits, tied to the saved values they were made against. This
  // form is on screen twice on the settings page (here and behind the top
  // bar's globe button): when either one saves, the saved values are read
  // again and any older edits in the other are dropped, so both always agree.
  const savedAt = preferencesQuery.dataUpdatedAt;
  const [draft, setDraft] = useState<{
    savedAt: number | undefined;
    currency?: string;
  }>({ savedAt });
  const [justSaved, setJustSaved] = useState(false);

  const edits = draft.savedAt === savedAt ? draft : { savedAt };
  // Not edited here: it follows the account details.
  const country = saved?.country_code ?? "";
  const currency = edits.currency ?? saved?.display_currency ?? "";

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
        Creators set prices in their own currency, and you always pay in the creator's currency.
        We can also show an approximate price in yours.
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

        <label className={classes.wideField}>
          <span className={classes.label}>Show prices in</span>
          <select
            className={classes.input}
            value={currency}
            disabled={preferencesQuery.isLoading}
            onChange={(event) => {
              setDraft({ ...edits, currency: event.target.value });
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
          Saved.
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
