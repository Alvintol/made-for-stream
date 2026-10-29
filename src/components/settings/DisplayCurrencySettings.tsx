import { useState } from "react";
import { SUPPORTED_CURRENCY_CODES } from "../../domain/payments/supportedCurrencies";
import {
  useDisplayPreferences,
  useSaveDisplayPreferences,
} from "../../hooks/money/useDisplayCurrency";
import { useLanguage, useT } from "../../lib/i18n/i18n";
import { OFFERED_LANGUAGES } from "../../lib/i18n/languages";
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
  const t = useT();
  // The language the page is in now: the saved choice, or the browser's.
  const currentLanguage = useLanguage();

  const saved = preferencesQuery.data ?? null;

  // Unsaved edits, tied to the saved values they were made against. This
  // form is on screen twice on the settings page (here and behind the top
  // bar's globe button): when either one saves, the saved values are read
  // again and any older edits in the other are dropped, so both always agree.
  const savedAt = preferencesQuery.dataUpdatedAt;
  const [draft, setDraft] = useState<{
    savedAt: number | undefined;
    currency?: string;
    language?: string;
  }>({ savedAt });
  const [justSaved, setJustSaved] = useState(false);

  const edits = draft.savedAt === savedAt ? draft : { savedAt };
  // Not edited here: it follows the account details.
  const country = saved?.country_code ?? "";
  const currency = edits.currency ?? saved?.display_currency ?? "";
  const language = edits.language ?? currentLanguage;

  const countryCurrency = getCurrencyForCountry(country);

  const save = async () => {
    setJustSaved(false);

    try {
      await savePreferences.mutateAsync({
        country_code: country || null,
        display_currency: currency || null,
        // Saved only once chosen here, so someone who never picks one keeps
        // following their browser.
        language: edits.language ?? saved?.language ?? null,
      });
      setJustSaved(true);
    } catch {
      // Shown below from the mutation's error.
    }
  };

  return (
    <>
      <p className={classes.text}>
        {t("display.intro")}
      </p>

      <div className={classes.form}>
        <label className={classes.wideField}>
          <span className={classes.label}>{t("display.language")}</span>
          <select
            className={classes.input}
            value={language}
            disabled={preferencesQuery.isLoading}
            onChange={(event) => {
              setDraft({ ...edits, language: event.target.value });
              setJustSaved(false);
            }}
          >
            {OFFERED_LANGUAGES.map((option) => (
              <option key={option.code} value={option.code} lang={option.code}>
                {option.name}
              </option>
            ))}
          </select>
          <span className={classes.hint}>
            {OFFERED_LANGUAGES.length > 1
              ? t("display.languageHintUnfinished")
              : t("display.languageHint")}
          </span>
        </label>

        <label className={classes.wideField}>
          <span className={classes.label}>{t("display.showPricesIn")}</span>
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
                ? t("display.countryCurrency", { currency: countryCurrency.toUpperCase() })
                : t("display.creatorCurrency")}
            </option>
            {SUPPORTED_CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code.toUpperCase()} · {getCurrencyName(code)}
              </option>
            ))}
          </select>
          <span className={classes.hint}>
            {t("display.estimateHint")}
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
          {savePreferences.isPending ? t("display.saving") : t("display.save")}
        </button>
      </div>

      {justSaved && (
        <div className={classes.success} role="status">
          {t("display.saved")}
          {savePreferences.isGuest && t("display.guestNote")}
        </div>
      )}

      {savePreferences.error && (
        <div className={classes.error} role="alert">
          {t("display.saveError")}
        </div>
      )}
    </>
  );
};

export default DisplayCurrencySettings;
