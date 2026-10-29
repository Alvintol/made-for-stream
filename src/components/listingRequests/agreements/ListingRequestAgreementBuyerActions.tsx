import { hasErrorMessage } from "../../../lib/errorMessage";
import { useMemo, useState } from "react";

import {
  areRequiredAgreementAcknowledgementsChecked,
  getAgreementAcknowledgementKeysBySection,
  getRequiredListingRequestAgreementAcknowledgements,
} from "../../../domain/listings/listingRequestAgreements";
import { useT, type Translate } from "../../../lib/i18n/i18n";
import type { ListingRequestAgreementRow } from "../../../hooks/creatorRequests/useListingRequestAgreement";
import PolicyAcceptanceCheckbox from "../../legal/PolicyAcceptanceCheckbox";
import ListingRequestAgreementSummary from "./ListingRequestAgreementSummary";

type ListingRequestAgreementBuyerActionsProps = {
  agreement: ListingRequestAgreementRow | null;
  isPending: boolean;
  error: unknown;
  onAccept: (
    acknowledgementKeys: string[],
    earlyServiceRequested: boolean,
  ) => Promise<void> | void;
  onDecline: () => Promise<void> | void;
  // The buyer's own handle or display name, shown beside checklist lines.
  buyerName?: string;
};

const classes = {
  review: "space-y-5",
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  subtitle: "font-display text-sm font-extrabold tracking-tight",
  consent: "space-y-2",
  why: "cursor-pointer font-semibold underline underline-offset-2",
  text: "text-sm text-zinc-600",
  row: "flex flex-wrap items-center gap-3",
  errorBox:
    "notice noticeError",
  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",
} as const;

const getErrorMessage = (error: unknown, t: Translate): string =>
  hasErrorMessage(error)
    ? error.message
    : t("agreementReview.saveFailed");

const ListingRequestAgreementBuyerActions = ({
  agreement,
  isPending,
  error,
  onAccept,
  onDecline,
  buyerName,
}: ListingRequestAgreementBuyerActionsProps) => {
  const t = useT();
  const [checkedAcknowledgementKeys, setCheckedAcknowledgementKeys] = useState<
    string[]
  >([]);
  const [earlyServiceRequested, setEarlyServiceRequested] = useState(false);

  const requiredAcknowledgements = useMemo(
    () =>
      agreement
        ? getRequiredListingRequestAgreementAcknowledgements(agreement)
        : [],
    [agreement]
  );

  if (!agreement || agreement.status !== "sent") {
    return null;
  }

  const hasCheckedAllRequiredAcknowledgements =
    areRequiredAgreementAcknowledgementsChecked({
      requiredAcknowledgements,
      checkedKeys: checkedAcknowledgementKeys,
    });

  // One "I understand" box under a section stands for every acknowledgement
  // about that section.
  const handleToggleSection = (keys: string[], checked: boolean) => {
    setCheckedAcknowledgementKeys((currentKeys) => {
      const others = currentKeys.filter((currentKey) => !keys.includes(currentKey));

      return checked ? [...others, ...keys] : others;
    });
  };

  const sections = Object.values(
    getAgreementAcknowledgementKeysBySection(requiredAcknowledgements)
  ).filter((keys) => keys.length > 0);
  const confirmedSections = sections.filter((keys) =>
    keys.every((key) => checkedAcknowledgementKeys.includes(key))
  ).length;

  const handleAccept = async () => {
    if (!hasCheckedAllRequiredAcknowledgements || !earlyServiceRequested) {
      return;
    }

    // Every required key, in the database's own order.
    await onAccept(
      requiredAcknowledgements.map((acknowledgement) => acknowledgement.key),
      earlyServiceRequested
    );
  };

  const handleDecline = async () => {
    await onDecline();
  };

  const errorMessage = error ? getErrorMessage(error, t) : null;

  return (
    <div className={classes.review}>
      <ListingRequestAgreementSummary
        agreement={agreement}
        buyerName={buyerName}
        acknowledge={{
          checkedKeys: checkedAcknowledgementKeys,
          onToggle: handleToggleSection,
          disabled: isPending,
        }}
      />

      <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>{t("agreementReview.title")}</h2>
          <p className={classes.text} role="status">
            {hasCheckedAllRequiredAcknowledgements
              ? t("agreementReview.allConfirmed")
              : t("agreementReview.progress", { confirmed: confirmedSections, total: sections.length })}
          </p>
        </div>

        {errorMessage && <div className={classes.errorBox}>{errorMessage}</div>}

        {/* Its own checkbox and wording, never folded into the acknowledgements
            above (Refund Policy section 1, launch-scope.md section 1.5). */}
        <div className={classes.consent}>
          <h3 className={classes.subtitle}>{t("consent.earlyStartHeading")}</h3>
          <PolicyAcceptanceCheckbox
            id="agreement-early-service-request"
            checked={earlyServiceRequested}
            onChange={setEarlyServiceRequested}
            disabled={isPending}
          >
            {t("consent.earlyStartLabel")}
          </PolicyAcceptanceCheckbox>
          <details className={classes.text}>
            <summary className={classes.why}>{t("agreementReview.why")}</summary>
            <p className="mt-1">{t("consent.earlyStartText")}</p>
          </details>
        </div>

        <div className={classes.row}>
          <button
            className={classes.btnPrimary}
            type="button"
            disabled={
              isPending ||
              !hasCheckedAllRequiredAcknowledgements ||
              !earlyServiceRequested
            }
            onClick={() => void handleAccept()}
          >
            {t(isPending ? "agreementReview.saving" : "agreementReview.accept")}
          </button>

          <button
            className={classes.btnOutline}
            type="button"
            disabled={isPending}
            onClick={() => void handleDecline()}
          >
            {t("agreementReview.decline")}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ListingRequestAgreementBuyerActions;