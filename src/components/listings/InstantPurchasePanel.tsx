import { Link, useNavigate } from "react-router-dom";
import {
  instantLicenceLabel,
  instantLicenceText,
  isInstantLicence,
  productFileDisplayName,
} from "../../domain/listings/instantDownloads";
import { useInstantListing, useStartInstantPurchase } from "../../hooks/listings/useInstantDownloads";
import { hasErrorMessage } from "../../lib/errorMessage";
import { useT } from "../../lib/i18n/i18n";
import { formatFileSize } from "../../lib/listings/deliveryFiles";

const classes = {
  panel: "space-y-3",
  title: "font-semibold",
  text: "text-sm leading-6 text-zinc-600",
  heading: "text-xs font-semibold uppercase tracking-wide text-zinc-500",
  files: "space-y-1 text-sm",
  file: "flex justify-between gap-3",
  fileName: "min-w-0 break-all text-zinc-800",
  fileSize: "shrink-0 text-zinc-500",
  button: "btnPrimary inline-flex",
  link: "btnPrimary inline-flex",
  note: "text-xs leading-5 text-zinc-500",
  error: "notice noticeError",
} as const;

type Props = {
  listingId: string;
  licence: string | null;
  userId: string | null;
  isOwnListing: boolean;
};

// The listing page's buy box for an instant download: what's included, the
// licence, and Buy now. A buyer who owns it goes to their downloads instead.
const InstantPurchasePanel = ({ listingId, licence, userId, isOwnListing }: Props) => {
  const t = useT();
  const navigate = useNavigate();
  const state = useInstantListing(listingId, userId);
  const start = useStartInstantPurchase();

  const files = state.data?.files ?? [];
  const ready = files.length > 0 && isInstantLicence(licence);

  const buy = async () => {
    const purchase = await start.mutateAsync(listingId);

    navigate(`/payments/checkout/${purchase.payment_id}`);
  };

  return (
    <div className={classes.panel}>
      <div className={classes.title}>{t("listing.instantTitle")}</div>
      <p className={classes.text}>{t("listing.instantText")}</p>

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
                <span className={classes.fileSize}>{formatFileSize(file.size_bytes, t)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.isLoading ? (
        <p className={classes.text}>{t("common.loading")}</p>
      ) : isOwnListing ? (
        <p className={classes.note}>{t("instant.ownListing")}</p>
      ) : state.data?.owned ? (
        <>
          <p className={classes.text}>{t("instant.owned")}</p>
          <Link className={classes.link} to="/downloads">
            {t("instant.goToDownloads")}
          </Link>
        </>
      ) : !ready ? (
        <p className={classes.note}>{t("instant.notReady")}</p>
      ) : !userId ? (
        <Link className={classes.link} to="/signin">
          {t("instant.signInToBuy")}
        </Link>
      ) : (
        <>
          <button
            type="button"
            className={classes.button}
            disabled={start.isPending}
            onClick={() => void buy().catch(() => undefined)}
          >
            {start.isPending
              ? t("instant.buying")
              : state.data?.pending_payment_id
                ? t("instant.continuePayment")
                : t("listing.instantButton")}
          </button>
          <p className={classes.note}>{t("instant.finalNote")}</p>
        </>
      )}

      {start.error && (
        <div className={classes.error}>
          {hasErrorMessage(start.error) ? start.error.message : t("instant.startFailed")}
        </div>
      )}
    </div>
  );
};

export default InstantPurchasePanel;
