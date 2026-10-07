import { getOrderedListingRequestMilestones, isListingRequestMilestoneTerminal } from '../../../domain/listings/listingRequestMilestones';
import type { ListingRequestMilestoneRow } from "../../../hooks/creatorRequests/useListingRequestMilestones";

type ListingRequestMilestonePaymentAdminActionsProps = {
  milestones: ListingRequestMilestoneRow[];
  isPending?: boolean;
  error?: unknown;
  onConfirmPayment: (
    paymentScheduleItemId: string
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
  button:
    "btnPrimary",
  error:
    "notice noticeError mt-3",
};

const getErrorMessage = (
  error: unknown
): string | null => {
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

  return "The milestone payment could not be confirmed.";
};

const getPaymentRequiredMilestone = (
  milestones: ListingRequestMilestoneRow[]
) =>
  getOrderedListingRequestMilestones(
    milestones
  ).find(
    (milestone) =>
      milestone.status === "payment_required"
  ) ?? null;

const getAdminMilestonePaymentStatusMessage = (
  milestones: ListingRequestMilestoneRow[]
): string => {
  if (milestones.length === 0) {
    return "No milestone payments are configured for this commission yet.";
  }

  const sortedMilestones =
    getOrderedListingRequestMilestones(milestones);

  const submittedMilestone =
    sortedMilestones.find(
      (milestone) =>
        milestone.status === "submitted"
    ) ?? null;

  if (submittedMilestone) {
    return `Milestone ${submittedMilestone.sort_order + 1
      }: ${submittedMilestone.title
      } is waiting for buyer review before payment is required.`;
  }

  const revisionMilestone =
    sortedMilestones.find(
      (milestone) =>
        milestone.status ===
        "revision_requested"
    ) ?? null;

  if (revisionMilestone) {
    return `Milestone ${revisionMilestone.sort_order + 1
      }: ${revisionMilestone.title
      } has revisions requested. Payment is not required until the buyer approves the revised work.`;
  }

  const pendingMilestone =
    sortedMilestones.find(
      (milestone) =>
        milestone.status === "pending"
    ) ?? null;

  if (pendingMilestone) {
    return `Milestone ${pendingMilestone.sort_order + 1
      }: ${pendingMilestone.title
      } is waiting for creator submission.`;
  }

  const allMilestonesTerminal =
    sortedMilestones.every((milestone) =>
      isListingRequestMilestoneTerminal(
        milestone.status
      )
    );

  if (allMilestonesTerminal) {
    return "All milestone payments have been confirmed or closed.";
  }

  return "No milestone payment is awaiting admin confirmation right now.";
};

const ListingRequestMilestonePaymentAdminActions =
  ({
    milestones,
    isPending = false,
    error = null,
    onConfirmPayment,
  }: ListingRequestMilestonePaymentAdminActionsProps) => {
    const milestone =
      getPaymentRequiredMilestone(milestones);

    const errorMessage =
      getErrorMessage(error);

    if (!milestone) {
      return (
        <section className={classes.card}>
          <p className={classes.eyebrow}>
            Milestone payment
          </p>

          <h2 className={classes.title}>
            No milestone payment to confirm
          </h2>

          <p className={classes.description}>
            {getAdminMilestonePaymentStatusMessage(
              milestones
            )}
          </p>

          {errorMessage && (
            <div className={classes.error}>
              {errorMessage}
            </div>
          )}
        </section>
      );
    }

    return (
      <section className={classes.card}>
        <p className={classes.eyebrow}>
          Milestone payment
        </p>

        <h2 className={classes.title}>
          Confirm payment for milestone{" "}
          {milestone.sort_order + 1}:{" "}
          {milestone.title}
        </h2>

        <p className={classes.description}>
          The buyer approved this milestone.
          Confirm the milestone payment once it has
          cleared so the creator can continue with the
          next milestone.
        </p>

        {errorMessage && (
          <div className={classes.error}>
            {errorMessage}
          </div>
        )}

        <div className={classes.actions}>
          <button
            className={classes.button}
            disabled={isPending}
            type="button"
            onClick={() =>
              onConfirmPayment(
                milestone.payment_schedule_item_id
              )
            }
          >
            Confirm milestone payment
          </button>
        </div>
      </section>
    );
  };

export default ListingRequestMilestonePaymentAdminActions;