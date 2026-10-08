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
  useAccountDetails,
  useSaveAccountDetails,
  useSaveMarketingEmails,
} from "../hooks/settings/useAccountDetails";

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
  const id = `account-${name}`;

  return (
    <div className={wide ? classes.wideField : classes.field}>
      <label className={classes.label} htmlFor={id}>
        {label}
        {optional && <span className={classes.optional}> (optional)</span>}
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
  const navigate = useNavigate();
  const detailsQuery = useAccountDetails();
  const saveDetails = useSaveAccountDetails();
  const saveMarketingEmails = useSaveMarketingEmails();
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

  const form = draft ?? toAccountDetailsForm(details);
  const showForm = editing || !details;

  const countryOptions = useMemo(() => getBillingCountryOptions(), []);
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

    const result = validateAccountDetails(form);

    setErrors(result.errors);

    if (!result.values) {
      const firstInvalid = Object.keys(result.errors)[0];
      document.getElementById(`account-${firstInvalid}`)?.focus();
      return;
    }

    const isFirstSave = !details;

    try {
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
        <p className={classes.text}>Loading your details…</p>
      </div>
    );
  }

  if (detailsQuery.isError) {
    return <div className={classes.error}>We couldn’t load your details. Please try again.</div>;
  }

  const rows: Array<{ label: string; value: string | null }> = details
    ? [
        { label: "Legal name", value: `${details.legal_first_name} ${details.legal_last_name}` },
        { label: "Date of birth", value: details.date_of_birth },
        { label: "Address", value: formatAddress(details, countryName(details.country_code)) },
        { label: "Business legal name", value: details.business_legal_name },
        { label: "Business registration number", value: details.business_registration_number },
        { label: "Tax number", value: details.tax_number },
      ]
    : [];

  return (
    <div className={classes.card}>
      <div className={classes.head}>
        <div>
          <h1 className={classes.title}>
            {details ? "Personal details" : "Finish setting up your account"}
          </h1>
          {!details && (
            <p className={classes.text}>
              Add these details before you create a listing, send a commission request or pay.
              It takes a minute and you only do it once.
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
              {revealed ? "Hide details" : "Show details"}
            </button>
            <button type="button" className={classes.iconButton} onClick={startEditing}>
              Edit
            </button>
          </div>
        )}
      </div>

      <p className={classes.private}>
        These details are private. They appear only on this page of your settings and are never
        shown on your profile, your listings or to other members. We have to keep them for our
        legal, tax and business records: to know who is making each sale or purchase, to work
        out tax, and to deal with refunds and disputes.{" "}
        <Link className={classes.link} to="/privacy">
          Privacy Policy
        </Link>
      </p>

      {justSaved && !showForm && (
        <div className={classes.success} role="status">
          Your details are saved.
        </div>
      )}

      {details && !showForm && (
        <dl className={classes.rows}>
          <div className={classes.row}>
            <dt className={classes.rowLabel}>Account type</dt>
            <dd className={classes.rowValue}>
              {details.account_type === "business" ? "Business or legal entity" : "Individual"}
            </dd>
          </div>
          {rows
            .filter((row) => row.value)
            .map((row) => (
              <div key={row.label} className={classes.row}>
                <dt className={classes.rowLabel}>{row.label}</dt>
                <dd className={revealed ? classes.rowValue : classes.masked}>
                  {revealed ? row.value : MASKED_VALUE}
                  {!revealed && <span className="sr-only"> (hidden)</span>}
                </dd>
              </div>
            ))}
        </dl>
      )}

      {showForm && (
        <form className={classes.form} onSubmit={(event) => void onSubmit(event)} noValidate>
          {details && (
            <p className={classes.hint}>Your saved details are visible on screen while you edit.</p>
          )}

          <fieldset className={classes.group}>
            <legend className={classes.groupTitle}>This account belongs to</legend>
            <div className={classes.radios}>
              {(
                [
                  ["individual", "An individual"],
                  ["business", "A business or other legal entity"],
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
              {form.account_type === "business" ? "Person responsible for the account" : "You"}
            </h2>
            <div className={classes.grid}>
              <Field name="legal_first_name" label="Legal first name" error={errors.legal_first_name}>
                {(props) => <input {...props} {...text("legal_first_name", "given-name")} maxLength={100} />}
              </Field>
              <Field name="legal_last_name" label="Legal last name" error={errors.legal_last_name}>
                {(props) => <input {...props} {...text("legal_last_name", "family-name")} maxLength={100} />}
              </Field>
              <Field
                name="date_of_birth"
                label="Date of birth"
                hint={`You must be at least ${MINIMUM_AGE}.`}
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
            <h2 className={classes.groupTitle}>Address</h2>
            <div className={classes.grid}>
              <Field
                name="country_code"
                label="Country"
                wide
                hint="This is your billing country when you pay."
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
                    <option value="">Choose a country</option>
                    {countryOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field name="address_line1" label="Street address" wide error={errors.address_line1}>
                {(props) => <input {...props} {...text("address_line1", "address-line1")} maxLength={200} />}
              </Field>
              <Field name="address_line2" label="Apartment, suite or unit" optional wide>
                {(props) => <input {...props} {...text("address_line2", "address-line2")} maxLength={200} />}
              </Field>
              <Field name="city" label="City or town" error={errors.city}>
                {(props) => <input {...props} {...text("city", "address-level2")} maxLength={100} />}
              </Field>
              <Field
                name="region"
                label={regionOptions ? "Province or state" : "State, province or region"}
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
                      <option value="">Choose one</option>
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
                label="Postal or ZIP code"
                optional={!regionOptions}
                error={errors.postal_code}
              >
                {(props) => <input {...props} {...text("postal_code", "postal-code")} maxLength={20} />}
              </Field>
            </div>
          </div>

          <div className={classes.group}>
            <h2 className={classes.groupTitle}>Business and tax details</h2>
            <p className={classes.hint}>
              Fill these in if you sell or buy as a business, or are registered for sales tax.
              Leave them empty otherwise.
            </p>
            <div className={classes.grid}>
              <Field
                name="business_legal_name"
                label="Legal name of the business or entity"
                optional={form.account_type !== "business"}
                wide
                error={errors.business_legal_name}
              >
                {(props) => (
                  <input {...props} {...text("business_legal_name", "organization")} maxLength={200} />
                )}
              </Field>
              <Field name="business_registration_number" label="Business registration number" optional>
                {(props) => (
                  <input {...props} {...text("business_registration_number", "off")} maxLength={60} />
                )}
              </Field>
              <Field
                name="tax_number"
                label="Tax number"
                optional
                hint="For example a GST/HST, VAT or EIN number."
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
                  Send me Made for Stream news, offers and monthly updates by email
                </span>
                <span className={`block ${classes.hint}`}>
                  Optional. You can change this at any time in Settings, under Preferences.
                </span>
              </span>
            </label>
          )}

          {saveDetails.error && (
            <div className={classes.error} role="alert">
              {saveDetails.error.message}
            </div>
          )}

          <div className={classes.footer}>
            {details && (
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
                Cancel
              </button>
            )}
            <button type="submit" className="btnPrimary btnSm" disabled={saveDetails.isPending}>
              {saveDetails.isPending ? "Saving…" : "Save details"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AccountDetailsSettings;
