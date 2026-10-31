import { useState } from "react";

import { formatPaymentCents } from "../../domain/payments/listingRequestPaymentDisplay";
import { dateLocale, hasMessage, useLanguage, useT, type Translate } from "../../lib/i18n/i18n";
import { useCreateCreatorRecoverySettlementCheckout } from "../../hooks/payments/useCreateCreatorRecoverySettlementCheckout";
import {
  useCreatorRecoveryBalance,
  useCreatorRecoveryEntries,
} from "../../hooks/payments/useCreatorRecoveryBalance";

const classes = {
  wrap: "mt-6 space-y-3 border-t border-[var(--hairline)] pt-6",
  title: "text-sm font-bold text-zinc-900",
  text: "text-sm text-zinc-600",
  warning: "notice noticeWarning",
  error: "notice noticeError",
  success: "notice noticeSuccess",
  form: "flex flex-wrap items-end gap-2",
  field: "flex flex-col gap-1.5",
  label: "formLabel",
  input: "formControl w-32",
  button: "btnPrimary",
  historyList: "mt-2 space-y-1 text-xs text-zinc-500",
} as const;

const getErrorMessage = (error: unknown, t: Translate): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : t("apply.failed");

const entryTypeLabel = (entryType: string, t: Translate): string => {
  const key = `recovery.entry.${entryType}`;

  return hasMessage(key) ? t(key) : entryType;
};

// launch-scope.md section 6.5: "Creator settings: balance visible, entry
// history, direct settlement path." Renders nothing when the creator has no
// recovery balance row at all -- the common case.
const CreatorRecoveryBalanceSection = () => {
  const t = useT();
  const locale = dateLocale(useLanguage());
  const balanceQuery = useCreatorRecoveryBalance();
  const entriesQuery = useCreatorRecoveryEntries();
  const createSettlement = useCreateCreatorRecoverySettlementCheckout();

  const [amountInput, setAmountInput] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const balance = balanceQuery.data;

  if (!balance || balance.outstanding_cents <= 0) {
    return null;
  }

  const onSettle = async () => {
    setErrMsg(null);
    setSuccessMsg(null);

    const parsed = Number(amountInput.trim());

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErrMsg(t("recovery.amountError"));
      return;
    }

    const amountCents = Math.round(parsed * 100);

    try {
      const response = await createSettlement.mutateAsync({ amountCents });

      if (response.checkout.clientSecret) {
        setSuccessMsg(t("recovery.redirecting"));
      }
    } catch (error) {
      setErrMsg(getErrorMessage(error, t));
    }
  };

  return (
    <div className={classes.wrap}>
      <h3 className={classes.title}>{t("recovery.title")}</h3>

      <div className={classes.warning}>
        {t("recovery.warning", {
          amount: formatPaymentCents(balance.outstanding_cents, balance.currency),
        })}
      </div>

      <div className={classes.form}>
        <label className={classes.field}>
          <span className={classes.label}>{t("recovery.amount")}</span>
          <input
            className={classes.input}
            type="number"
            min={0}
            step="0.01"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            placeholder="0.00"
          />
        </label>

        <button
          type="button"
          className={classes.button}
          disabled={createSettlement.isPending}
          onClick={() => void onSettle()}
        >
          {t(createSettlement.isPending ? "payout.preparing" : "recovery.settle")}
        </button>
      </div>

      {successMsg && <div className={classes.success}>{successMsg}</div>}
      {errMsg && <div className={classes.error}>{errMsg}</div>}

      {entriesQuery.data && entriesQuery.data.length > 0 && (
        <ul className={classes.historyList}>
          {entriesQuery.data.map((entry) => (
            <li key={entry.id}>
              {new Date(entry.created_at).toLocaleDateString(locale, { dateStyle: "medium" })} —{" "}
              {t("recovery.entryLabel", { label: entryTypeLabel(entry.entry_type, t) })}{" "}
              {formatPaymentCents(entry.amount_cents, entry.currency)} (
              {entry.reason})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CreatorRecoveryBalanceSection;
