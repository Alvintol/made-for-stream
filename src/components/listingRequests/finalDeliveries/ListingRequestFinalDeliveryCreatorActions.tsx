import { hasErrorMessage } from "../../../lib/errorMessage";
import { canSubmitListingRequestFinalDelivery } from "../../../domain/listings/listingRequestFinalDeliveries";
import type { ListingRequestFinalDeliveryRow } from "../../../hooks/creatorRequests/useListingRequestFinalDeliveries";

type ListingRequestFinalDeliveryCreatorActionsProps = {
  finalDelivery: Pick<
    ListingRequestFinalDeliveryRow,
    "id" | "status" | "title"
  > | null;
  isPending?: boolean;
  error?: unknown;
  onSubmitFinalDelivery: (
    finalDeliveryId: string
  ) => Promise<unknown> | unknown;
};

const classes = {
  card: "card p-6",
  section: "space-y-4",
  header: "space-y-1",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  draft:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-900",
  notice:
    "notice noticeWarning",
  error:
    "notice noticeError",
  actions: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
} as const;

const getErrorMessage = (error: unknown): string =>
  hasErrorMessage(error)
    ? error.message
    : "The final project delivery could not be submitted.";

const ListingRequestFinalDeliveryCreatorActions = ({
  finalDelivery,
  isPending = false,
  error,
  onSubmitFinalDelivery,
}: ListingRequestFinalDeliveryCreatorActionsProps) => {
  if (
    !finalDelivery ||
    !canSubmitListingRequestFinalDelivery(
      finalDelivery.status
    )
  ) {
    return null;
  }

  const errorMessage = error
    ? getErrorMessage(error)
    : null;

  return (
    <div className={classes.card}>
      <div className={classes.section}>
        <div className={classes.header}>
          <h2 className={classes.title}>
            Final delivery actions
          </h2>

          <p className={classes.text}>
            This final delivery is saved as a private
            draft. Submit it when it is ready for buyer
            review.
          </p>
        </div>

        <div className={classes.draft}>
          Draft: {finalDelivery.title}
        </div>

        <div className={classes.notice}>
          Submitting may activate any remaining balance
          that must be paid before the final work is
          released.
        </div>

        {errorMessage && (
          <div className={classes.error}>
            {errorMessage}
          </div>
        )}

        <div className={classes.actions}>
          <button
            className={classes.btnPrimary}
            disabled={isPending}
            type="button"
            onClick={() =>
              void onSubmitFinalDelivery(
                finalDelivery.id
              )
            }
          >
            {isPending
              ? "Submitting final delivery…"
              : "Submit draft to buyer"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestFinalDeliveryCreatorActions;