import { useState } from "react";
import {
  checkListingAnimationFile,
  LISTING_ANIMATION_ACCEPT,
  type ListingAnimationKind,
} from "../../lib/listings/listingAnimatedPreview";
import { useT, type Translate } from "../../lib/i18n/i18n";
// What the page should do with the animated preview when the listing is
// saved: upload a new file, remove the current one, or leave it alone.
export type ListingAnimationChoice =
  | { action: "keep" }
  | { action: "upload"; file: File; kind: ListingAnimationKind }
  | { action: "remove" };

type ListingAnimatedPreviewFieldProps = {
  // True when the listing already has an animated preview.
  hasExisting: boolean;
  disabled?: boolean;
  onChange: (choice: ListingAnimationChoice) => void;
};

const classes = {
  wrap: "grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start",
  field: "space-y-2",
  label: "formLabel",
  hint: "formHint",
  error: "formError",
  input: "formControl",
  option: "flex items-start gap-3 text-sm font-semibold text-zinc-900",
  warning: "notice noticeWarning space-y-2",
  warningTitle: "text-sm font-bold",
  warningText: "text-sm",
} as const;

const formatMegabytes = (bytes: number, t: Translate) =>
  t("fileSize.mb", { size: (bytes / (1024 * 1024)).toFixed(1) });

// The optional GIF or short video shown on the listing's own page. Nothing is uploaded
// here; the page uploads it when the listing is saved.
const ListingAnimatedPreviewField = ({
  hasExisting,
  disabled = false,
  onChange,
}: ListingAnimatedPreviewFieldProps) => {
  const t = useT();
  const [chosen, setChosen] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;

    const check = await checkListingAnimationFile(file, t);

    if (check.error !== null) {
      setError(check.error);
      return;
    }

    setError(null);
    setChosen(file);
    setRemove(false);
    onChange({ action: "upload", file, kind: check.kind });
  };

  const handleRemove = (checked: boolean) => {
    setRemove(checked);
    setChosen(null);
    onChange(checked ? { action: "remove" } : { action: "keep" });
  };

  return (
    <div className={classes.wrap}>
      <div className={classes.field}>
        <label className={classes.label} htmlFor="animatedPreview">
          {t("animationField.label")}
        </label>

        <input
          id="animatedPreview"
          className={classes.input}
          type="file"
          accept={LISTING_ANIMATION_ACCEPT}
          disabled={disabled}
          onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
        />

        <p className={classes.hint}>
          {t("animationField.hint")}
        </p>

        {error && (
          <p className={classes.error} role="alert">
            {error}
          </p>
        )}

        {chosen && (
          <p className={classes.hint} role="status">
            {t("animationField.ready", { name: chosen.name, size: formatMegabytes(chosen.size, t) })}
          </p>
        )}

        {hasExisting && !chosen && (
          <>
            <p className={classes.hint}>
              {t("animationField.existing")}
            </p>

            <label className={classes.option} htmlFor="removeAnimatedPreview">
              <input
                id="removeAnimatedPreview"
                type="checkbox"
                checked={remove}
                disabled={disabled}
                onChange={(event) => handleRemove(event.target.checked)}
              />
              <span>{t("animationField.remove")}</span>
            </label>
          </>
        )}
      </div>

      <div className={classes.warning}>
        <div className={classes.warningTitle}>{t("animationField.warningTitle")}</div>

        <p className={classes.warningText}>
          {t("animationField.warning1")}
        </p>

        <p className={classes.warningText}>
          {t("animationField.warning2")}
        </p>

        <p className={classes.warningText}>
          {t("animationField.warning3")}
        </p>
      </div>
    </div>
  );
};

export default ListingAnimatedPreviewField;
