import { hasErrorMessage } from "../../../lib/errorMessage";
import { canSendListingRequestAgreement } from "../../../domain/listings/listingRequestAgreements";
import type { ListingRequestAgreementRow } from "../../../hooks/creatorRequests/useListingRequestAgreement";
import { useT, type Translate } from "../../../lib/i18n/i18n";
type ListingRequestAgreementCreatorActionsProps = {
  agreement: Pick<ListingRequestAgreementRow, "id" | "status"> | null;
  isPending?: boolean;
  error?: unknown;
  onSendAgreement: (agreementId: string) => Promise<unknown> | unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
  errorBox:
    "notice noticeError",
} as const;

const getErrorMessage = (error: unknown, t: Translate): string =>
  hasErrorMessage(error)
    ? error.message
    : t("agreementActions.failed");

const ListingRequestAgreementCreatorActions = ({
  agreement,
  isPending = false,
  error,
  onSendAgreement,
}: ListingRequestAgreementCreatorActionsProps) => {
  const t = useT();

  if (!agreement || !canSendListingRequestAgreement(agreement.status)) {
    return null;
  }

  const sendErrorMessage = error ? getErrorMessage(error, t) : null;

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>{t("agreementActions.title")}</h2>

          <p className={classes.text}>{t("agreementActions.text")}</p>
        </div>

        {sendErrorMessage && (
          <div className={classes.errorBox}>{sendErrorMessage}</div>
        )}

        <div className={classes.row}>
          <button
            className={classes.btnPrimary}
            type="button"
            disabled={isPending}
            onClick={() => void onSendAgreement(agreement.id)}
          >
            {t(isPending ? "agreementActions.sending" : "creatorActions.send")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestAgreementCreatorActions;