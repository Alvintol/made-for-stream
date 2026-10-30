import { useState } from "react";

import {
  CANCELLATION_WARNING_DAYS,
  useListingRequestCancellationWarnings,
  useSendListingRequestCancellationWarning,
  useWithdrawListingRequestCancellationWarning,
  type CancellationWarningDays,
} from "../../../hooks/creatorRequests/useListingRequestCancellationWarnings";
import { useLanguage, useT } from "../../../lib/i18n/i18n";
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

const formatDeadline = (iso: string, language: string): string =>
  new Date(iso).toLocaleString(language, { dateStyle: "long", timeStyle: "short" });

// What happens to money already paid, in the sender's own terms.
const MONEY_NOTE = {
  buyer: "cancelWarning.moneyBuyer",
  creator: "cancelWarning.moneyCreator",
} as const;

// The cancellation warning: a timer one side starts when the other has gone
// quiet. Nothing is cancelled unless someone starts it, and the other
// person stops it by doing what was asked or by replying in the chat.
const CancellationWarningPanel = ({
  requestId,
  currentUserId,
  currentUserRole,
}: CancellationWarningPanelProps) => {
  const t = useT();
  const language = useLanguage();
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
      <div className={classes.title}>{t("cancelWarning.title")}</div>

      {openWarning && openWarning.sender_user_id === currentUserId && (
        <div className={classes.infoBox} role="status">
          <p>
            {t("cancelWarning.sentStart")}{" "}
            <strong>{formatDeadline(openWarning.expires_at, language)}</strong>
            {t("cancelWarning.sentEnd")}
          </p>
          <p>{t("cancelWarning.asked", { action: openWarning.requested_action })}</p>
          <p>{t(MONEY_NOTE[currentUserRole])}</p>

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
              {t(withdrawWarning.isPending ? "cancelWarning.withdrawing" : "cancelWarning.withdraw")}
            </button>
          </div>
        </div>
      )}

      {openWarning && openWarning.recipient_user_id === currentUserId && (
        <div className={classes.infoBox} role="alert">
          <p>
            {t("cancelWarning.receivedStart")}{" "}
            <strong>{formatDeadline(openWarning.expires_at, language)}</strong>{" "}
            {t("cancelWarning.receivedEnd")}
          </p>
          <p>{t("cancelWarning.need", { action: openWarning.requested_action })}</p>
        </div>
      )}

      {!openWarning && (
        <>
          <p className={classes.text}>{t("cancelWarning.intro")}</p>

          {lastWasAnswered && (
            <p className={classes.text}>{t("cancelWarning.lastAnswered")}</p>
          )}

          {!showForm && (
            <div className={classes.row}>
              <button type="button" className={classes.btnDanger} onClick={() => setShowForm(true)}>
                {t("cancelWarning.send")}
              </button>
            </div>
          )}

          {showForm && (
            <div className={classes.form}>
              <label className={classes.field}>
                <span className={classes.label}>{t("cancelWarning.needLabel")}</span>
                <textarea
                  className={classes.control}
                  rows={3}
                  maxLength={1000}
                  value={requestedAction}
                  onChange={(event) => setRequestedAction(event.currentTarget.value)}
                />
                <span className={classes.hint}>{t("cancelWarning.needHint")}</span>
              </label>

              <label className={classes.field}>
                <span className={classes.label}>{t("cancelWarning.daysLabel")}</span>
                <select
                  className={classes.control}
                  value={responseDays}
                  onChange={(event) =>
                    setResponseDays(Number(event.currentTarget.value) as CancellationWarningDays)
                  }
                >
                  {CANCELLATION_WARNING_DAYS.map((days) => (
                    <option key={days} value={days}>
                      {t("cancelWarning.days", { count: days })}
                    </option>
                  ))}
                </select>
              </label>

              <p className={classes.hint}>{t(MONEY_NOTE[currentUserRole])}</p>

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
                  {sendWarning.isPending
                    ? t("common.sending")
                    : t("cancelWarning.start", { count: responseDays })}
                </button>
                <button
                  type="button"
                  className={classes.btnOutline}
                  onClick={() => setShowForm(false)}
                >
                  {t("cancelWarning.notNow")}
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
