import { hasErrorMessage } from "../../../lib/errorMessage";
import { canSendListingRequestAgreement } from "../../../domain/listings/listingRequestAgreements";
import type { ListingRequestAgreementRow } from "../../../hooks/creatorRequests/useListingRequestAgreement";

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

const getErrorMessage = (error: unknown): string =>
  hasErrorMessage(error)
    ? error.message
    : "The project agreement could not be sent right now.";

const ListingRequestAgreementCreatorActions = ({
  agreement,
  isPending = false,
  error,
  onSendAgreement,
}: ListingRequestAgreementCreatorActionsProps) => {
  if (!agreement || !canSendListingRequestAgreement(agreement.status)) {
    return null;
  }

  const sendErrorMessage = error ? getErrorMessage(error) : null;

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>Project agreement actions</h2>

          <p className={classes.text}>
            This agreement is saved as a draft. Send it to the buyer when it is
            ready for review and acknowledgement.
          </p>
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
            {isPending ? "Sending agreement…" : "Send draft to buyer"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestAgreementCreatorActions;