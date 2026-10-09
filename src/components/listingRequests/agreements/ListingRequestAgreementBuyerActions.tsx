import { useMemo, useState } from "react";

import {
  areRequiredAgreementAcknowledgementsChecked,
  getAgreementAcknowledgementKeysBySection,
  getRequiredListingRequestAgreementAcknowledgements,
} from "../../../domain/listings/listingRequestAgreements";
import {
  earlyServiceRequestExplanation,
  earlyServiceRequestHeading,
  earlyServiceRequestLabel,
} from "../../../domain/legal/policyAcceptance";
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

const getErrorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : "The project agreement response could not be saved.";

const ListingRequestAgreementBuyerActions = ({
  agreement,
  isPending,
  error,
  onAccept,
  onDecline,
}: ListingRequestAgreementBuyerActionsProps) => {
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

  const errorMessage = error ? getErrorMessage(error) : null;

  return (
    <div className={classes.review}>
      <ListingRequestAgreementSummary
        agreement={agreement}
        acknowledge={{
          checkedKeys: checkedAcknowledgementKeys,
          onToggle: handleToggleSection,
          disabled: isPending,
        }}
      />

      <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>Accept or decline</h2>
          <p className={classes.text} role="status">
            {hasCheckedAllRequiredAcknowledgements
              ? "You have confirmed every section of the agreement above."
              : `Read each section of the agreement above and tick "I understand" under it: ${confirmedSections} of ${sections.length} confirmed.`}
          </p>
        </div>

        {errorMessage && <div className={classes.errorBox}>{errorMessage}</div>}

        {/* Its own checkbox and wording, never folded into the acknowledgements
            above (Refund Policy section 1, launch-scope.md section 1.5). */}
        <div className={classes.consent}>
          <h3 className={classes.subtitle}>{earlyServiceRequestHeading}</h3>
          <PolicyAcceptanceCheckbox
            id="agreement-early-service-request"
            checked={earlyServiceRequested}
            onChange={setEarlyServiceRequested}
            disabled={isPending}
          >
            {earlyServiceRequestLabel}
          </PolicyAcceptanceCheckbox>
          <details className={classes.text}>
            <summary className={classes.why}>Why am I asked this?</summary>
            <p className="mt-1">{earlyServiceRequestExplanation}</p>
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
            {isPending ? "Saving response…" : "Accept project agreement"}
          </button>

          <button
            className={classes.btnOutline}
            type="button"
            disabled={isPending}
            onClick={() => void handleDecline()}
          >
            Decline agreement
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ListingRequestAgreementBuyerActions;