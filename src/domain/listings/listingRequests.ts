export type ListingRequestStatus =
  | "submitted"
  | "accepted"
  | "completed"
  | "declined"
  | "archived"
  | "cancelled";

export type ListingRequestListView =
  | "active"
  | "completed"
  | "archived";

export type ListingRequestCancellationContext = {
  buyer_user_id?: string | null;
  creator_user_id?: string | null;
  cancelled_by_user_id?: string | null;
  cancellation_reason?: string | null;
};

export type ListingRequestStatusTone =
  | "review"
  | "success"
  | "danger"
  | "muted";

export type ListingRequestArchiveContext = {
  buyer_user_id?: string | null;
  creator_user_id?: string | null;
  archived_by_user_id?: string | null;
};

export const getListingRequestStatusesForView = (
  view: ListingRequestListView
): ListingRequestStatus[] =>
  view === "active"
    ? ["submitted", "accepted"]
    : view === "completed"
      ? ["completed"]
      : ["declined", "archived", "cancelled"];

export const getListingRequestStatusLabel = (
  status: ListingRequestStatus,
  archiveContext?: ListingRequestArchiveContext,
  cancellationContext?: ListingRequestCancellationContext
): string =>
  status === "submitted"
    ? "Under review"
    : status === "accepted"
      ? "Accepted"
      : status === "completed"
        ? "Completed"
        : status === "declined"
          ? "Declined"
          : status === "cancelled"
            ? cancellationContext?.cancelled_by_user_id &&
              cancellationContext.buyer_user_id &&
              cancellationContext.cancelled_by_user_id ===
              cancellationContext.buyer_user_id
              ? "Cancelled by buyer"
              : cancellationContext?.cancelled_by_user_id &&
                cancellationContext.creator_user_id &&
                cancellationContext.cancelled_by_user_id ===
                cancellationContext.creator_user_id
                ? "Cancelled by creator"
                : "Cancelled"
            : archiveContext?.archived_by_user_id &&
              archiveContext.buyer_user_id &&
              archiveContext.archived_by_user_id ===
              archiveContext.buyer_user_id
              ? "Withdrawn by buyer"
              : archiveContext?.archived_by_user_id &&
                archiveContext.creator_user_id &&
                archiveContext.archived_by_user_id ===
                archiveContext.creator_user_id
                ? "Archived by creator"
                : "Archived";

export const getListingRequestStatusTone = (
  status: ListingRequestStatus
): ListingRequestStatusTone =>
  status === "submitted"
    ? "review"
    : status === "accepted" ||
      status === "completed"
      ? "success"
      : status === "declined" ||
        status === "cancelled"
        ? "danger"
        : "muted";

export const getListingRequestStatusSummary = (
  status: ListingRequestStatus,
  archiveContext?: ListingRequestArchiveContext,
  cancellationContext?: ListingRequestCancellationContext
): string =>
  status === "submitted"
    ? "This commission request is currently under review by the creator."
    : status === "accepted"
      ? "The creator has accepted this commission request."
      : status === "completed"
        ? "The buyer approved the final delivery and the project is complete."
        : status === "declined"
          ? "The creator has declined this commission request."
          : status === "cancelled"
            ? cancellationContext?.cancellation_reason
              ? `This commission was cancelled: ${cancellationContext.cancellation_reason}`
              : "This commission has been cancelled."
            : archiveContext?.archived_by_user_id &&
              archiveContext.buyer_user_id &&
              archiveContext.archived_by_user_id ===
              archiveContext.buyer_user_id
              ? "The buyer withdrew this commission request."
              : archiveContext?.archived_by_user_id &&
                archiveContext.creator_user_id &&
                archiveContext.archived_by_user_id ===
                archiveContext.creator_user_id
                ? "The creator archived this commission."
                : "This commission has been archived.";

export const canAcceptListingRequest = (
  status: ListingRequestStatus
): boolean => status === "submitted";

export const canDeclineListingRequest = (
  status: ListingRequestStatus
): boolean => status === "submitted";

export const canArchiveListingRequest = (
  status: ListingRequestStatus
): boolean => status === "submitted";

// Sprint 4 (launch-scope.md section 5.1): the unilateral, pre-payment
// cancellation path is only offered once a request is accepted -- an
// unaccepted request is withdrawn (archived) or declined instead.
export const canCancelListingRequestBeforePayment = (
  status: ListingRequestStatus
): boolean => status === "accepted";