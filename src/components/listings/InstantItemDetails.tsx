import {
  instantLicenceLabel,
  instantLicenceText,
  isInstantLicence,
  productFileDisplayName,
  type ProductFile,
} from "../../domain/listings/instantDownloads";
import { useT } from "../../lib/i18n/i18n";
import { productFileMeta } from "./productFileMeta";

const classes = {
  heading: "text-xs font-semibold uppercase tracking-wide text-zinc-500",
  text: "text-sm leading-6 text-zinc-600",
  files: "space-y-1 text-sm",
  file: "flex flex-col",
  fileName: "min-w-0 break-all text-zinc-800",
  fileSize: "shrink-0 text-zinc-500",
  note: "text-xs leading-5 text-zinc-500",
} as const;

// An instant download's licence and files, each with its size and measured
// dimensions or length: on the listing's buy box and again at checkout.
const InstantItemDetails = ({ licence, files }: { licence: string | null; files: ProductFile[] }) => {
  const t = useT();

  return (
    <>
      {isInstantLicence(licence) && (
        <div>
          <div className={classes.heading}>
            {t("instant.licenceLabel")}: {t(instantLicenceLabel(licence))}
          </div>
          <p className={classes.text}>{t(instantLicenceText(licence))}</p>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <div className={classes.heading}>{t("instant.included")}</div>
          <ul className={classes.files}>
            {files.map((file) => (
              <li key={file.name} className={classes.file}>
                <span className={classes.fileName}>{productFileDisplayName(file.name)}</span>
                <span className={classes.fileSize}>{productFileMeta(file, t)}</span>
              </li>
            ))}
          </ul>
          <p className={classes.note}>{t("fileDetails.measured")}</p>
        </div>
      )}
    </>
  );
};

export default InstantItemDetails;
