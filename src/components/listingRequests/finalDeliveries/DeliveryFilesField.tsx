import { useState } from "react";

import {
  DELIVERY_FILES_MAX_COUNT,
  folderZipName,
  formatFileSize,
  isZipFile,
  validateDeliveryFiles,
  zipFiles,
} from "../../../lib/listings/deliveryFiles";

type DeliveryFilesFieldProps = {
  files: File[];
  disabled?: boolean;
  onChange: (files: File[]) => void;
};

const classes = {
  field: "space-y-3",
  label: "formLabel",
  tip: "notice noticeNeutral",
  tipTitle: "font-semibold",
  inputs: "grid gap-3 sm:grid-cols-2",
  inputLabel: "space-y-1 text-sm font-semibold text-zinc-800",
  input: "formControl",
  help: "formHint",
  list: "divide-y divide-zinc-200 rounded-2xl border border-zinc-200",
  item: "flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm",
  name: "min-w-0 break-all font-medium text-zinc-900",
  size: "text-xs text-zinc-500",
  row: "flex flex-wrap items-center gap-2",
  btn: "btnOutline btnSm",
  errorText: "formError",
} as const;

// The "Files" part of the final delivery form. A folder is always zipped in
// the browser first; loose files can be zipped into one with a button. One
// .zip is what the form recommends.
const DeliveryFilesField = ({ files, disabled = false, onChange }: DeliveryFilesFieldProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  const busy = disabled || isZipping;
  const looseFiles = files.filter((file) => !isZipFile(file));

  const apply = (next: File[]) => {
    const problem = validateDeliveryFiles(next);
    setError(problem);
    if (!problem) onChange(next);
  };

  const zipInto = async (chosen: File[], zipName: string, keep: File[]) => {
    setIsZipping(true);
    setError(null);

    try {
      apply([...keep, await zipFiles(chosen, zipName)]);
    } catch {
      setError("Those files could not be zipped here. Zip them on your computer and add the .zip.");
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className={classes.field}>
      <span className={classes.label}>Files</span>

      <div className={classes.tip}>
        <p>
          <span className={classes.tipTitle}>Recommended: one .zip file.</span> A zip keeps
          folders together, downloads in one go and takes less space for files such as
          PSDs, project files and fonts. Choose a folder below and it is zipped for you,
          here in your browser. Images and video that are already compressed barely
          shrink, but are still easier to receive as one zip.
        </p>
      </div>

      <div className={classes.inputs}>
        <label className={classes.inputLabel}>
          <span>Upload a folder (zipped for you)</span>
          <input
            className={classes.input}
            disabled={busy}
            multiple
            type="file"
            {...({ webkitdirectory: "" } as Record<string, string>)}
            onChange={(event) => {
              const chosen = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              if (chosen.length > 0) void zipInto(chosen, folderZipName(chosen), files);
            }}
          />
        </label>

        <label className={classes.inputLabel}>
          <span>Add files</span>
          <input
            className={classes.input}
            disabled={busy}
            multiple
            type="file"
            onChange={(event) => {
              const chosen = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              if (chosen.length > 0) apply([...files, ...chosen]);
            }}
          />
        </label>
      </div>

      <p className={classes.help}>
        Optional. Up to {DELIVERY_FILES_MAX_COUNT} files, 1 GB each and 5 GB in all; anything
        bigger can go in a link. Files are private: the buyer can download them once nothing
        is owed for the final release. They are deleted 180 days after the commission
        closes, so the buyer should keep their own copy.
      </p>

      {isZipping && <p className={classes.help}>Zipping your files…</p>}

      {files.length > 0 && (
        <ul className={classes.list}>
          {files.map((file, index) => (
            <li className={classes.item} key={`${file.name}-${index}`}>
              <span className={classes.name}>
                {file.name} <span className={classes.size}>{formatFileSize(file.size)}</span>
              </span>

              <button
                className={classes.btn}
                disabled={busy}
                type="button"
                onClick={() => apply(files.filter((_, current) => current !== index))}
              >
                Remove {file.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      {looseFiles.length > 1 && (
        <div className={classes.row}>
          <button
            className={classes.btn}
            disabled={busy}
            type="button"
            onClick={() =>
              void zipInto(
                looseFiles,
                "delivery.zip",
                files.filter((file) => isZipFile(file)),
              )
            }
          >
            Zip these {looseFiles.length} files into one
          </button>
        </div>
      )}

      {error && (
        <p className={classes.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default DeliveryFilesField;
