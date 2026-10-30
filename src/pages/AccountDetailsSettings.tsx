import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getBillingCountryOptions } from "../domain/payments/billingCountries";
import {
  MASKED_VALUE,
  MINIMUM_AGE,
  getRegionOptions,
  toAccountDetailsForm,
  validateAccountDetails,
  type AccountDetails,
  type AccountDetailsErrors,
  type AccountDetailsForm,
} from "../domain/settings/accountDetails";
import { useMyProfile } from "../hooks/profile/useMyProfile";
import {
  DISPLAY_NAME_MAX,
  getDisplayNameError,
  hasChosenDisplayName,
} from "../domain/settings/displayName";
import {
  useAccountDetails,
  useSaveAccountDetails,
  useSaveDisplayName,
  useSaveMarketingEmails,
} from "../hooks/settings/useAccountDetails";
import KeptPlaceholder from "../components/ui/KeptPlaceholder";
import { useLanguage, useT } from "../lib/i18n/i18n";
const classes = {
  card: "card space-y-4 p-5 hover:shadow-[var(--shadow-md)]",
  head: "flex flex-wrap items-start justify-between gap-3",
  title: "font-display text-lg font-bold tracking-tight text-zinc-900",
  text: "text-sm leading-6 text-zinc-600",
  link: "font-semibold underline underline-offset-2",
  private: "notice noticeInfo",
  actions: "flex flex-wrap items-center gap-2",
  iconButton: "btnOutline btnSm inline-flex items-center gap-1.5",
  rows: "divide-y divide-[var(--hairline)] rounded-xl border border-[var(--hairline)]",
  row: "grid gap-1 px-3 py-2.5 sm:grid-cols-[12rem_minmax(0,1fr)]",
  rowLabel: "text-xs font-semibold uppercase tracking-wide text-zinc-500",
  rowValue: "whitespace-pre-line break-words text-sm text-zinc-900",
  masked: "select-none font-mono text-sm tracking-widest text-zinc-500",
  form: "space-y-5",
  group: "space-y-3",
  groupTitle: "font-display text-sm font-bold text-zinc-900",
  grid: "grid gap-3 sm:grid-cols-2",
  field: "flex flex-col gap-1.5",
  wideField: "flex flex-col gap-1.5 sm:col-span-2",
  label: "formLabel",
  optional: "font-normal text-zinc-500",
  hint: "formHint",
  input: "formControl",
  radios: "flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-800",
  radio: "inline-flex items-center gap-2",
  fieldError: "text-xs font-medium text-red-700",
  error: "notice noticeError",
  success: "notice noticeSuccess",
  optIn: "flex items-start gap-3 text-sm",
  footer: "flex flex-wrap items-center justify-end gap-2",
} as const;

const EyeIcon = ({ crossed }: { crossed: boolean }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
    {crossed && <path d="M4 4l16 16" />}
  </svg>
);

const formatAddress = (details: AccountDetails, countryName: string): string =>
  [
    details.address_line1,
    details.address_line2,
    [details.city, details.region, details.postal_code].filter(Boolean).join(", "),
    countryName,
  ]
    .filter(Boolean)
    .join("\n");

type FieldProps = {
  name: keyof AccountDetails;
  label: string;
  optional?: boolean;
  hint?: string;
  wide?: boolean;
  error?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
};

const Field = ({ name, label, optional, hint, wide, error, children }: FieldProps) => {
  const t = useT();
  const id = `account-${name}`;
  return (
    <div className={wide ? classes.wideField : classes.field}>
      <label className={classes.label} htmlFor={id}>
        {label}
        {optional && <span className={classes.optional}> ({t("common.optional")})</span>}
      </label>
      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? `${id}-error` : undefined,
      })}
      {hint && !error && <span className={classes.hint}>{hint}</span>}
      {error && (
        <span id={`${id}-error`} className={classes.fieldError}>
          {error}
        </span>
      )}
    </div>
  );
};

// Settings → Personal details. The legal details behind the account: asked
// for once, before anything else, and kept private. Until they are saved the
// account cannot create a listing, send a commission request or pay
// (enforced by the database and the API, 20261008_150).
//
// Saved details are hidden behind asterisks until the eye button is pressed,
// so they stay off screen for someone who has their settings open on a stream.
const AccountDetailsSettings = () => {
  const t = useT();
  const language = useLanguage();
  const navigate = useNavigate();
  const detailsQuery = useAccountDetails();
  const saveDetails = useSaveAccountDetails();
  const saveMarketingEmails = useSaveMarketingEmails();
  const saveDisplayName = useSaveDisplayName();
  const { data: profile } = useMyProfile();

  const details = detailsQuery.data ?? null;

  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AccountDetailsForm | null>(null);
  const [errors, setErrors] = useState<AccountDetailsErrors>({});
  const [justSaved, setJustSaved] = useState(false);
  // Asked once, with the first save. Never ticked for the person: consent to
  // promotional email has to be their own act (Privacy Policy section 7).
  const [wantsMarketingEmails, setWantsMarketingEmails] = useState(false);

  // The public display name is asked for on this form too, until the person
  // has chosen one: an account cannot go further without it.
  const needsDisplayName = Boolean(profile) && !hasChosenDisplayName(profile);
  const [displayName, setDisplayName] = useState("");
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  const form = draft ?? toAccountDetailsForm(details);
  const showForm = editing || !details || needsDisplayName;

  const countryOptions = useMemo(() => getBillingCountryOptions(language), [language]);
  const regionOptions = getRegionOptions(form.country_code);
  const countryName = (code: string) =>
    countryOptions.find((option) => option.code === code)?.name ?? code;

  const latestBirthDate = useMemo(() => {
    const today = new Date();

    return new Date(Date.UTC(today.getFullYear() - MINIMUM_AGE, today.getMonth(), today.getDate()))
      .toISOString()
      .slice(0, 10);
  }, []);

  const set = (key: keyof AccountDetails, value: string) => {
    setDraft({ ...form, [key]: value });
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const text = (key: keyof AccountDetails, autoComplete: string) => ({
    className: classes.input,
    value: form[key],
    autoComplete,
    onChange: (event: { currentTarget: { value: string } }) => set(key, event.currentTarget.value),
  });

  const startEditing = () => {
    setDraft(null);
    setErrors({});
    setJustSaved(false);
    setEditing(true);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const result = validateAccountDetails(form, new Date(), t);
    const nameError = needsDisplayName ? getDisplayNameError(displayName, t) : null;

    setErrors(result.errors);
    setDisplayNameError(nameError);

    if (nameError) {
      document.getElementById("account-display-name")?.focus();
      return;
    }

    if (!result.values) {
      const firstInvalid = Object.keys(result.errors)[0];
      document.getElementById(`account-${firstInvalid}`)?.focus();
      return;
    }

    const isFirstSave = !details;

    try {
      if (needsDisplayName) await saveDisplayName.mutateAsync(displayName);
      await saveDetails.mutateAsync(result.values);
    } catch {
      // Shown below from the mutation's error.
      return;
    }

    if (isFirstSave && wantsMarketingEmails) {
      // The details are saved either way; the choice can be made again in
      // Settings → Preferences if this fails.
      await saveMarketingEmails.mutateAsync(true).catch(() => undefined);
    }

    setDraft(null);
    setEditing(false);
    setRevealed(false);
    setJustSaved(true);

    // A new account carries on to the rest of its setup.
    if (isFirstSave && profile && !profile.profile_setup_seen) {
      navigate("/settings/profile");
    }
  };

  if (detailsQuery.isLoading) {
    return (
      <div className={classes.card}>
        <p className={classes.text}>{t("account.loading")}</p>
      </div>
    );
  }

  if (detailsQuery.isError) {
    return <div className={classes.error}>{t("account.loadFailed")}</div>;
  }

  const rows: Array<{ label: string; value: string | null }> = details
    ? [
        { label: t("account.legalName"), value: `${details.legal_first_name} ${details.legal_last_name}` },
        { label: t("account.dob"), value: details.date_of_birth },
        { label: t("account.address"), value: formatAddress(details, countryName(details.country_code)) },
        { label: t("account.businessName"), value: details.business_legal_name },
        { label: t("account.businessNumber"), value: details.business_registration_number },
        { label: t("account.taxNumber"), value: details.tax_number },
      ]
    : [];

  return (
    <div className={classes.card}>
      <div className={classes.head}>
        <div>
          <h1 className={classes.title}>
            {t(details && !needsDisplayName ? "settings.tabPersonal" : "account.finishTitle")}
          </h1>
          {(!details || needsDisplayName) && (
            <p className={classes.text}>
              {t("account.finishText")}
            </p>
          )}
        </div>

        {details && !showForm && (
          <div className={classes.actions}>
            <button
              type="button"
              className={classes.iconButton}
              aria-pressed={revealed}
              onClick={() => setRevealed((current) => !current)}
            >
              <EyeIcon crossed={revealed} />
              {t(revealed ? "account.hide" : "account.show")}
            </button>
            <button type="button" className={classes.iconButton} onClick={startEditing}>
              {t("account.edit")}
            </button>
          </div>
        )}
      </div>

      <p className={classes.private}>
        {t("account.private")}{" "}
        <Link className={classes.link} to="/privacy">
          {t("account.privacyLink")}
        </Link>
      </p>

      {justSaved && !showForm && (
        <div className={classes.success} role="status">
          {t("account.saved")}
        </div>
      )}

      {details && !showForm && (
        <dl className={classes.rows}>
          <div className={classes.row}>
            <dt className={classes.rowLabel}>{t("account.type")}</dt>
            <dd className={classes.rowValue}>
              {t(details.account_type === "business" ? "account.typeBusiness" : "account.typeIndividual")}
            </dd>
          </div>
          {rows
            .filter((row) => row.value)
            .map((row) => (
              <div key={row.label} className={classes.row}>
                <dt className={classes.rowLabel}>{row.label}</dt>
                <dd className={revealed ? classes.rowValue : classes.masked}>
                  {revealed ? row.value : MASKED_VALUE}
                  {!revealed && <span className="sr-only"> {t("account.hidden")}</span>}
                </dd>
              </div>
            ))}
        </dl>
      )}

      {showForm && (
        <form className={classes.form} onSubmit={(event) => void onSubmit(event)} noValidate>
          {details && (
            <p className={classes.hint}>{t("account.visibleWhileEditing")}</p>
          )}

          {needsDisplayName && (
            <div className={classes.group}>
              <h2 className={classes.groupTitle}>{t("account.publicName")}</h2>
              <div className={classes.field}>
                <label className={classes.label} htmlFor="account-display-name">
                  {t("profile.displayName")}
                </label>
                <KeptPlaceholder>
                <input
                  id="account-display-name"
                  className={classes.input}
                  value={displayName}
                  maxLength={DISPLAY_NAME_MAX}
                  autoComplete="nickname"
                  placeholder={t("account.namePlaceholder")}
                  aria-invalid={Boolean(displayNameError)}
                  aria-describedby={displayNameError ? "account-display-name-error" : undefined}
                  onChange={(event) => {
                    setDisplayName(event.currentTarget.value);
                    setDisplayNameError(null);
                  }}
                />
                </KeptPlaceholder>
                {displayNameError ? (
                  <span id="account-display-name-error" className={classes.fieldError}>
                    {displayNameError}
                  </span>
                ) : (
                  <span className={classes.hint}>
                    {t("account.nameHint")}
                  </span>
                )}
              </div>
            </div>
          )}

          <fieldset className={classes.group}>
            <legend className={classes.groupTitle}>{t("account.belongsTo")}</legend>
            <div className={classes.radios}>
              {(
                [
                  ["individual", t("account.anIndividual")],
                  ["business", t("account.aBusiness")],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className={classes.radio}>
                  <input
                    type="radio"
                    name="account-type"
                    checked={form.account_type === value}
                    onChange={() => set("account_type", value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className={classes.group}>
            <h2 className={classes.groupTitle}>
              {form.account_type === "business" ? t("account.responsible") : t("common.you")}
            </h2>
            <div className={classes.grid}>
              <Field name="legal_first_name" label={t("account.firstName")} error={errors.legal_first_name}>
                {(props) => <input {...props} {...text("legal_first_name", "given-name")} maxLength={100} />}
              </Field>
              <Field name="legal_last_name" label={t("account.lastName")} error={errors.legal_last_name}>
                {(props) => <input {...props} {...text("legal_last_name", "family-name")} maxLength={100} />}
              </Field>
              <Field
                name="date_of_birth"
                label={t("account.dob")}
                hint={t("account.dobHint", { age: MINIMUM_AGE })}
                error={errors.date_of_birth}
              >
                {(props) => (
                  <input
                    {...props}
                    {...text("date_of_birth", "bday")}
                    type="date"
                    min="1900-01-01"
                    max={latestBirthDate}
                  />
                )}
              </Field>
            </div>
          </div>

          <div className={classes.group}>
            <h2 className={classes.groupTitle}>{t("account.address")}</h2>
            <div className={classes.grid}>
              <Field
                name="country_code"
                label={t("account.country")}
                wide
                hint={t("account.countryHint")}
                error={errors.country_code}
              >
                {(props) => (
                  <select
                    {...props}
                    className={classes.input}
                    value={form.country_code}
                    autoComplete="country"
                    onChange={(event) =>
                      // A province from one country means nothing in another.
                      setDraft({ ...form, country_code: event.currentTarget.value, region: "" })
                    }
                  >
                    <option value="">{t("account.chooseCountry")}</option>
                    {countryOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field name="address_line1" label={t("account.street")} wide error={errors.address_line1}>
                {(props) => <input {...props} {...text("address_line1", "address-line1")} maxLength={200} />}
              </Field>
              <Field name="address_line2" label={t("account.unit")} optional wide>
                {(props) => <input {...props} {...text("address_line2", "address-line2")} maxLength={200} />}
              </Field>
              <Field name="city" label={t("account.city")} error={errors.city}>
                {(props) => <input {...props} {...text("city", "address-level2")} maxLength={100} />}
              </Field>
              <Field
                name="region"
                label={t(regionOptions ? "account.provinceState" : "account.stateRegion")}
                optional={!regionOptions}
                error={errors.region}
              >
                {(props) =>
                  regionOptions ? (
                    <select
                      {...props}
                      className={classes.input}
                      value={form.region}
                      autoComplete="address-level1"
                      onChange={(event) => set("region", event.currentTarget.value)}
                    >
                      <option value="">{t("account.chooseOne")}</option>
                      {regionOptions.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input {...props} {...text("region", "address-level1")} maxLength={100} />
                  )
                }
              </Field>
              <Field
                name="postal_code"
                label={t("account.postal")}
                optional={!regionOptions}
                error={errors.postal_code}
              >
                {(props) => <input {...props} {...text("postal_code", "postal-code")} maxLength={20} />}
              </Field>
            </div>
          </div>

          <div className={classes.group}>
            <h2 className={classes.groupTitle}>{t("account.businessTax")}</h2>
            <p className={classes.hint}>{t("account.businessTaxHint")}</p>
            <div className={classes.grid}>
              <Field
                name="business_legal_name"
                label={t("account.businessNameLabel")}
                optional={form.account_type !== "business"}
                wide
                error={errors.business_legal_name}
              >
                {(props) => (
                  <input {...props} {...text("business_legal_name", "organization")} maxLength={200} />
                )}
              </Field>
              <Field name="business_registration_number" label={t("account.businessNumber")} optional>
                {(props) => (
                  <input {...props} {...text("business_registration_number", "off")} maxLength={60} />
                )}
              </Field>
              <Field
                name="tax_number"
                label={t("account.taxNumber")}
                optional
                hint={t("account.taxHint")}
              >
                {(props) => <input {...props} {...text("tax_number", "off")} maxLength={60} />}
              </Field>
            </div>
          </div>

          {!details && (
            <label className={classes.optIn}>
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-zinc-300"
                checked={wantsMarketingEmails}
                onChange={(event) => setWantsMarketingEmails(event.currentTarget.checked)}
              />
              <span>
                <span className="font-semibold text-zinc-900">
                  {t("preferences.marketing")}
                </span>
                <span className={`block ${classes.hint}`}>
                  {t("account.marketingHint")}
                </span>
              </span>
            </label>
          )}

          {(saveDisplayName.error || saveDetails.error) && (
            <div className={classes.error} role="alert">
              {(saveDisplayName.error || saveDetails.error)?.message}
            </div>
          )}

          <div className={classes.footer}>
            {details && !needsDisplayName && (
              <button
                type="button"
                className="btnOutline btnSm"
                disabled={saveDetails.isPending}
                onClick={() => {
                  setDraft(null);
                  setErrors({});
                  setEditing(false);
                }}
              >
                {t("common.cancel")}
              </button>
            )}
            <button
              type="submit"
              className="btnPrimary btnSm"
              disabled={saveDetails.isPending || saveDisplayName.isPending}
            >
              {t(saveDetails.isPending ? "listingForm.saving" : "account.save")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AccountDetailsSettings;
