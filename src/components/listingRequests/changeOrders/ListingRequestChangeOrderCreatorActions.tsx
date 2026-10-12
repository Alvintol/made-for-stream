import { hasErrorMessage } from "../../../lib/errorMessage";
import {
  canSendListingRequestChangeOrder,
  canWithdrawListingRequestChangeOrder,
} from "../../../domain/listings/listingRequestChangeOrders";
import type { ListingRequestChangeOrderRow } from "../../../hooks/creatorRequests/useListingRequestChangeOrders";

type ListingRequestChangeOrderCreatorActionsProps = {
  changeOrder: Pick<
    ListingRequestChangeOrderRow,
    "id" | "status" | "title"
  > | null;
  isPending?: boolean;
  error?: unknown;
  onSendChangeOrder: (
    changeOrderId: string
  ) => Promise<unknown> | unknown;
  isWithdrawing?: boolean;
  withdrawError?: unknown;
  onWithdrawChangeOrder: (
    changeOrderId: string
  ) => Promise<unknown> | unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  draft:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-800",
  error:
    "notice noticeError",
  actions: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",
} as const;

const getErrorMessage = (
  error: unknown,
  fallback: string
): string =>
  hasErrorMessage(error) ? error.message : fallback;

const ListingRequestChangeOrderCreatorActions = ({
  changeOrder,
  isPending = false,
  error,
  onSendChangeOrder,
  isWithdrawing = false,
  withdrawError,
  onWithdrawChangeOrder,
}: ListingRequestChangeOrderCreatorActionsProps) => {
  if (
    !changeOrder ||
    !canWithdrawListingRequestChangeOrder(changeOrder.status)
  ) {
    return null;
  }

  const isDraft = canSendListingRequestChangeOrder(
    changeOrder.status
  );

  const errorMessage = withdrawError
    ? getErrorMessage(
        withdrawError,
        "The project change order could not be withdrawn."
      )
    : error
      ? getErrorMessage(
          error,
          "The project change order could not be sent."
        )
      : null;

  const isBusy = isPending || isWithdrawing;

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            Change order actions
          </h2>

          <p className={classes.text}>
            {isDraft
              ? "This change order is saved as a private draft. Send it when it is ready for buyer review."
              : "This change order is with the buyer, who has not answered yet. Other project steps wait until they do."}{" "}
            To change or cancel it, withdraw it. You can then
            propose a new one, which starts from the same
            details.
          </p>
        </div>

        <div className={classes.draft}>
          {isDraft ? "Draft" : "Awaiting buyer review"}:{" "}
          {changeOrder.title}
        </div>

        {errorMessage && (
          <div className={classes.error}>
            {errorMessage}
          </div>
        )}

        <div className={classes.actions}>
          {isDraft && (
            <button
              className={classes.btnPrimary}
              disabled={isBusy}
              type="button"
              onClick={() =>
                void onSendChangeOrder(changeOrder.id)
              }
            >
              {isPending
                ? "Sending change order…"
                : "Send draft to buyer"}
            </button>
          )}

          <button
            className={classes.btnOutline}
            disabled={isBusy}
            type="button"
            onClick={() =>
              void onWithdrawChangeOrder(changeOrder.id)
            }
          >
            {isWithdrawing
              ? "Withdrawing change order…"
              : "Withdraw change order"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestChangeOrderCreatorActions;