import { useState } from "react";

import { FadeIn } from "../../../lib/motion";

type ListingRequestCancelBeforePaymentActionProps = {
  isPending: boolean;
  error: unknown;
  onCancel: (reason: string) => Promise<void> | void;
};

const classes = {
  text: "text-sm text-zinc-600",
  errorBox: "notice noticeError",
  warningBox: "notice noticeWarning space-y-3",
  row: "flex flex-wrap items-center gap-3",
  btnDanger: "btnDangerOutline btnSm",
  btnOutline: "btnOutline btnSm",
  textarea:
    "w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none",
  hint: "text-xs text-zinc-500",
} as const;

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 1000;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "This commission could not be cancelled.";

// Sprint 4 (launch-scope.md section 5.1): either party may cancel an
// accepted request unilaterally before any payment has been collected. No
// settlement, no review -- just a reason for the record.
const ListingRequestCancelBeforePaymentAction = ({
  isPending,
  error,
  onCancel,
}: ListingRequestCancelBeforePaymentActionProps) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [reason, setReason] = useState("");

  const trimmedReason = reason.trim();
  const isReasonValid =
    trimmedReason.length >= MIN_REASON_LENGTH &&
    trimmedReason.length <= MAX_REASON_LENGTH;

  const handleConfirm = async () => {
    if (!isReasonValid) {
      return;
    }

    await onCancel(trimmedReason);
    setIsConfirming(false);
    setReason("");
  };

  return (
    <div className="space-y-3">
      <p className={classes.text}>
        Cancel this commission if the project should not go ahead. Nothing has
        been paid yet, so this is unilateral -- no review, no settlement.
      </p>

      {Boolean(error) && (
        <div className={classes.errorBox}>{getErrorMessage(error)}</div>
      )}

      {isConfirming ? (
        <FadeIn className={classes.warningBox}>
          <p>
            Are you sure? This cancels the agreement and everything scheduled
            under it, and cannot be undone.
          </p>

          <label htmlFor="cancel-before-payment-reason" className={classes.hint}>
            Reason (10-1000 characters, shown to the other party)
          </label>

          <textarea
            id="cancel-before-payment-reason"
            className={classes.textarea}
            rows={3}
            value={reason}
            disabled={isPending}
            onChange={(event) => setReason(event.target.value)}
          />

          <div className={classes.row}>
            <button
              className={classes.btnDanger}
              type="button"
              disabled={isPending || !isReasonValid}
              onClick={() => void handleConfirm()}
            >
              {isPending ? "Cancelling commission…" : "Confirm cancellation"}
            </button>

            <button
              className={classes.btnOutline}
              type="button"
              disabled={isPending}
              onClick={() => {
                setIsConfirming(false);
                setReason("");
              }}
            >
              Keep commission
            </button>
          </div>
        </FadeIn>
      ) : (
        <button
          className={classes.btnDanger}
          type="button"
          disabled={isPending}
          onClick={() => setIsConfirming(true)}
        >
          Cancel commission
        </button>
      )}
    </div>
  );
};

export default ListingRequestCancelBeforePaymentAction;
