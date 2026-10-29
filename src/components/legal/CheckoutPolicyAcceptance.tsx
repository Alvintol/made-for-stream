import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  checkoutPolicyTypes,
  getLatestAcceptedAt,
  getMissingPolicyTypes,
  toCurrentPolicyAcceptances,
} from "../../domain/legal/policyAcceptance";
import {
  logPolicyAcceptanceFailure,
  usePolicyAcceptances,
  useRecordPolicyAcceptances,
} from "../../hooks/legal/usePolicyAcceptances";
import PolicyAcceptanceCheckbox from "./PolicyAcceptanceCheckbox";
import { useLanguage, useT } from "../../lib/i18n/i18n";
type CheckoutPolicyAcceptanceProps = {
  listingRequestId: string;
  onAccepted: () => void;
};

const classes = {
  card: "card space-y-4 p-6",
  group: "space-y-2",
  heading: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm leading-6 text-zinc-600",
  link: "font-semibold underline underline-offset-2",
  row: "flex flex-wrap items-center gap-3",
  button: "btnPrimary",
  error: "notice noticeError",
} as const;

const formatAcceptedDate = (value: string, language: string): string =>
  new Date(value).toLocaleDateString(language, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

// Acceptance a buyer gives before paying for a project. Recorded once per
// listing request at the current policy versions; later payments on the same
// request go straight through unless a policy has changed.
//
// The early-start request is deliberately its own checkbox with its own
// wording, never folded into the general agreement (Refund Policy section 1).
// It is first recorded when the buyer accepts the agreement (20260923_138),
// so here it only reappears if the Refund Policy has changed since.
const CheckoutPolicyAcceptance = (props: CheckoutPolicyAcceptanceProps) => {
  const { listingRequestId, onAccepted } = props;

  const acceptancesQuery = usePolicyAcceptances({
    policyTypes: checkoutPolicyTypes,
    relatedListingRequestId: listingRequestId,
  });
  const recordAcceptances = useRecordPolicyAcceptances();
  const t = useT();
  const language = useLanguage();
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [earlyStartRequested, setEarlyStartRequested] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const acceptances = acceptancesQuery.data ?? [];
  const missingPolicyTypes = acceptancesQuery.data
    ? getMissingPolicyTypes(checkoutPolicyTypes, acceptances)
    : checkoutPolicyTypes;
  const hasAccepted = Boolean(acceptancesQuery.data) && missingPolicyTypes.length === 0;
  const acceptedAt = hasAccepted ? getLatestAcceptedAt(acceptances) : null;

  useEffect(() => {
    if (hasAccepted) onAccepted();
  }, [hasAccepted, onAccepted]);

  if (hasAccepted) {
    return (
      <section className={classes.card}>
        <p className={classes.text}>
          {t("checkoutTerms.acceptedStart")}{" "}
          <Link className={classes.link} to="/policies/fees" target="_blank" rel="noopener">
            {t("checkoutTerms.feeSchedule")}
          </Link>{" "}
          {t("checkoutTerms.acceptedMiddle")}{" "}
          <Link className={classes.link} to="/policies/refunds" target="_blank" rel="noopener">
            {t("checkoutTerms.refundPolicy")}
          </Link>{" "}
          {acceptedAt
            ? t("checkoutTerms.acceptedEndOn", { date: formatAcceptedDate(acceptedAt, language) })
            : t("checkoutTerms.acceptedEnd")}
        </p>
      </section>
    );
  }

  const isBusy = acceptancesQuery.isLoading || recordAcceptances.isPending;
  const needsEarlyStartRequest = missingPolicyTypes.includes("early_service_request");

  const onContinue = async () => {
    setErrMsg(null);

    try {
      await recordAcceptances.mutateAsync({
        policies: toCurrentPolicyAcceptances(missingPolicyTypes),
        relatedListingRequestId: listingRequestId,
      });
      onAccepted();
    } catch (error) {
      logPolicyAcceptanceFailure("checkout acceptance", error);
      setErrMsg(
        t("checkoutTerms.saveFailed"),
      );
    }
  };

  return (
    <section className={classes.card} aria-label={t("checkoutTerms.label")}>
      <div className={classes.group}>
        <h2 className={classes.heading}>{t("checkoutTerms.heading")}</h2>
        <p className={classes.text}>
          {t("checkoutTerms.reviewStart")}{" "}
          <Link className={classes.link} to={`/requests/${listingRequestId}`}>
            {t("checkoutTerms.agreementLink")}
          </Link>{" "}
          {t("checkoutTerms.reviewEnd")}
        </p>

        <PolicyAcceptanceCheckbox
          id="checkout-terms-acceptance"
          checked={termsAgreed}
          onChange={setTermsAgreed}
          disabled={isBusy}
        >
          {t("checkoutTerms.agreeStart")}{" "}
          <Link className={classes.link} to="/policies/fees" target="_blank" rel="noopener">
            {t("checkoutTerms.feeSchedule")}
          </Link>{" "}
          {t("checkoutTerms.agreeAnd")}{" "}
          <Link className={classes.link} to="/policies/refunds" target="_blank" rel="noopener">
            {t("checkoutTerms.refundPolicy")}
          </Link>{" "}
          {t("checkoutTerms.agreeEnd")}
        </PolicyAcceptanceCheckbox>
      </div>

      {needsEarlyStartRequest && (
      <div className={classes.group}>
        <h2 className={classes.heading}>{t("consent.earlyStartHeading")}</h2>
        <p className={classes.text}>{t("consent.earlyStartText")}</p>

        <PolicyAcceptanceCheckbox
          id="checkout-early-service-request"
          checked={earlyStartRequested}
          onChange={setEarlyStartRequested}
          disabled={isBusy}
        >
          {t("consent.earlyStartLabel")}
        </PolicyAcceptanceCheckbox>
      </div>
      )}

      <div className={classes.row}>
        <button
          className={classes.button}
          type="button"
          disabled={
            !termsAgreed ||
            (needsEarlyStartRequest && !earlyStartRequested) ||
            isBusy
          }
          onClick={() => void onContinue()}
        >
          {recordAcceptances.isPending ? t("common.saving") : t("checkout.continue")}
        </button>
      </div>

      {errMsg && <div className={classes.error}>{errMsg}</div>}
    </section>
  );
};

export default CheckoutPolicyAcceptance;
