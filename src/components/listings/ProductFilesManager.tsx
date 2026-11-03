import { useState, type ChangeEvent } from "react";
import {
  deliveryFileExtensions,
  deliveryFileTypesMessage,
  isAllowedDeliveryFileName,
  isSystemJunkFile,
} from "../../domain/listings/deliveryFileTypes";
import {
  PRODUCT_FILES_MAX_COUNT,
  productFileDisplayName,
} from "../../domain/listings/instantDownloads";
import {
  useDeleteProductFile,
  useMyProductFiles,
  useUploadProductFile,
} from "../../hooks/listings/useInstantDownloads";
import { useT } from "../../lib/i18n/i18n";
import { DELIVERY_FILE_MAX_BYTES, formatFileSize, isZipFile } from "../../lib/listings/deliveryFiles";
import { listZipEntryNames } from "../../lib/zip";

const classes = {
  card: "card space-y-3 p-6",
  title: "sectionHeading",
  text: "text-sm text-zinc-600",
  list: "divide-y divide-zinc-200 rounded-2xl border border-zinc-200",
  item: "flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm",
  name: "min-w-0 break-all font-medium text-zinc-900",
  size: "text-xs text-zinc-500",
  row: "flex items-center gap-3",
  input: "formControl",
  btn: "btnOutline btnSm",
  empty: "notice noticeWarning",
  error: "notice noticeError",
} as const;

// The files an instant download sells. Uploaded straight to the private
// bucket, where the database allows only the listing's creator, these file
// types and up to 10 files. Changes reach everyone who has bought it.
const ProductFilesManager = ({ listingId }: { listingId: string }) => {
  const t = useT();
  const files = useMyProductFiles(listingId);
  const upload = useUploadProductFile(listingId);
  const remove = useDeleteProductFile(listingId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const current = files.data ?? [];

  // Loose files are checked by name; a zip by the names inside it.
  const refusedNames = async (chosen: File[]): Promise<string[] | null> => {
    const refused = chosen.filter((file) => !isAllowedDeliveryFileName(file.name)).map((file) => file.name);

    for (const zip of chosen.filter((file) => isZipFile(file))) {
      const listing = await listZipEntryNames(zip).catch(() => null);

      if (!listing || listing.encrypted) {
        setError(t("deliveryFiles.zipUnreadable", { name: zip.name }));
        return null;
      }

      refused.push(
        ...listing.names
          .filter((name) => !name.endsWith("/") && !isSystemJunkFile(name))
          .filter((name) => !isAllowedDeliveryFileName(name))
          .map((name) => `${zip.name}: ${name}`),
      );
    }

    return refused;
  };

  const onChoose = async (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";

    if (chosen.length === 0) return;

    setError(null);

    if (current.length + chosen.length > PRODUCT_FILES_MAX_COUNT) {
      setError(t("productFiles.tooMany", { count: PRODUCT_FILES_MAX_COUNT }));
      return;
    }

    const tooBig = chosen.find((file) => file.size > DELIVERY_FILE_MAX_BYTES);

    if (tooBig) {
      setError(t("deliveryFiles.fileTooBig", { name: tooBig.name }));
      return;
    }

    const refused = await refusedNames(chosen);

    if (!refused) return;

    if (refused.length > 0) {
      setError(deliveryFileTypesMessage(refused, t));
      return;
    }

    setBusy(true);

    try {
      for (const file of chosen) {
        await upload.mutateAsync(file).catch(() => {
          throw new Error(t("productFiles.uploadFailed", { name: file.name }));
        });
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t("productFiles.uploadFailed", { name: "" }));
    } finally {
      setBusy(false);
    }
  };

  const onRemove = (path: string, name: string) => {
    if (!window.confirm(t("productFiles.confirmDelete", { name }))) return;

    setError(null);
    remove.mutate(path, { onError: () => setError(t("productFiles.deleteFailed")) });
  };

  return (
    <section className={classes.card}>
      <h2 className={classes.title}>{t("productFiles.title")}</h2>
      <p className={classes.text}>{t("productFiles.text", { count: PRODUCT_FILES_MAX_COUNT })}</p>

      {files.isError && <div className={classes.error}>{t("productFiles.loadFailed")}</div>}

      {files.data && current.length === 0 && <div className={classes.empty}>{t("productFiles.empty")}</div>}

      {current.length > 0 && (
        <ul className={classes.list}>
          {current.map((file) => {
            const name = productFileDisplayName(file.name);

            return (
              <li key={file.path ?? file.name} className={classes.item}>
                <span className={classes.name}>{name}</span>
                <span className={classes.row}>
                  <span className={classes.size}>{formatFileSize(file.size_bytes, t)}</span>
                  {file.path && (
                    <button
                      type="button"
                      className={classes.btn}
                      disabled={remove.isPending}
                      onClick={() => onRemove(file.path ?? "", name)}
                    >
                      {t("productFiles.delete")}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {current.length < PRODUCT_FILES_MAX_COUNT && (
        <label className={classes.row}>
          <span className="sr-only">{t("productFiles.add")}</span>
          <input
            className={classes.input}
            type="file"
            multiple
            disabled={busy}
            accept={deliveryFileExtensions.map((extension) => `.${extension}`).join(",")}
            onChange={(event) => void onChoose(event)}
          />
          {busy && <span className={classes.size}>{t("productFiles.uploading")}</span>}
        </label>
      )}

      {error && <div className={classes.error}>{error}</div>}
    </section>
  );
};

export default ProductFilesManager;
