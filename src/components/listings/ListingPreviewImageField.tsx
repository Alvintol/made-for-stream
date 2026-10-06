import { useEffect, useState } from "react";
import {
  getListingPreviewWatermarkText,
  LISTING_PREVIEW_ACCEPT,
  renderListingPreviewImage,
  validateListingPreviewSource,
} from "../../lib/listings/listingPreviewImage";

export type ListingPreviewSelection = {
  // The prepared copy, ready to upload when the listing is saved.
  blob: Blob;
  watermarked: boolean;
};

type ListingPreviewImageFieldProps = {
  // The image the listing already has, if any.
  existingUrl: string | null;
  handle: string | null | undefined;
  disabled?: boolean;
  onChange: (selection: ListingPreviewSelection | null) => void;
};

const classes = {
  wrap: "grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start",
  field: "space-y-2",
  label: "formLabel",
  hint: "formHint",
  error: "formError",
  input: "formControl",
  preview: "w-full rounded-2xl border border-zinc-200 bg-zinc-100 object-contain",
  empty:
    "flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 text-center text-sm font-semibold text-zinc-500",
  panel: "space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4",
  panelTitle: "text-sm font-bold text-zinc-900",
  panelText: "text-sm text-zinc-600",
  option: "flex items-start gap-3 text-sm font-semibold text-zinc-900",
  list: "list-disc space-y-1 pl-5 text-sm text-zinc-600",
} as const;

// The listing's thumbnail: pick a file, see exactly what buyers will see,
// and choose whether it carries the watermark. Nothing is uploaded here;
// the page uploads the prepared copy when the listing is saved.
const ListingPreviewImageField = ({
  existingUrl,
  handle,
  disabled = false,
  onChange,
}: ListingPreviewImageFieldProps) => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [watermark, setWatermark] = useState(true);
  const [preparedUrl, setPreparedUrl] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const watermarkText = getListingPreviewWatermarkText(handle);

  // Re-prepare whenever the file or the watermark choice changes, so the
  // picture on screen is always the one that will be uploaded.
  useEffect(() => {
    if (!sourceFile) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    setIsPreparing(true);
    setError(null);

    renderListingPreviewImage(sourceFile, {
      watermarkText: watermark ? watermarkText : null,
    })
      .then((blob) => {
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setPreparedUrl(objectUrl);
        onChange({ blob, watermarked: watermark });
      })
      .catch(() => {
        if (cancelled) return;

        setPreparedUrl(null);
        setError("That image could not be read. Try a different file.");
        onChange(null);
      })
      .finally(() => {
        if (!cancelled) setIsPreparing(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // onChange is the parent's setter; re-running for a new function
    // identity would re-prepare the image on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFile, watermark, watermarkText]);

  const handleFile = (file: File | null) => {
    if (!file) return;

    const sourceError = validateListingPreviewSource(file);

    if (sourceError) {
      setError(sourceError);
      return;
    }

    setSourceFile(file);
  };

  const shownUrl = sourceFile ? preparedUrl : existingUrl;

  return (
    <div className={classes.wrap}>
      <div className={classes.field}>
        <label className={classes.label} htmlFor="previewImage">
          Preview image
        </label>

        <input
          id="previewImage"
          className={classes.input}
          type="file"
          accept={LISTING_PREVIEW_ACCEPT}
          disabled={disabled}
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        />

        <p className={classes.hint}>
          JPEG, PNG or WebP, up to 20 MB. A listing needs an image before it can be published.
        </p>

        {error && (
          <p className={classes.error} role="alert">
            {error}
          </p>
        )}

        {isPreparing ? (
          <div className={classes.empty}>Preparing your image…</div>
        ) : shownUrl ? (
          <img
            className={classes.preview}
            src={shownUrl}
            alt={sourceFile ? "Your preview image as buyers will see it" : "Current preview image"}
          />
        ) : (
          <div className={classes.empty}>No preview image yet</div>
        )}

        {!sourceFile && existingUrl && (
          <p className={classes.hint}>
            This is the current image. Choose a file to replace it.
          </p>
        )}
      </div>

      <div className={classes.panel}>
        <div className={classes.panelTitle}>How your image is protected</div>

        <ul className={classes.list}>
          <li>We upload a smaller copy, at most 1200 pixels on its longest side.</li>
          <li>Your original file stays on your device. Buyers cannot download it from the page.</li>
          <li>Hidden details in the file, such as where a photo was taken, are removed.</li>
        </ul>

        <label className={classes.option} htmlFor="previewWatermark">
          <input
            id="previewWatermark"
            type="checkbox"
            checked={watermark}
            disabled={disabled}
            onChange={(event) => setWatermark(event.target.checked)}
          />
          <span>Add a watermark</span>
        </label>

        <p className={classes.panelText}>
          Repeats “{watermarkText}” faintly across the image, so a copied picture is clearly
          yours. A watermark discourages copying; it cannot fully prevent it.
        </p>

        <p className={classes.panelText}>Watermarks are free during early access.</p>
      </div>
    </div>
  );
};

export default ListingPreviewImageField;
