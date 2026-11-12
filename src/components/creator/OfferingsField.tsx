import {
  APPLICATION_OFFERINGS,
  OFFERING_OTHER_MAX_LENGTH,
  applicationOfferingLabel,
  normaliseOfferings,
  type ApplicationOffering,
} from "../../domain/creatorApplication/creatorApplication";
import { useT } from "../../lib/i18n/i18n";

// "What will you offer?": one checkbox per listing category and "Something
// else", which then asks for a short description. Used by the creator
// application and Settings (20261112_197). The parent keeps the values.

const classes = {
  grid: "grid gap-x-3 gap-y-0.5 sm:grid-cols-2",
  check:
    "flex items-start gap-3 rounded-xl px-2 py-2 text-sm text-zinc-700 transition hover:bg-[rgb(var(--ink)/0.03)]",
  checkbox: "mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 accent-[rgb(var(--brand))]",
  other: "mt-2 flex flex-col gap-1.5",
  label: "formLabel",
  input: "formControl",
  error: "formError",
  count: "text-xs text-zinc-500",
} as const;

type OfferingsFieldProps = {
  id: string;
  offerings: ApplicationOffering[];
  other: string;
  onChange: (next: { offerings: ApplicationOffering[]; other: string }) => void;
  disabled?: boolean;
  // Shown under the description, e.g. once someone tries to save without one.
  otherError?: string | null;
};

const OfferingsField = ({ id, offerings, other, onChange, disabled = false, otherError }: OfferingsFieldProps) => {
  const t = useT();
  const otherId = `${id}-other`;
  const showsOther = offerings.includes("other");

  const toggle = (offering: ApplicationOffering, checked: boolean) =>
    onChange({
      offerings: normaliseOfferings(
        checked ? [...offerings, offering] : offerings.filter((value) => value !== offering),
      ),
      other,
    });

  return (
    <div>
      <div className={classes.grid}>
        {APPLICATION_OFFERINGS.map((offering) => (
          <label key={offering} className={classes.check}>
            <input
              className={classes.checkbox}
              type="checkbox"
              checked={offerings.includes(offering)}
              onChange={(event) => toggle(offering, event.currentTarget.checked)}
              disabled={disabled}
            />
            <span>{t(applicationOfferingLabel(offering))}</span>
          </label>
        ))}
      </div>

      {showsOther && (
        <div className={classes.other}>
          <label className={classes.label} htmlFor={otherId}>
            {t("apply.offeringOtherLabel")}
          </label>
          <input
            id={otherId}
            className={classes.input}
            value={other}
            maxLength={OFFERING_OTHER_MAX_LENGTH}
            placeholder={t("apply.offeringOtherPlaceholder")}
            required
            aria-required="true"
            aria-invalid={Boolean(otherError)}
            aria-describedby={otherError ? `${otherId}-error` : undefined}
            onChange={(event) => onChange({ offerings, other: event.currentTarget.value })}
            disabled={disabled}
          />
          {otherError ? (
            <span id={`${otherId}-error`} className={classes.error}>
              {otherError}
            </span>
          ) : (
            <span className={classes.count}>
              {other.trim().length}/{OFFERING_OTHER_MAX_LENGTH}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default OfferingsField;
