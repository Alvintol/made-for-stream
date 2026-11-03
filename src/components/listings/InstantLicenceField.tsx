import {
  instantLicenceLabel,
  instantLicences,
  instantLicenceText,
  isInstantLicence,
  type InstantLicence,
} from "../../domain/listings/instantDownloads";
import { useT } from "../../lib/i18n/i18n";

const classes = {
  field: "space-y-1",
  label: "formLabel",
  select: "formControl",
  hint: "formHint",
  error: "formError",
} as const;

// The licence an instant download is sold under. Buyers see it on the
// listing and again before they pay.
const InstantLicenceField = ({
  value,
  error,
  onChange,
}: {
  value: InstantLicence | "";
  error?: string;
  onChange: (value: InstantLicence | "") => void;
}) => {
  const t = useT();

  return (
    <div className={classes.field}>
      <label className={classes.label} htmlFor="instantLicence">
        {t("instant.licenceLabel")}
      </label>

      <select
        id="instantLicence"
        className={classes.select}
        value={value}
        onChange={(event) =>
          onChange(isInstantLicence(event.target.value) ? event.target.value : "")
        }
      >
        <option value="">{t("instant.licenceChoose")}</option>
        {instantLicences.map((licence) => (
          <option key={licence} value={licence}>
            {t(instantLicenceLabel(licence))}
          </option>
        ))}
      </select>

      <div className={classes.hint}>
        {isInstantLicence(value) ? t(instantLicenceText(value)) : t("instant.licenceHint")}
      </div>

      {error && <div className={classes.error}>{error}</div>}
    </div>
  );
};

export default InstantLicenceField;
