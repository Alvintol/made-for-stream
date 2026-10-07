import { useState } from "react";

import { formatPaymentCents } from "../../../domain/payments/listingRequestPaymentDisplay";
import { useAdminWriteOffCreatorRecoveryBalance } from "../../../hooks/admin/useAdminWriteOffCreatorRecoveryBalance";
import { useCreatorRecoveryBalance } from "../../../hooks/payments/useCreatorRecoveryBalance";

const classes = {
  wrap: "space-y-2",
  title: "text-sm font-bold text-zinc-900",
  warning: "notice noticeWarning",
  form: "flex flex-wrap items-end gap-2",
  field: "flex flex-col gap-1",
  label: "formLabel",
  input: "formControl",
  button: "btnOutline",
  error: "notice noticeError",
  success: "notice noticeSuccess",
} as const;

const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

// launch-scope.md checklist: "Admin write-off action for an unrecoverable
// balance." Renders nothing when this creator has no outstanding balance.
const CreatorRecoveryBalanceAdminPanel = ({
  creatorUserId,
}: {
  creatorUserId: string;
}) => {
  const balanceQuery = useCreatorRecoveryBalance(creatorUserId);
  const writeOff = useAdminWriteOffCreatorRecoveryBalance();

  const [reason, setReason] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const balance = balanceQuery.data;

  if (!balance || balance.outstanding_cents <= 0) {
    return null;
  }

  const onWriteOff = async () => {
    setErrMsg(null);
    setSuccessMsg(null);

    if (reason.trim().length < 10) {
      setErrMsg("A write-off reason of at least 10 characters is required.");
      return;
    }

    try {
      await writeOff.mutateAsync({ creatorUserId, reason: reason.trim() });
      setSuccessMsg("Recovery balance written off.");
      setReason("");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  return (
    <div className={classes.wrap}>
      <h3 className={classes.title}>Creator recovery balance</h3>

      <div className={classes.warning}>
        This creator owes{" "}
        {formatPaymentCents(balance.outstanding_cents, balance.currency)} from
        a platform-funded refund. New commission requests to them are blocked until it
        clears. Write it off only if it is genuinely unrecoverable.
      </div>

      <div className={classes.form}>
        <label className={classes.field}>
          <span className={classes.label}>Write-off reason</span>
          <input
            className={classes.input}
            type="text"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Creator's account is closed and the debt cannot be collected."
          />
        </label>

        <button
          type="button"
          className={classes.button}
          disabled={writeOff.isPending}
          onClick={() => void onWriteOff()}
        >
          {writeOff.isPending ? "Writing off…" : "Write off balance"}
        </button>
      </div>

      {successMsg && <div className={classes.success}>{successMsg}</div>}
      {errMsg && <div className={classes.error}>{errMsg}</div>}
    </div>
  );
};

export default CreatorRecoveryBalanceAdminPanel;
