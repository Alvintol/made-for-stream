import { hasErrorMessage } from "../../../lib/errorMessage";
import { formatMoney } from "../../../lib/formatMoney";
import type {
  ListingRequestAgreementRow,
  ListingRequestPaymentScheduleItemRow,
} from "../../../hooks/creatorRequests/useListingRequestAgreement";

type ListingRequestFinalBalancePaymentAdminActionsProps = {
  agreement: Pick<
    ListingRequestAgreementRow,
    "listing_request_payment_schedule_items"
  > | null;
  isPending?: boolean;
  error?: unknown;
  onConfirmPayment: (
    paymentScheduleItemId: string
  ) => Promise<unknown> | unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  notice:
    "notice noticeWarning",
  list: "space-y-3",
  item:
    "rounded-2xl border border-zinc-200 bg-white px-4 py-4",
  itemHeader:
    "flex flex-wrap items-start justify-between gap-3",
  itemTitle: "font-extrabold text-zinc-900",
  itemText: "mt-1 text-sm text-zinc-600",
  amount: "text-sm font-extrabold text-zinc-900",
  errorBox:
    "notice noticeError",
  actions: "mt-4 flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
} as const;

const getErrorMessage = (error: unknown): string =>
  hasErrorMessage(error)
    ? error.message
    : "The final-balance payment could not be confirmed.";

const getPendingFinalBalancePayments = (
  agreement: Pick<
    ListingRequestAgreementRow,
    "listing_request_payment_schedule_items"
  >
): ListingRequestPaymentScheduleItemRow[] =>
  agreement.listing_request_payment_schedule_items
    .filter(
      (paymentItem) =>
        paymentItem.payment_timing ===
          "due_before_final_release" &&
        paymentItem.status === "payment_required" &&
        paymentItem.amount > 0
    )
    .sort(
      (firstPaymentItem, secondPaymentItem) =>
        firstPaymentItem.sort_order -
        secondPaymentItem.sort_order
    );

const ListingRequestFinalBalancePaymentAdminActions = ({
  agreement,
  isPending = false,
  error,
  onConfirmPayment,
}: ListingRequestFinalBalancePaymentAdminActionsProps) => {
  if (!agreement) {
    return null;
  }

  const pendingPayments =
    getPendingFinalBalancePayments(agreement);

  if (pendingPayments.length === 0) {
    return null;
  }

  const errorMessage = error
    ? getErrorMessage(error)
    : null;

  const handleConfirmPayment = (
    paymentItem: ListingRequestPaymentScheduleItemRow
  ) => {
    const confirmed = window.confirm(
      `Confirm that the final-balance payment "${paymentItem.title}" has been independently verified as paid?`
    );

    if (!confirmed) {
      return;
    }

    void onConfirmPayment(paymentItem.id);
  };

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            Final-balance payment confirmation
          </h2>

          <p className={classes.text}>
            Confirm each final-balance payment only after
            payment has been independently verified.
          </p>
        </div>

        <div className={classes.notice}>
          Buyer approval remains blocked until every
          required final-balance payment has been
          confirmed.
        </div>

        {errorMessage && (
          <div className={classes.errorBox}>
            {errorMessage}
          </div>
        )}

        <div className={classes.list}>
          {pendingPayments.map((paymentItem) => (
            <div
              className={classes.item}
              key={paymentItem.id}
            >
              <div className={classes.itemHeader}>
                <div>
                  <div className={classes.itemTitle}>
                    {paymentItem.title}
                  </div>

                  {paymentItem.description && (
                    <div className={classes.itemText}>
                      {paymentItem.description}
                    </div>
                  )}
                </div>

                <div className={classes.amount}>
                  {formatMoney(
                    paymentItem.amount,
                    paymentItem.currency
                  )}
                </div>
              </div>

              <div className={classes.actions}>
                <button
                  className={classes.btnPrimary}
                  disabled={isPending}
                  type="button"
                  onClick={() =>
                    handleConfirmPayment(paymentItem)
                  }
                >
                  {isPending
                    ? "Confirming payment…"
                    : "Confirm final-balance payment"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ListingRequestFinalBalancePaymentAdminActions;