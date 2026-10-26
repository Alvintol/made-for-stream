import { hasErrorMessage } from "../../../lib/errorMessage";
import { useState } from "react";

import { canBuyerRespondToListingRequestFinalDelivery } from "../../../domain/listings/listingRequestFinalDeliveries";
import {
  focusWorkspaceMessages,
  OFF_SITE_RECEIPTS_TARGET,
} from "../workspace/focusMessages";
import type { ListingRequestFinalDeliveryRow } from "../../../hooks/creatorRequests/useListingRequestFinalDeliveries";
import KeptPlaceholder from "../../ui/KeptPlaceholder";

type BuyerFinalDelivery = Pick<
  ListingRequestFinalDeliveryRow,
  "id" | "status" | "title"
>;

type ResponseMode =
  | "idle"
  | "approve"
  | "revision";

type ListingRequestFinalDeliveryBuyerActionsProps = {
  finalDelivery: BuyerFinalDelivery | null;
  canApprove: boolean;
  approvalBlockedReason?: string | null;
  // Work was sent off site and the buyer has not confirmed it arrived
  // (MIL-008): approving takes them to the confirmation instead.
  offSiteReceiptPending?: boolean;
  isPending?: boolean;
  error?: unknown;
  onApprove: (
    finalDeliveryId: string
  ) => Promise<unknown> | unknown;
  onRequestRevision: (
    finalDeliveryId: string,
    revisionRequestReason: string
  ) => Promise<unknown> | unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  delivery:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900",
  warning:
    "notice noticeWarning",
  confirmation:
    "notice noticeSuccess",
  field: "space-y-2",
  label: "formLabel",
  textarea:
    "formControl min-h-28",
  help: "formHint",
  validationError:
    "text-xs font-semibold text-red-600",
  error:
    "notice noticeError",
  actions: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",
  btnDanger:
    "btnDangerOutline",
} as const;

// The database's own refusal (require_off_site_receipts_before_approval).
const OFF_SITE_RECEIPT_MESSAGE =
  "Confirm in the chat that you received the work sent outside Made for Stream before approving the final delivery.";

const getErrorMessage = (error: unknown): string =>
  hasErrorMessage(error)
    ? error.message
    : "The final delivery response could not be saved.";

const ListingRequestFinalDeliveryBuyerActions = ({
  finalDelivery,
  canApprove,
  approvalBlockedReason,
  offSiteReceiptPending = false,
  isPending = false,
  error,
  onApprove,
  onRequestRevision,
}: ListingRequestFinalDeliveryBuyerActionsProps) => {
  const [responseMode, setResponseMode] =
    useState<ResponseMode>("idle");

  const [revisionReason, setRevisionReason] =
    useState("");

  const [validationError, setValidationError] =
    useState<string | null>(null);

  if (
    !finalDelivery ||
    !canBuyerRespondToListingRequestFinalDelivery(
      finalDelivery.status
    )
  ) {
    return null;
  }

  const trimmedRevisionReason =
    revisionReason.trim();

  const errorMessage = error
    ? getErrorMessage(error)
    : null;

  // The database refuses approval for the same reason; either way the
  // buyer is sent to the confirmation above the chat.
  const needsOffSiteConfirmation =
    offSiteReceiptPending || errorMessage === OFF_SITE_RECEIPT_MESSAGE;

  const goToOffSiteConfirmation = () => {
    setResponseMode("idle");
    focusWorkspaceMessages(OFF_SITE_RECEIPTS_TARGET);
  };

  const handleStartApproval = () => {
    if (!canApprove) {
      return;
    }

    if (needsOffSiteConfirmation) {
      goToOffSiteConfirmation();
      return;
    }

    setValidationError(null);
    setResponseMode("approve");
  };

  const handleApprove = async () => {
    if (needsOffSiteConfirmation) {
      goToOffSiteConfirmation();
      return;
    }

    try {
      await onApprove(finalDelivery.id);
    } catch {
      // Mutation errors are surfaced through the error prop.
    }
  };

  const handleStartRevision = () => {
    setValidationError(null);
    setResponseMode("revision");
  };

  const handleRequestRevision = async () => {
    if (trimmedRevisionReason.length < 10) {
      setValidationError(
        "Revision request details must contain at least 10 characters."
      );

      return;
    }

    setValidationError(null);

    try {
      await onRequestRevision(
        finalDelivery.id,
        trimmedRevisionReason
      );
    } catch {
      // Mutation errors are surfaced through the error prop.
    }
  };

  const handleKeepReviewing = () => {
    setResponseMode("idle");
    setRevisionReason("");
    setValidationError(null);
  };

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            Respond to final delivery
          </h2>

          <p className={classes.text}>
            Review the submitted work before approving it
            or requesting revisions.
          </p>
        </div>

        <div className={classes.delivery}>
          {finalDelivery.title}
        </div>

        {!canApprove && approvalBlockedReason && (
          <div className={classes.warning}>
            {approvalBlockedReason}
          </div>
        )}

        {needsOffSiteConfirmation && (
          <div className={classes.warning}>
            <p>{OFF_SITE_RECEIPT_MESSAGE}</p>
            <button
              className={`${classes.btnOutline} mt-3`}
              type="button"
              onClick={goToOffSiteConfirmation}
            >
              Go to the confirmation
            </button>
          </div>
        )}

        {errorMessage && errorMessage !== OFF_SITE_RECEIPT_MESSAGE && (
          <div className={classes.error}>
            {errorMessage}
          </div>
        )}

        {responseMode === "approve" && (
          <div className={classes.confirmation}>
            Approving confirms that the submitted final
            delivery satisfies the accepted project
            agreement and any accepted change orders.
          </div>
        )}

        {responseMode === "revision" && (
          <div className={classes.field}>
            <label
              className={classes.label}
              htmlFor="final-delivery-revision-reason"
            >
              Required revisions
            </label>

            <KeptPlaceholder>
            <textarea
              className={classes.textarea}
              id="final-delivery-revision-reason"
              maxLength={2000}
              value={revisionReason}
              onChange={(event) => {
                setRevisionReason(
                  event.currentTarget.value
                );

                setValidationError(null);
              }}
              placeholder="Describe the specific revisions required before you can approve the delivery."
            />
            </KeptPlaceholder>

            <p className={classes.help}>
              {revisionReason.length}/2000 characters.
              Include enough detail for the creator to
              understand the required changes.
            </p>

            {validationError && (
              <p className={classes.validationError}>
                {validationError}
              </p>
            )}
          </div>
        )}

        <div className={classes.actions}>
          {responseMode === "idle" && (
            <>
              <button
                className={classes.btnPrimary}
                disabled={!canApprove || isPending}
                type="button"
                onClick={handleStartApproval}
              >
                Approve final delivery
              </button>

              <button
                className={classes.btnDanger}
                disabled={isPending}
                type="button"
                onClick={handleStartRevision}
              >
                Request revisions
              </button>
            </>
          )}

          {responseMode === "approve" && (
            <>
              <button
                className={classes.btnPrimary}
                disabled={isPending}
                type="button"
                onClick={() => void handleApprove()}
              >
                {isPending
                  ? "Saving response…"
                  : "Confirm final delivery approval"}
              </button>

              <button
                className={classes.btnOutline}
                disabled={isPending}
                type="button"
                onClick={handleKeepReviewing}
              >
                Keep reviewing
              </button>
            </>
          )}

          {responseMode === "revision" && (
            <>
              <button
                className={classes.btnDanger}
                disabled={isPending}
                type="button"
                onClick={() =>
                  void handleRequestRevision()
                }
              >
                {isPending
                  ? "Saving response…"
                  : "Submit revision request"}
              </button>

              <button
                className={classes.btnOutline}
                disabled={isPending}
                type="button"
                onClick={handleKeepReviewing}
              >
                Keep reviewing
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListingRequestFinalDeliveryBuyerActions;