import { useState } from "react";
import {
  checkListingAnimationFile,
  LISTING_ANIMATION_ACCEPT,
  type ListingAnimationKind,
} from "../../lib/listings/listingAnimatedPreview";

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

const formatMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// The optional GIF or short video shown on the listing's own page. Nothing is uploaded
// here; the page uploads it when the listing is saved.
const ListingAnimatedPreviewField = ({
  hasExisting,
  disabled = false,
  onChange,
}: ListingAnimatedPreviewFieldProps) => {
  const [chosen, setChosen] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;

    const check = await checkListingAnimationFile(file);

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
          Animated preview (optional)
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
          An animated GIF, or an MP4 or WebM video, up to 8 MB. It shows only on your listing's
          page, plays once, and then offers a Play again button. Videos play without sound. MP4
          plays on every device; WebM may not play on older iPhones. Cards and search always
          show the still image above.
        </p>

        {error && (
          <p className={classes.error} role="alert">
            {error}
          </p>
        )}

        {chosen && (
          <p className={classes.hint} role="status">
            Ready to upload when you save: {chosen.name} ({formatMegabytes(chosen.size)}).
          </p>
        )}

        {hasExisting && !chosen && (
          <>
            <p className={classes.hint}>
              This listing already has an animated preview. Choose a file to replace it.
            </p>

            <label className={classes.option} htmlFor="removeAnimatedPreview">
              <input
                id="removeAnimatedPreview"
                type="checkbox"
                checked={remove}
                disabled={disabled}
                onChange={(event) => handleRemove(event.target.checked)}
              />
              <span>Remove the animated preview</span>
            </label>
          </>
        )}
      </div>

      <div className={classes.warning}>
        <div className={classes.warningTitle}>Animated previews are not copy-protected</div>

        <p className={classes.warningText}>
          Your file is uploaded exactly as you made it. It is not shrunk and not watermarked.
        </p>

        <p className={classes.warningText}>
          We hide the file's address on the page and block right-click saving, but someone
          determined can still copy it.
        </p>

        <p className={classes.warningText}>
          Upload a short, low-resolution clip. Never upload the finished work.
        </p>
      </div>
    </div>
  );
};

export default ListingAnimatedPreviewField;
