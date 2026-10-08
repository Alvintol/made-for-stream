import { useState } from "react";

import {
  CANCELLATION_WARNING_DAYS,
  useListingRequestCancellationWarnings,
  useSendListingRequestCancellationWarning,
  useWithdrawListingRequestCancellationWarning,
  type CancellationWarningDays,
} from "../../../hooks/creatorRequests/useListingRequestCancellationWarnings";

type CancellationWarningPanelProps = {
  requestId: string;
  currentUserId: string;
  // Decides which money sentence the sender is shown.
  currentUserRole: "buyer" | "creator";
};

const classes = {
  card: "card p-6 space-y-4",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  errorBox: "notice noticeError",
  infoBox: "notice noticeWarning space-y-2",
  row: "flex flex-wrap items-center gap-3",
  form: "space-y-3",
  btnDanger: "btnDangerOutline btnSm",
  btnOutline: "btnOutline btnSm",
  field: "flex flex-col gap-1.5",
  label: "formLabel",
  control: "formControl",
  hint: "formHint",
} as const;

const formatDeadline = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });

// What happens to money already paid, in the sender's own terms.
const MONEY_NOTE = {
  buyer:
    "If the creator does not reply, payments for milestones you approved stay with the creator, and other amounts you paid (such as a deposit) are refunded for the work not reached.",
  creator:
    "If the buyer does not reply, payments already made stay with you, including a deposit. Unpaid payments are cancelled.",
} as const;

// The cancellation warning: a timer one side starts when the other has gone
// quiet. Nothing is cancelled unless someone starts it, and the other
// person stops it by doing what was asked or by replying in the chat.
const CancellationWarningPanel = ({
  requestId,
  currentUserId,
  currentUserRole,
}: CancellationWarningPanelProps) => {
  const warningsQuery = useListingRequestCancellationWarnings(requestId);
  const sendWarning = useSendListingRequestCancellationWarning();
  const withdrawWarning = useWithdrawListingRequestCancellationWarning();

  const [showForm, setShowForm] = useState(false);
  const [requestedAction, setRequestedAction] = useState("");
  const [responseDays, setResponseDays] = useState<CancellationWarningDays>(7);

  const warnings = warningsQuery.data ?? [];
  const openWarning = warnings.find((warning) => warning.status === "open") ?? null;
  const lastWasAnswered = !openWarning && warnings[0]?.status === "answered";
  const trimmedAction = requestedAction.trim();
  const canSend = trimmedAction.length >= 10 && trimmedAction.length <= 1000;

  const send = async () => {
    try {
      await sendWarning.mutateAsync({ requestId, requestedAction: trimmedAction, responseDays });
      setShowForm(false);
      setRequestedAction("");
    } catch {
      // Shown below from the mutation's error.
    }
  };

  if (warningsQuery.isLoading) {
    return null;
  }

  return (
    <div className={classes.card}>
      <div className={classes.title}>Cancellation warning</div>

      {openWarning && openWarning.sender_user_id === currentUserId && (
        <div className={classes.infoBox} role="status">
          <p>
            You sent a cancellation warning. Unless the other person does what you asked or
            replies in the chat by <strong>{formatDeadline(openWarning.expires_at)}</strong>, this
            commission is cancelled automatically.
          </p>
          <p>What you asked for: {openWarning.requested_action}</p>
          <p>{MONEY_NOTE[currentUserRole]}</p>

          {withdrawWarning.error && (
            <div className={classes.errorBox} role="alert">
              {withdrawWarning.error.message}
            </div>
          )}

          <div className={classes.row}>
            <button
              type="button"
              className={classes.btnOutline}
              disabled={withdrawWarning.isPending}
              onClick={() => withdrawWarning.mutate(openWarning.id)}
            >
              {withdrawWarning.isPending ? "Withdrawing…" : "Withdraw warning"}
            </button>
          </div>
        </div>
      )}

      {openWarning && openWarning.recipient_user_id === currentUserId && (
        <div className={classes.infoBox} role="alert">
          <p>
            The other person sent you a cancellation warning. Respond by{" "}
            <strong>{formatDeadline(openWarning.expires_at)}</strong> or this commission is
            cancelled automatically. Doing what is asked (paying, accepting, approving) stops the
            timer at once, and so does any reply in the chat. You do not need to do both.
          </p>
          <p>What they need: {openWarning.requested_action}</p>
        </div>
      )}

      {!openWarning && (
        <>
          <p className={classes.text}>
            If the other person has gone quiet, for example past an agreed update or with a payment
            left unpaid, you can start a cancellation timer. They are emailed. Doing what you asked,
            or any reply in the chat, stops it. If they do neither in time, the commission is
            cancelled automatically.
            Nothing is ever cancelled unless one of you starts this.
          </p>

          {lastWasAnswered && (
            <p className={classes.text}>
              The last warning was answered, with a reply or by taking the next step, so its timer
              stopped.
            </p>
          )}

          {!showForm && (
            <div className={classes.row}>
              <button type="button" className={classes.btnDanger} onClick={() => setShowForm(true)}>
                Send cancellation warning
              </button>
            </div>
          )}

          {showForm && (
            <div className={classes.form}>
              <label className={classes.field}>
                <span className={classes.label}>What do you need from them?</span>
                <textarea
                  className={classes.control}
                  rows={3}
                  maxLength={1000}
                  value={requestedAction}
                  onChange={(event) => setRequestedAction(event.currentTarget.value)}
                />
                <span className={classes.hint}>10 to 1000 characters. They will see this.</span>
              </label>

              <label className={classes.field}>
                <span className={classes.label}>How long do they have to reply?</span>
                <select
                  className={classes.control}
                  value={responseDays}
                  onChange={(event) =>
                    setResponseDays(Number(event.currentTarget.value) as CancellationWarningDays)
                  }
                >
                  {CANCELLATION_WARNING_DAYS.map((days) => (
                    <option key={days} value={days}>
                      {days} days
                    </option>
                  ))}
                </select>
              </label>

              <p className={classes.hint}>{MONEY_NOTE[currentUserRole]}</p>

              {sendWarning.error && (
                <div className={classes.errorBox} role="alert">
                  {sendWarning.error.message}
                </div>
              )}

              <div className={classes.row}>
                <button
                  type="button"
                  className={classes.btnDanger}
                  disabled={!canSend || sendWarning.isPending}
                  onClick={() => void send()}
                >
                  {sendWarning.isPending ? "Sending…" : `Start the ${responseDays}-day timer`}
                </button>
                <button
                  type="button"
                  className={classes.btnOutline}
                  onClick={() => setShowForm(false)}
                >
                  Not now
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CancellationWarningPanel;
