import { Collapse } from "../../../lib/motion";
import { useState } from "react";

import type { ListingRequestMilestoneRow } from "../../../hooks/creatorRequests/useListingRequestMilestones";
import type { RespondListingRequestMilestoneInput } from "../../../hooks/creatorRequests/useRespondListingRequestMilestone";

type ListingRequestMilestoneBuyerActionsProps = {
  milestone: ListingRequestMilestoneRow | null;
  isPending?: boolean;
  error?: unknown;
  onRespondMilestone: (
    input: RespondListingRequestMilestoneInput
  ) => Promise<unknown> | unknown;
};

const classes = {
  card:
    "card p-5",
  eyebrow:
    "text-xs font-semibold uppercase tracking-[0.2em] text-blue-600",
  title:
    "mt-2 font-display text-lg font-bold tracking-tight text-zinc-900",
  description:
    "mt-2 text-sm leading-6 text-zinc-600",
  actions:
    "mt-5 flex flex-wrap gap-3",
  primaryButton:
    "btnPrimary",
  secondaryButton:
    "btnOutline",
  form:
    "mt-5 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4",
  label:
    "formLabel",
  textarea:
    "formControl min-h-28",
  help:
    "formHint",
  error:
    "notice noticeError mt-3",
};

const getErrorMessage = (error: unknown): string | null => {
  if (!error) {
    return null;
  }

  if (
    error instanceof Error &&
    error.message
  ) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    "message" in error
  ) {
    return String(
      (error as { message?: unknown }).message
    );
  }

  return "The milestone response could not be saved.";
};

const getMilestonePosition = (
  milestone: ListingRequestMilestoneRow
): string => `Milestone ${milestone.sort_order + 1}`;

const getIsSubmittedMilestone = (
  milestone: ListingRequestMilestoneRow | null
): boolean => milestone?.status === "submitted";

const getBuyerMilestoneStatusMessage = (
  milestone: ListingRequestMilestoneRow
): string => {
  const milestoneLabel = getMilestonePosition(milestone);

  if (milestone.status === "pending") {
    return `${milestoneLabel} is waiting for the creator to submit work for buyer review.`;
  }

  if (milestone.status === "revision_requested") {
    return `${milestoneLabel} has revisions requested. The creator needs to submit an updated version before you can review it again.`;
  }

  if (
    milestone.status === "buyer_approved" ||
    milestone.status === "payment_required"
  ) {
    return `${milestoneLabel} has been approved. Payment is now awaiting admin confirmation before the creator can continue.`;
  }

  if (milestone.status === "paid") {
    return `${milestoneLabel} payment has been confirmed.`;
  }

  if (milestone.status === "cancelled") {
    return `${milestoneLabel} was cancelled.`;
  }

  return `${milestoneLabel} is currently ${milestone.status.replaceAll(
    "_",
    " "
  )}.`;
};

const ListingRequestMilestoneBuyerActions = ({
  milestone,
  isPending = false,
  error = null,
  onRespondMilestone,
}: ListingRequestMilestoneBuyerActionsProps) => {
  const [showRevisionForm, setShowRevisionForm] =
    useState(false);
  const [revisionReason, setRevisionReason] =
    useState("");
  const [clientError, setClientError] =
    useState<string | null>(null);

  const errorMessage =
    clientError ?? getErrorMessage(error);

  const handleApprove = async () => {
    const currentMilestone = milestone;

    if (
      !currentMilestone ||
      !getIsSubmittedMilestone(currentMilestone)
    ) {
      return;
    }

    setClientError(null);

    await onRespondMilestone({
      milestoneId: currentMilestone.id,
      response: "buyer_approved",
    });
  };

  const handleOpenRevisionForm = () => {
    setClientError(null);
    setShowRevisionForm(true);
  };

  const handleCancelRevision = () => {
    setClientError(null);
    setRevisionReason("");
    setShowRevisionForm(false);
  };

  const handleRequestRevision = async () => {
    const currentMilestone = milestone;

    if (
      !currentMilestone ||
      !getIsSubmittedMilestone(currentMilestone)
    ) {
      return;
    }

    const cleanReason = revisionReason.trim();

    if (
      cleanReason.length < 10 ||
      cleanReason.length > 2000
    ) {
      setClientError(
        "Revision notes must be between 10 and 2000 characters."
      );

      return;
    }

    setClientError(null);

    await onRespondMilestone({
      milestoneId: currentMilestone.id,
      response: "revision_requested",
      revisionRequestReason: cleanReason,
    });

    setRevisionReason("");
    setShowRevisionForm(false);
  };

  if (!milestone) {
    return (
      <section className={classes.card}>
        <p className={classes.eyebrow}>
          Milestone review
        </p>

        <h2 className={classes.title}>
          No milestone is ready for review.
        </h2>

        <p className={classes.description}>
          The creator can submit the next milestone once
          earlier milestone work and payments are resolved.
        </p>
      </section>
    );
  }

  const currentMilestone = milestone;

  if (!getIsSubmittedMilestone(currentMilestone)) {
    return (
      <section className={classes.card}>
        <p className={classes.eyebrow}>
          Milestone review
        </p>

        <h2 className={classes.title}>
          No milestone response needed
        </h2>

        <p className={classes.description}>
          {getBuyerMilestoneStatusMessage(
            currentMilestone
          )}
        </p>
      </section>
    );
  }

  return (
    <section className={classes.card}>
      <p className={classes.eyebrow}>
        Milestone review
      </p>

      <h2 className={classes.title}>
        Review {getMilestonePosition(currentMilestone)}
        : {currentMilestone.title}
      </h2>

      <p className={classes.description}>
        Approve this milestone when the submitted work is
        accepted. If something needs to change, commission
        revisions and include clear notes for the creator.
      </p>

      {errorMessage && (
        <div className={classes.error}>
          {errorMessage}
        </div>
      )}

      <div className={classes.actions}>
        <button
          className={classes.primaryButton}
          disabled={isPending}
          type="button"
          onClick={handleApprove}
        >
          Approve milestone
        </button>

        <button
          className={classes.secondaryButton}
          disabled={isPending}
          type="button"
          onClick={handleOpenRevisionForm}
        >
          Request revisions
        </button>
      </div>

      <Collapse open={showRevisionForm}>
        <div className={classes.form}>
          <label className={classes.label}>
            Revision notes
            <textarea
              className={classes.textarea}
              disabled={isPending}
              placeholder="Describe what needs to change before this milestone can be approved."
              value={revisionReason}
              onChange={(event) =>
                setRevisionReason(
                  event.target.value
                )
              }
            />
          </label>

          <p className={classes.help}>
            Be specific so the creator knows what to
            adjust. Notes must be between 10 and 2000
            characters.
          </p>

          <div className={classes.actions}>
            <button
              className={classes.primaryButton}
              disabled={isPending}
              type="button"
              onClick={handleRequestRevision}
            >
              Send revision request
            </button>

            <button
              className={classes.secondaryButton}
              disabled={isPending}
              type="button"
              onClick={handleCancelRevision}
            >
              Cancel revision request
            </button>
          </div>
        </div>
      </Collapse>
    </section>
  );
};

export default ListingRequestMilestoneBuyerActions;