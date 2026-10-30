import { useState } from "react";

import UsageMeter from "../../ui/UsageMeter";
import {
  deliveryFileExtensions,
  deliveryFileTypeGroups,
  deliveryFileTypesMessage,
  isAllowedDeliveryFileName,
  isSystemJunkFile,
} from "../../../domain/listings/deliveryFileTypes";
import { useT } from "../../../lib/i18n/i18n";
import { listZipEntryNames } from "../../../lib/zip";
import type { CommissionStorageUsage } from "../../../hooks/creatorRequests/useCommissionStorageUsage";
import {
  DELIVERY_FILES_MAX_COUNT,
  FOLDER_ZIP_MAX_BYTES,
  folderZipName,
  formatFileSize,
  isZipFile,
  toStorageFileName,
  validateDeliveryFiles,
  zipFiles,
} from "../../../lib/listings/deliveryFiles";

type DeliveryFilesFieldProps = {
  files: File[];
  // This commission's storage, when known (it is loaded separately).
  usage?: CommissionStorageUsage | null;
  // What a zip made here is called, without ".zip": the creator's handle
  // and the commission's title. Spaces become underscores
  // ("meowington_222222222_updated_deliverables.zip").
  zipBaseName?: string;
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
const DeliveryFilesField = ({
  files,
  usage = null,
  zipBaseName,
  disabled = false,
  onChange,
}: DeliveryFilesFieldProps) => {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  const busy = disabled || isZipping;
  const looseFiles = files.filter((file) => !isZipFile(file));

  const remainingBytes = usage ? usage.limitBytes - usage.usedBytes : null;
  const selectedBytes = files.reduce((sum, file) => sum + file.size, 0);

  const apply = (next: File[]) => {
    const problem = validateDeliveryFiles(next, remainingBytes, t);
    setError(problem);
    if (!problem) onChange(next);
  };

  // Loose files are checked by name; a zip by the names inside it. Anything
  // not on the list stops the whole choice, and the message names it.
  const addFiles = async (chosen: File[]) => {
    const refused = chosen
      .filter((file) => !isAllowedDeliveryFileName(file.name))
      .map((file) => file.name);

    for (const zip of chosen.filter((file) => isZipFile(file))) {
      const listing = await listZipEntryNames(zip).catch(() => null);

      if (!listing || listing.encrypted) {
        setError(t("deliveryFiles.zipUnreadable", { name: zip.name }));
        return;
      }

      refused.push(
        ...listing.names
          .filter((name) => !name.endsWith("/") && !isSystemJunkFile(name))
          .filter((name) => !isAllowedDeliveryFileName(name))
          .map((name) => `${zip.name}: ${name}`)
      );
    }

    if (refused.length > 0) {
      setError(deliveryFileTypesMessage(refused, t));
      return;
    }

    apply([...files, ...chosen]);
  };

  const zipFolder = (chosen: File[]) => {
    const kept = chosen.filter(
      (file) => !isSystemJunkFile(file.webkitRelativePath || file.name)
    );
    const refused = kept
      .filter((file) => !isAllowedDeliveryFileName(file.name))
      .map((file) => file.webkitRelativePath || file.name);

    if (refused.length > 0) {
      setError(deliveryFileTypesMessage(refused, t));
      return;
    }

    if (kept.length > 0) {
      void zipInto(kept, toStorageFileName(zipBaseName ? `${zipBaseName}.zip` : folderZipName(chosen)), files);
    }
  };

  const zipInto = async (chosen: File[], zipName: string, keep: File[]) => {
    if (chosen.reduce((sum, file) => sum + file.size, 0) > FOLDER_ZIP_MAX_BYTES) {
      setError(t("deliveryFiles.tooBigToZip"));
      return;
    }

    setIsZipping(true);
    setError(null);

    try {
      apply([...keep, await zipFiles(chosen, zipName)]);
    } catch {
      setError(t("deliveryFiles.zipFailed"));
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className={classes.field}>
      <span className={classes.label}>{t("files.title")}</span>

      <div className={classes.tip}>
        <p>
          <span className={classes.tipTitle}>{t("deliveryFiles.tipTitle")}</span>{" "}
          {t("deliveryFiles.tip")}
        </p>
      </div>

      {usage && (
        <UsageMeter
          detail={t("deliveryFiles.storageDetail", { plan: usage.planLabel })}
          label={t("deliveryFiles.storageLabel")}
          limitBytes={usage.limitBytes}
          pendingBytes={selectedBytes}
          usedBytes={usage.usedBytes}
        />
      )}

      <div className={classes.inputs}>
        <label className={classes.inputLabel}>
          <span>{t("deliveryFiles.uploadFolder")}</span>
          <input
            className={classes.input}
            disabled={busy}
            multiple
            type="file"
            {...({ webkitdirectory: "" } as Record<string, string>)}
            onChange={(event) => {
              const chosen = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              if (chosen.length > 0) zipFolder(chosen);
            }}
          />
        </label>

        <label className={classes.inputLabel}>
          <span>{t("deliveryFiles.addFiles")}</span>
          <input
            accept={deliveryFileExtensions.map((extension) => `.${extension}`).join(",")}
            className={classes.input}
            disabled={busy}
            multiple
            type="file"
            onChange={(event) => {
              const chosen = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              if (chosen.length > 0) void addFiles(chosen);
            }}
          />
        </label>
      </div>

      <p className={classes.help}>
        {t("deliveryFiles.help", {
          count: DELIVERY_FILES_MAX_COUNT,
          groups: deliveryFileTypeGroups.map((group) => t(`fileGroup.${group.key}`)).join(", "),
        })}
      </p>

      {isZipping && <p className={classes.help}>{t("deliveryFiles.zipping")}</p>}

      {files.length > 0 && (
        <ul className={classes.list}>
          {files.map((file, index) => (
            <li className={classes.item} key={`${file.name}-${index}`}>
              <span className={classes.name}>
                {file.name} <span className={classes.size}>{formatFileSize(file.size, t)}</span>
              </span>

              <button
                className={classes.btn}
                disabled={busy}
                type="button"
                onClick={() => apply(files.filter((_, current) => current !== index))}
              >
                {t("deliveryFiles.remove", { name: file.name })}
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
                toStorageFileName(zipBaseName ? `${zipBaseName}.zip` : "delivery.zip"),
                files.filter((file) => isZipFile(file)),
              )
            }
          >
            {t("deliveryFiles.zipThese", { count: looseFiles.length })}
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
