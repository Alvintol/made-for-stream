import { hasErrorMessage } from "../../../lib/errorMessage";
import {
  canSendListingRequestChangeOrder,
  canWithdrawListingRequestChangeOrder,
} from "../../../domain/listings/listingRequestChangeOrders";
import type { ListingRequestChangeOrderRow } from "../../../hooks/creatorRequests/useListingRequestChangeOrders";
import { useT } from "../../../lib/i18n/i18n";
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
  const t = useT();

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
        t("changeOrderActions.withdrawFailed")
      )
    : error
      ? getErrorMessage(
          error,
          t("changeOrderActions.sendFailed")
        )
      : null;

  const isBusy = isPending || isWithdrawing;

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            {t("changeOrderActions.title")}
          </h2>

          <p className={classes.text}>
            {t(isDraft ? "changeOrderActions.draftText" : "changeOrderActions.sentText")}{" "}
            {t("changeOrderActions.withdrawText")}
          </p>
        </div>

        <div className={classes.draft}>
          {t(isDraft ? "creatorActions.draftLine" : "changeOrderActions.sentLine", {
            title: changeOrder.title,
          })}
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
              {t(isPending ? "changeOrderActions.sending" : "creatorActions.send")}
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
            {t(isWithdrawing ? "changeOrderActions.withdrawing" : "changeOrderActions.withdraw")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestChangeOrderCreatorActions;