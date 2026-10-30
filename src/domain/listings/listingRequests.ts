import { english, type Translate } from "../../lib/i18n/i18n";

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
  cancellationContext?: ListingRequestCancellationContext,
  t: Translate = english
): string =>
  t(
    status === "submitted"
      ? "requestStatus.submitted"
      : status === "accepted"
        ? "requestStatus.accepted"
        : status === "completed"
          ? "requestStatus.completed"
          : status === "declined"
            ? "requestStatus.declined"
            : status === "cancelled"
              ? cancellationContext?.cancelled_by_user_id &&
                cancellationContext.buyer_user_id &&
                cancellationContext.cancelled_by_user_id ===
                cancellationContext.buyer_user_id
                ? "requestStatus.cancelledByBuyer"
                : cancellationContext?.cancelled_by_user_id &&
                  cancellationContext.creator_user_id &&
                  cancellationContext.cancelled_by_user_id ===
                  cancellationContext.creator_user_id
                  ? "requestStatus.cancelledByCreator"
                  : "requestStatus.cancelled"
              : archiveContext?.archived_by_user_id &&
                archiveContext.buyer_user_id &&
                archiveContext.archived_by_user_id ===
                archiveContext.buyer_user_id
                ? "requestStatus.withdrawnByBuyer"
                : archiveContext?.archived_by_user_id &&
                  archiveContext.creator_user_id &&
                  archiveContext.archived_by_user_id ===
                  archiveContext.creator_user_id
                  ? "requestStatus.archivedByCreator"
                  : "requestStatus.archived"
  );

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
  cancellationContext?: ListingRequestCancellationContext,
  t: Translate = english
): string =>
  status === "submitted"
    ? t("statusSummary.submitted")
    : status === "accepted"
      ? t("statusSummary.accepted")
      : status === "completed"
        ? t("statusSummary.completed")
        : status === "declined"
          ? t("statusSummary.declined")
          : status === "cancelled"
            ? cancellationContext?.cancellation_reason
              ? t("statusSummary.cancelledReason", { reason: cancellationContext.cancellation_reason })
              : t("statusSummary.cancelled")
            : archiveContext?.archived_by_user_id &&
              archiveContext.buyer_user_id &&
              archiveContext.archived_by_user_id ===
              archiveContext.buyer_user_id
              ? t("statusSummary.withdrawn")
              : archiveContext?.archived_by_user_id &&
                archiveContext.creator_user_id &&
                archiveContext.archived_by_user_id ===
                archiveContext.creator_user_id
                ? t("statusSummary.archivedByCreator")
                : t("statusSummary.archived");

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