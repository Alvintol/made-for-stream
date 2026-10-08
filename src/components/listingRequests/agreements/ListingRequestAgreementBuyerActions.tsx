import { useMemo, useState } from "react";

import {
  areRequiredAgreementAcknowledgementsChecked,
  getRequiredListingRequestAgreementAcknowledgements,
} from "../../../domain/listings/listingRequestAgreements";
import {
  earlyServiceRequestExplanation,
  earlyServiceRequestHeading,
  earlyServiceRequestLabel,
} from "../../../domain/legal/policyAcceptance";
import type { ListingRequestAgreementRow } from "../../../hooks/creatorRequests/useListingRequestAgreement";
import PolicyAcceptanceCheckbox from "../../legal/PolicyAcceptanceCheckbox";

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
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  subtitle: "font-display text-sm font-extrabold tracking-tight",
  consent: "space-y-2",
  why: "cursor-pointer font-semibold underline underline-offset-2",
  text: "text-sm text-zinc-600",
  // One list with hairlines, like the agreement summary: a card per item made
  // a ten-item checklist very tall.
  checklist: "divide-y divide-[var(--hairline)] rounded-xl border border-[var(--hairline)]",
  checkboxRow: "flex gap-3 px-3 py-2",
  checkbox: "mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300",
  checkboxLabel: "text-sm text-zinc-800",
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

  const handleToggleAcknowledgement = (key: string) => {
    setCheckedAcknowledgementKeys((currentKeys) =>
      currentKeys.includes(key)
        ? currentKeys.filter((currentKey) => currentKey !== key)
        : [...currentKeys, key]
    );
  };

  const handleAccept = async () => {
    if (!hasCheckedAllRequiredAcknowledgements || !earlyServiceRequested) {
      return;
    }

    await onAccept(checkedAcknowledgementKeys, earlyServiceRequested);
  };

  const handleDecline = async () => {
    await onDecline();
  };

  const errorMessage = error ? getErrorMessage(error) : null;

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>Review and confirm agreement</h2>
          <p className={classes.text}>
            Tick each item to confirm you have read it, then accept.
          </p>
        </div>

        {errorMessage && <div className={classes.errorBox}>{errorMessage}</div>}

        <div className={classes.checklist}>
          {requiredAcknowledgements.map((acknowledgement) => {
            const inputId = `agreement-acknowledgement-${acknowledgement.key}`;

            return (
              <label
                key={acknowledgement.key}
                className={classes.checkboxRow}
                htmlFor={inputId}
              >
                <input
                  id={inputId}
                  className={classes.checkbox}
                  type="checkbox"
                  checked={checkedAcknowledgementKeys.includes(
                    acknowledgement.key
                  )}
                  disabled={isPending}
                  onChange={() =>
                    handleToggleAcknowledgement(acknowledgement.key)
                  }
                />

                <span className={classes.checkboxLabel}>
                  {acknowledgement.label}
                </span>
              </label>
            );
          })}
        </div>

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
  );
};

export default ListingRequestAgreementBuyerActions;