import { useMemo, useState } from "react";

import { FadeIn } from "../../../lib/motion";
import type { ListingRequestPaymentRow } from "../../../hooks/payments/useListingRequestPayments";
import type { ListingRequestCancellationStatementItemInput } from "../../../hooks/creatorRequests/useProposeListingRequestCancellation";
import type { ListingRequestCancellationProposalRow } from "../../../hooks/creatorRequests/useListingRequestCancellationProposal";

type Viewer = "buyer" | "creator";

type ListingRequestCancellationProposalPanelProps = {
  viewer: Viewer;
  paidPayments: ListingRequestPaymentRow[];
  proposal: ListingRequestCancellationProposalRow | null;

  isProposePending: boolean;
  proposeError: unknown;
  onPropose: (
    reason: string,
    items?: ListingRequestCancellationStatementItemInput[]
  ) => Promise<void>;

  isSubmitStatementPending: boolean;
  submitStatementError: unknown;
  onSubmitStatement: (
    items: ListingRequestCancellationStatementItemInput[]
  ) => Promise<void>;

  isRespondPending: boolean;
  respondError: unknown;
  onAccept: () => Promise<void>;
  onDispute: (reason: string) => Promise<void>;
};

const classes = {
  card: "card p-6 space-y-4",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  errorBox: "notice noticeError",
  warningBox: "notice noticeWarning space-y-3",
  row: "flex flex-wrap items-center gap-3",
  btnPrimary: "btnPrimary btnSm",
  btnDanger: "btnDangerOutline btnSm",
  btnOutline: "btnOutline btnSm",
  textarea:
    "w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none",
  hint: "text-xs text-zinc-500",
  table: "w-full text-sm",
  th: "text-left font-semibold text-zinc-600 pb-2",
  td: "py-2 border-t border-zinc-100",
  input:
    "w-28 rounded-lg border border-zinc-300 px-2 py-1 text-sm text-right focus:border-zinc-500 focus:outline-none",
} as const;

const MIN_REASON_LENGTH = 10;

const formatCents = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

type StatementFormProps = {
  paidPayments: ListingRequestPaymentRow[];
  isPending: boolean;
  error: unknown;
  submitLabel: string;
  onSubmit: (items: ListingRequestCancellationStatementItemInput[]) => Promise<void>;
};

// The itemised, per-payment earned-value statement. Only rendered for the
// creator -- launch-scope.md section 5.2 makes the creator's statement the
// one the buyer accepts or disputes.
const StatementForm = ({
  paidPayments,
  isPending,
  error,
  submitLabel,
  onSubmit,
}: StatementFormProps) => {
  const [earnedByPaymentId, setEarnedByPaymentId] = useState<
    Record<string, string>
  >({});

  const handleChange = (paymentId: string, value: string) => {
    setEarnedByPaymentId((current) => ({ ...current, [paymentId]: value }));
  };

  const items = useMemo<
    { payment: ListingRequestPaymentRow; earnedCents: number; valid: boolean }[]
  >(
    () =>
      paidPayments.map((payment) => {
        const raw = earnedByPaymentId[payment.id];
        const parsed = raw === undefined || raw === "" ? 0 : Number(raw);
        const earnedCents = Number.isFinite(parsed)
          ? Math.round(parsed * 100)
          : NaN;

        return {
          payment,
          earnedCents,
          valid:
            Number.isFinite(earnedCents) &&
            earnedCents >= 0 &&
            earnedCents <= payment.base_amount_cents,
        };
      }),
    [paidPayments, earnedByPaymentId]
  );

  const allValid = items.length > 0 && items.every((item) => item.valid);

  const handleSubmit = async () => {
    if (!allValid) {
      return;
    }

    await onSubmit(
      items.map(({ payment, earnedCents }) => ({
        paymentId: payment.id,
        label: `${payment.payment_type.replace(/_/g, " ")} (${formatCents(
          payment.base_amount_cents,
          payment.currency
        )})`,
        earnedAmountCents: earnedCents,
      }))
    );
  };

  return (
    <div className="space-y-3">
      {Boolean(error) && (
        <div className={classes.errorBox}>
          {getErrorMessage(error, "The statement could not be saved.")}
        </div>
      )}

      <table className={classes.table}>
        <thead>
          <tr>
            <th className={classes.th}>Payment</th>
            <th className={classes.th}>Paid</th>
            <th className={classes.th}>Earned</th>
            <th className={classes.th}>Unearned (refundable)</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ payment, earnedCents, valid }) => (
            <tr key={payment.id}>
              <td className={classes.td}>
                {payment.payment_type.replace(/_/g, " ")}
              </td>
              <td className={classes.td}>
                {formatCents(payment.base_amount_cents, payment.currency)}
              </td>
              <td className={classes.td}>
                <input
                  className={classes.input}
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={isPending}
                  value={earnedByPaymentId[payment.id] ?? ""}
                  onChange={(event) =>
                    handleChange(payment.id, event.target.value)
                  }
                />
              </td>
              <td className={classes.td}>
                {valid
                  ? formatCents(
                      payment.base_amount_cents - earnedCents,
                      payment.currency
                    )
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className={classes.hint}>
        Earned amounts stay with the creator. Unearned amounts are flagged for
        refund -- this sprint does not issue the refund itself.
      </p>

      <button
        className={classes.btnPrimary}
        type="button"
        disabled={isPending || !allValid}
        onClick={() => void handleSubmit()}
      >
        {isPending ? "Saving…" : submitLabel}
      </button>
    </div>
  );
};

const ListingRequestCancellationProposalPanel = ({
  viewer,
  paidPayments,
  proposal,
  isProposePending,
  proposeError,
  onPropose,
  isSubmitStatementPending,
  submitStatementError,
  onSubmitStatement,
  isRespondPending,
  respondError,
  onAccept,
  onDispute,
}: ListingRequestCancellationProposalPanelProps) => {
  const [isOpening, setIsOpening] = useState(false);
  const [openReason, setOpenReason] = useState("");
  const [isDisputing, setIsDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");

  if (paidPayments.length === 0) {
    return null;
  }

  const isOpenProposal =
    proposal?.status === "pending_creator_statement" ||
    proposal?.status === "pending_buyer_response";

  if (!isOpenProposal && proposal?.status !== "disputed") {
    const trimmedReason = openReason.trim();
    const isReasonValid =
      trimmedReason.length >= MIN_REASON_LENGTH && trimmedReason.length <= 1000;

    // Only wired to the buyer's confirm button below -- when the creator
    // opens a proposal, StatementForm's onSubmit calls onPropose directly
    // with both the reason and the itemised statement in one step, since
    // the creator's opening claim is the binding statement itself.
    const handleBuyerOpen = async () => {
      if (!isReasonValid) {
        return;
      }

      await onPropose(trimmedReason);
      setIsOpening(false);
      setOpenReason("");
    };

    return (
      <div className={classes.card}>
        <div className={classes.header}>
          <h2 className={classes.title}>Propose a cancellation</h2>
          <p className={classes.text}>
            A payment has already been collected, so cancelling from here is a
            proposal with a settlement, not a unilateral act. The creator
            provides an itemised earned-value statement and the buyer accepts
            or disputes it.
          </p>
        </div>

        {Boolean(proposeError) && (
          <div className={classes.errorBox}>
            {getErrorMessage(proposeError, "The cancellation could not be proposed.")}
          </div>
        )}

        {viewer === "creator" ? (
          isOpening ? (
            <FadeIn className="space-y-3">
              <label htmlFor="cancellation-open-reason" className={classes.hint}>
                Reason (10-1000 characters, shown to the buyer)
              </label>
              <textarea
                id="cancellation-open-reason"
                className={classes.textarea}
                rows={3}
                value={openReason}
                disabled={isProposePending}
                onChange={(event) => setOpenReason(event.target.value)}
              />
              <p className={classes.hint}>
                Next, itemise the earned value for each paid payment below.
              </p>
              <StatementForm
                paidPayments={paidPayments}
                isPending={isProposePending}
                error={null}
                submitLabel="Propose cancellation with this statement"
                onSubmit={async (items) => {
                  if (!isReasonValid) {
                    return;
                  }

                  await onPropose(trimmedReason, items);
                  setIsOpening(false);
                  setOpenReason("");
                }}
              />
              <button
                className={classes.btnOutline}
                type="button"
                disabled={isProposePending}
                onClick={() => {
                  setIsOpening(false);
                  setOpenReason("");
                }}
              >
                Cancel
              </button>
            </FadeIn>
          ) : (
            <button
              className={classes.btnDanger}
              type="button"
              onClick={() => setIsOpening(true)}
            >
              Propose cancellation
            </button>
          )
        ) : isOpening ? (
          <FadeIn className="space-y-3">
            <label htmlFor="cancellation-open-reason" className={classes.hint}>
              Reason (10-1000 characters, shown to the creator)
            </label>
            <textarea
              id="cancellation-open-reason"
              className={classes.textarea}
              rows={3}
              value={openReason}
              disabled={isProposePending}
              onChange={(event) => setOpenReason(event.target.value)}
            />
            <div className={classes.row}>
              <button
                className={classes.btnDanger}
                type="button"
                disabled={isProposePending || !isReasonValid}
                onClick={() => void handleBuyerOpen()}
              >
                {isProposePending ? "Proposing…" : "Propose cancellation"}
              </button>
              <button
                className={classes.btnOutline}
                type="button"
                disabled={isProposePending}
                onClick={() => {
                  setIsOpening(false);
                  setOpenReason("");
                }}
              >
                Never mind
              </button>
            </div>
          </FadeIn>
        ) : (
          <button
            className={classes.btnDanger}
            type="button"
            onClick={() => setIsOpening(true)}
          >
            Propose cancellation
          </button>
        )}
      </div>
    );
  }

  if (proposal?.status === "disputed") {
    return (
      <div className={classes.card}>
        <div className={classes.header}>
          <h2 className={classes.title}>Cancellation under review</h2>
          <p className={classes.text}>
            The buyer disputed the cancellation statement. Made for Stream
            will review the evidence and decide.
          </p>
        </div>
        {proposal.buyer_response_reason && (
          <p className={classes.text}>
            Dispute reason: {proposal.buyer_response_reason}
          </p>
        )}
      </div>
    );
  }

  if (proposal?.status === "pending_creator_statement") {
    return (
      <div className={classes.card}>
        <div className={classes.header}>
          <h2 className={classes.title}>Cancellation proposed</h2>
          <p className={classes.text}>{proposal.reason}</p>
        </div>

        {viewer === "creator" ? (
          <StatementForm
            paidPayments={paidPayments}
            isPending={isSubmitStatementPending}
            error={submitStatementError}
            submitLabel="Submit cancellation statement"
            onSubmit={onSubmitStatement}
          />
        ) : (
          <p className={classes.text}>
            Waiting for the creator's itemised earned-value statement, due by{" "}
            {new Date(proposal.statement_due_at).toLocaleString()}.
          </p>
        )}
      </div>
    );
  }

  // pending_buyer_response
  const operativeItems = (
    proposal?.listing_request_cancellation_proposal_items ?? []
  ).filter((item) => item.is_operative);

  const currencyByPaymentId = new Map(
    paidPayments.map((payment) => [payment.id, payment.currency])
  );

  const currencyFor = (paymentId: string) =>
    currencyByPaymentId.get(paymentId) ?? "usd";

  return (
    <div className={classes.card}>
      <div className={classes.header}>
        <h2 className={classes.title}>Cancellation statement</h2>
        <p className={classes.text}>{proposal?.reason}</p>
      </div>

      <table className={classes.table}>
        <thead>
          <tr>
            <th className={classes.th}>Payment</th>
            <th className={classes.th}>Paid</th>
            <th className={classes.th}>Earned</th>
            <th className={classes.th}>Unearned (refundable)</th>
          </tr>
        </thead>
        <tbody>
          {operativeItems.map((item) => (
            <tr key={item.id}>
              <td className={classes.td}>{item.label}</td>
              <td className={classes.td}>
                {formatCents(item.paid_amount_cents, currencyFor(item.payment_id))}
              </td>
              <td className={classes.td}>
                {formatCents(item.earned_amount_cents, currencyFor(item.payment_id))}
              </td>
              <td className={classes.td}>
                {formatCents(item.unearned_amount_cents, currencyFor(item.payment_id))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {viewer === "buyer" ? (
        <>
          {Boolean(respondError) && (
            <div className={classes.errorBox}>
              {getErrorMessage(respondError, "The response could not be saved.")}
            </div>
          )}

          {isDisputing ? (
            <FadeIn className="space-y-3">
              <label htmlFor="cancellation-dispute-reason" className={classes.hint}>
                Dispute reason (at least 10 characters)
              </label>
              <textarea
                id="cancellation-dispute-reason"
                className={classes.textarea}
                rows={3}
                value={disputeReason}
                disabled={isRespondPending}
                onChange={(event) => setDisputeReason(event.target.value)}
              />
              <div className={classes.row}>
                <button
                  className={classes.btnDanger}
                  type="button"
                  disabled={isRespondPending || disputeReason.trim().length < 10}
                  onClick={() => void onDispute(disputeReason.trim())}
                >
                  {isRespondPending ? "Saving…" : "Submit dispute"}
                </button>
                <button
                  className={classes.btnOutline}
                  type="button"
                  disabled={isRespondPending}
                  onClick={() => setIsDisputing(false)}
                >
                  Back
                </button>
              </div>
            </FadeIn>
          ) : (
            <div className={classes.row}>
              <button
                className={classes.btnPrimary}
                type="button"
                disabled={isRespondPending}
                onClick={() => void onAccept()}
              >
                {isRespondPending ? "Saving…" : "Accept and cancel the commission"}
              </button>
              <button
                className={classes.btnOutline}
                type="button"
                disabled={isRespondPending}
                onClick={() => setIsDisputing(true)}
              >
                Dispute
              </button>
            </div>
          )}
        </>
      ) : (
        <p className={classes.text}>
          Waiting for the buyer to accept or dispute this statement.
        </p>
      )}
    </div>
  );
};

export default ListingRequestCancellationProposalPanel;
