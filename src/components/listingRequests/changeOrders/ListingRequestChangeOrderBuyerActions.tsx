import { hasErrorMessage } from "../../../lib/errorMessage";
import { Collapse } from "../../../lib/motion";
import { useState } from "react";

import { canBuyerRespondToListingRequestChangeOrder } from "../../../domain/listings/listingRequestChangeOrders";
import type { ListingRequestChangeOrderRow } from "../../../hooks/creatorRequests/useListingRequestChangeOrders";
import KeptPlaceholder from "../../ui/KeptPlaceholder";
import { useT, type Translate } from "../../../lib/i18n/i18n";
type BuyerChangeOrder = Pick<
  ListingRequestChangeOrderRow,
  "id" | "status" | "title"
>;

type ListingRequestChangeOrderBuyerActionsProps = {
  changeOrder: BuyerChangeOrder | null;
  isPending?: boolean;
  error?: unknown;
  onAccept: (
    changeOrderId: string
  ) => Promise<unknown> | unknown;
  onDecline: (
    changeOrderId: string,
    responseReason: string | null
  ) => Promise<unknown> | unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  changeOrder:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900",
  warning:
    "notice noticeWarning",
  field: "space-y-2",
  label: "formLabel",
  textarea:
    "formControl min-h-28",
  help: "formHint",
  error:
    "notice noticeError",
  actions: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",
  btnDanger:
    "btnDangerOutline",
} as const;

const getErrorMessage = (error: unknown, t: Translate): string =>
  hasErrorMessage(error)
    ? error.message
    : t("changeOrderReview.saveFailed");

const ListingRequestChangeOrderBuyerActions = ({
  changeOrder,
  isPending = false,
  error,
  onAccept,
  onDecline,
}: ListingRequestChangeOrderBuyerActionsProps) => {
  const t = useT();
  const [isAcceptConfirming, setIsAcceptConfirming] =
    useState(false);

  const [isDeclining, setIsDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  if (
    !changeOrder ||
    !canBuyerRespondToListingRequestChangeOrder(
      changeOrder.status
    )
  ) {
    return null;
  }

  const trimmedDeclineReason = declineReason.trim();
  const errorMessage = error
    ? getErrorMessage(error, t)
    : null;

  const handleStartAccept = () => {
    setIsDeclining(false);
    setIsAcceptConfirming(true);
  };

  const handleConfirmAccept = async () => {
    await onAccept(changeOrder.id);
  };

  const handleStartDecline = () => {
    setIsAcceptConfirming(false);
    setIsDeclining(true);
  };

  const handleConfirmDecline = async () => {
    await onDecline(
      changeOrder.id,
      trimmedDeclineReason || null
    );
  };

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            {t("changeOrderReview.title")}
          </h2>

          <p className={classes.text}>
            {t("changeOrderReview.text")}
          </p>
        </div>

        <div className={classes.changeOrder}>
          {changeOrder.title}
        </div>

        {errorMessage && (
          <div className={classes.error}>
            {errorMessage}
          </div>
        )}

        <Collapse open={isAcceptConfirming}>
          <div className={classes.warning}>
            {t("changeOrderReview.acceptNote")}
          </div>
        </Collapse>

        <Collapse open={isDeclining}>
          <div className={classes.field}>
            <label
              className={classes.label}
              htmlFor="change-order-decline-reason"
            >
              {t("changeOrderReview.declineReason")}
            </label>

            <KeptPlaceholder>
            <textarea
              className={classes.textarea}
              id="change-order-decline-reason"
              maxLength={2000}
              value={declineReason}
              onChange={(event) =>
                setDeclineReason(
                  event.currentTarget.value
                )
              }
              placeholder={t("changeOrderReview.declinePlaceholder")}
            />
            </KeptPlaceholder>

            <p className={classes.help}>
              {t("changeOrderReview.declineHelp", { count: declineReason.length })}
            </p>
          </div>
        </Collapse>

        <div className={classes.actions}>
          {!isAcceptConfirming && !isDeclining && (
            <>
              <button
                className={classes.btnPrimary}
                disabled={isPending}
                type="button"
                onClick={handleStartAccept}
              >
                {t("changeOrderReview.accept")}
              </button>

              <button
                className={classes.btnDanger}
                disabled={isPending}
                type="button"
                onClick={handleStartDecline}
              >
                {t("changeOrderReview.decline")}
              </button>
            </>
          )}

          {isAcceptConfirming && (
            <>
              <button
                className={classes.btnPrimary}
                disabled={isPending}
                type="button"
                onClick={() =>
                  void handleConfirmAccept()
                }
              >
                {t(isPending ? "agreementReview.saving" : "changeOrderReview.confirmAccept")}
              </button>

              <button
                className={classes.btnOutline}
                disabled={isPending}
                type="button"
                onClick={() =>
                  setIsAcceptConfirming(false)
                }
              >
                {t("deliveryReview.keepReviewing")}
              </button>
            </>
          )}

          {isDeclining && (
            <>
              <button
                className={classes.btnDanger}
                disabled={isPending}
                type="button"
                onClick={() =>
                  void handleConfirmDecline()
                }
              >
                {t(isPending ? "agreementReview.saving" : "changeOrderReview.confirmDecline")}
              </button>

              <button
                className={classes.btnOutline}
                disabled={isPending}
                type="button"
                onClick={() => {
                  setIsDeclining(false);
                  setDeclineReason("");
                }}
              >
                {t("deliveryReview.keepReviewing")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListingRequestChangeOrderBuyerActions;