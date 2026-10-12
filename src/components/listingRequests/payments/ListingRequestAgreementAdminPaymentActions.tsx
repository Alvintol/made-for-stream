import { hasErrorMessage } from "../../../lib/errorMessage";
import { formatMoney } from "../../../lib/formatMoney";
import { getListingRequestPaymentStructureLabel } from "../../../domain/listings/listingRequestAgreements";
import type { ListingRequestAgreementRow } from "../../../hooks/creatorRequests/useListingRequestAgreement";

type AdminPaymentAgreement = Pick<
  ListingRequestAgreementRow,
  | "id"
  | "status"
  | "starting_payment_status"
  | "payment_structure"
  | "deposit_amount"
  | "total_amount"
  | "currency"
>;

type ListingRequestAgreementAdminPaymentActionsProps = {
  agreement: AdminPaymentAgreement | null;
  isPending?: boolean;
  error?: unknown;
  onConfirmPayment: (agreementId: string) => Promise<unknown> | unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  warning:
    "notice noticeWarning",
  metaGrid: "grid gap-4 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "metaLabel",
  metaValue: "text-sm font-semibold text-zinc-900",
  errorBox:
    "notice noticeError",
  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
} as const;

const getStartingPaymentAmount = (
  agreement: Pick<
    ListingRequestAgreementRow,
    "deposit_amount" | "total_amount"
  >
): number => agreement.deposit_amount ?? agreement.total_amount;

const getErrorMessage = (error: unknown): string =>
  hasErrorMessage(error)
    ? error.message
    : "The starting payment could not be confirmed.";

const ListingRequestAgreementAdminPaymentActions = ({
  agreement,
  isPending = false,
  error,
  onConfirmPayment,
}: ListingRequestAgreementAdminPaymentActionsProps) => {
  if (
    !agreement ||
    agreement.status !== "buyer_accepted" ||
    agreement.starting_payment_status !== "payment_required"
  ) {
    return null;
  }

  const startingPaymentAmount = getStartingPaymentAmount(agreement);
  const errorMessage = error ? getErrorMessage(error) : null;

  const handleConfirmPayment = () => {
    const confirmed = window.confirm(
      "Confirm that the required starting payment has been independently verified as paid? This will allow work to begin."
    );

    if (!confirmed) {
      return;
    }

    void onConfirmPayment(agreement.id);
  };

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>Starting payment confirmation</h2>

          <p className={classes.text}>
            Confirm the required starting payment only after the payment has
            been independently verified.
          </p>
        </div>

        <div className={classes.warning}>
          Confirming this payment will close the starting-payment hold and mark
          the project as ready for work.
        </div>

        <div className={classes.metaGrid}>
          <div className={classes.metaBlock}>
            <div className={classes.metaLabel}>Payment structure</div>

            <div className={classes.metaValue}>
              {getListingRequestPaymentStructureLabel(
                agreement.payment_structure
              )}
            </div>
          </div>

          <div className={classes.metaBlock}>
            <div className={classes.metaLabel}>Amount to confirm</div>

            <div className={classes.metaValue}>
              {formatMoney(startingPaymentAmount, agreement.currency)}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className={classes.errorBox}>{errorMessage}</div>
        )}

        <div className={classes.row}>
          <button
            className={classes.btnPrimary}
            type="button"
            disabled={isPending}
            onClick={handleConfirmPayment}
          >
            {isPending
              ? "Confirming starting payment…"
              : "Confirm starting payment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestAgreementAdminPaymentActions;