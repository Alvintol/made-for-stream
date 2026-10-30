import { hasErrorMessage } from "../../../lib/errorMessage";
import { useState } from "react";

import { FadeIn } from "../../../lib/motion";
import { useT, type Translate } from "../../../lib/i18n/i18n";
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

const getErrorMessage = (error: unknown, t: Translate): string =>
  hasErrorMessage(error) ? error.message : t("cancelEarly.failed");

// Sprint 4 (launch-scope.md section 5.1): either party may cancel an
// accepted request unilaterally before any payment has been collected. No
// settlement, no review -- just a reason for the record.
const ListingRequestCancelBeforePaymentAction = ({
  isPending,
  error,
  onCancel,
}: ListingRequestCancelBeforePaymentActionProps) => {
  const t = useT();
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
        {t("cancelEarly.text")}
      </p>

      {Boolean(error) && (
        <div className={classes.errorBox}>{getErrorMessage(error, t)}</div>
      )}

      {isConfirming ? (
        <FadeIn className={classes.warningBox}>
          <p>{t("cancelEarly.sure")}</p>

          <label htmlFor="cancel-before-payment-reason" className={classes.hint}>
            {t("cancelEarly.reason")}
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
              {t(isPending ? "cancelEarly.cancelling" : "cancelEarly.confirm")}
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
              {t("cancelEarly.keep")}
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
          {t("cancelEarly.cancel")}
        </button>
      )}
    </div>
  );
};

export default ListingRequestCancelBeforePaymentAction;
