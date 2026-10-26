import { useState } from "react";

import {
  formatPaymentCents,
  getListingRequestPaymentTitle,
} from "../../../domain/payments/listingRequestPaymentDisplay";
import { useAdminIssueListingRequestPaymentRefund } from "../../../hooks/admin/useAdminIssueListingRequestPaymentRefund";
import {
  useListingRequestPayments,
  type ListingRequestPaymentRow,
} from "../../../hooks/payments/useListingRequestPayments";
import KeptPlaceholder from "../../ui/KeptPlaceholder";

const classes = {
  wrap: "space-y-3",
  title: "text-sm font-bold text-zinc-900",
  card: "rounded-2xl border border-[var(--hairline)] p-4 space-y-2",
  row: "flex flex-wrap items-center justify-between gap-2",
  text: "text-sm text-zinc-600",
  form: "grid gap-2 sm:grid-cols-2",
  field: "flex flex-col gap-1",
  label: "formLabel",
  input: "formControl",
  textarea: "formControl",
  select: "formControl",
  button: "btnPrimary",
  toggle: "btnOutline",
  error: "notice noticeError",
  success: "notice noticeSuccess",
} as const;

const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

const refundablePaymentStatuses = new Set(["paid", "partially_refunded"]);

const RefundForm = ({ payment }: { payment: ListingRequestPaymentRow }) => {
  const issueRefund = useAdminIssueListingRequestPaymentRefund();

  const [baseInput, setBaseInput] = useState("");
  const [tipInput, setTipInput] = useState("");
  const [contributionInput, setContributionInput] = useState("");
  const [reason, setReason] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const onSubmit = async () => {
    setErrMsg(null);
    setSuccessMsg(null);

    const baseRefundCents = Math.round(Number(baseInput) * 100);
    const tipRefundCents = tipInput ? Math.round(Number(tipInput) * 100) : 0;
    const contributionRefundCents = contributionInput
      ? Math.round(Number(contributionInput) * 100)
      : 0;

    if (!Number.isFinite(baseRefundCents) || baseRefundCents <= 0) {
      setErrMsg("Enter a base refund amount greater than zero.");
      return;
    }

    if (reason.trim().length < 3) {
      setErrMsg("A refund reason is required.");
      return;
    }

    try {
      const result = await issueRefund.mutateAsync({
        paymentId: payment.id,
        baseRefundCents,
        reason: reason.trim(),
        tipRefundCents,
        contributionRefundCents,
        tipContributionOverrideReason: overrideReason
          ? (overrideReason as "mistaken" | "duplicate" | "unauthorised")
          : undefined,
      });

      setSuccessMsg(
        `Refund issued. Payment status is now "${result.refund.status}".`,
      );
      setBaseInput("");
      setTipInput("");
      setContributionInput("");
      setReason("");
      setOverrideReason("");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  return (
    <div className={classes.form}>
      <label className={classes.field}>
        <span className={classes.label}>
          Base refund ({payment.currency.toUpperCase()})
        </span>
        <input
          className={classes.input}
          type="number"
          min={0}
          step="0.01"
          value={baseInput}
          onChange={(event) => setBaseInput(event.target.value)}
        />
      </label>

      <label className={classes.field}>
        <span className={classes.label}>Reason</span>
        <KeptPlaceholder>
        <input
          className={classes.input}
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Buyer requested cancellation before work started."
        />
        </KeptPlaceholder>
      </label>

      {payment.creator_tip_cents > 0 && (
        <label className={classes.field}>
          <span className={classes.label}>Tip refund (optional)</span>
          <input
            className={classes.input}
            type="number"
            min={0}
            step="0.01"
            value={tipInput}
            onChange={(event) => setTipInput(event.target.value)}
          />
        </label>
      )}

      {payment.platform_support_cents > 0 && (
        <label className={classes.field}>
          <span className={classes.label}>Contribution refund (optional)</span>
          <input
            className={classes.input}
            type="number"
            min={0}
            step="0.01"
            value={contributionInput}
            onChange={(event) => setContributionInput(event.target.value)}
          />
        </label>
      )}

      {(Number(tipInput) > 0 || Number(contributionInput) > 0) && (
        <label className={classes.field}>
          <span className={classes.label}>
            Override reason (required outside the 14-day window)
          </span>
          <select
            className={classes.select}
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
          >
            <option value="">Within window / not needed</option>
            <option value="mistaken">Mistaken</option>
            <option value="duplicate">Duplicate</option>
            <option value="unauthorised">Unauthorised</option>
          </select>
        </label>
      )}

      <div className={classes.row}>
        <button
          type="button"
          className={classes.button}
          disabled={issueRefund.isPending}
          onClick={() => void onSubmit()}
        >
          {issueRefund.isPending ? "Issuing refund…" : "Issue refund"}
        </button>
      </div>

      {successMsg && <div className={classes.success}>{successMsg}</div>}
      {errMsg && <div className={classes.error}>{errMsg}</div>}
    </div>
  );
};

// launch-scope.md section 6.1: admin-only refund route, surfaced on the
// request the payment belongs to rather than only after a dispute/refund
// already exists in AdminPaymentIssues.tsx -- an admin needs to be able to
// refund a payment that has neither yet.
const ListingRequestPaymentAdminRefundPanel = ({
  listingRequestId,
}: {
  listingRequestId: string;
}) => {
  const paymentsQuery = useListingRequestPayments(listingRequestId);
  const [openPaymentId, setOpenPaymentId] = useState<string | null>(null);

  const refundablePayments = (paymentsQuery.data ?? []).filter((payment) =>
    refundablePaymentStatuses.has(payment.status),
  );

  if (paymentsQuery.isLoading || refundablePayments.length === 0) {
    return null;
  }

  return (
    <div className={classes.wrap}>
      <h3 className={classes.title}>Refunds</h3>

      {refundablePayments.map((payment) => (
        <div key={payment.id} className={classes.card}>
          <div className={classes.row}>
            <span className={classes.text}>
              {getListingRequestPaymentTitle(payment)} —{" "}
              {formatPaymentCents(payment.base_amount_cents, payment.currency)}{" "}
              base, status: {payment.status}
            </span>

            <button
              type="button"
              className={classes.toggle}
              onClick={() =>
                setOpenPaymentId((current) =>
                  current === payment.id ? null : payment.id,
                )
              }
            >
              {openPaymentId === payment.id ? "Cancel" : "Refund"}
            </button>
          </div>

          {openPaymentId === payment.id && <RefundForm payment={payment} />}
        </div>
      ))}
    </div>
  );
};

export default ListingRequestPaymentAdminRefundPanel;
