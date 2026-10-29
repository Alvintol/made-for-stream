import { ListingRequestFinalDeliveryRow } from '../../hooks/creatorRequests/useListingRequestFinalDeliveries';
import { english, type Translate } from '../../lib/i18n/i18n';

export type ListingRequestFinalDeliveryStatus =
  | "draft"
  | "submitted"
  | "revision_requested"
  | "buyer_approved"
  | "cancelled"
  | "superseded";

export type ListingRequestFinalDeliveryTone =
  | "muted"
  | "review"
  | "success"
  | "danger";

type ListingRequestFinalDeliveryPaymentItem = {
  payment_timing: string;
  status: string;
  amount?: number | null;
};

type ListingRequestFinalDeliveryTimelineHold = {
  reason: string;
  ended_at: string | null;
};

type ListingRequestFinalDeliveryAgreement = {
  status: string;
  starting_payment_status: string;
  payment_structure?: string | null;
  listing_request_payment_schedule_items?:
  | ListingRequestFinalDeliveryPaymentItem[]
  | null;
  listing_request_timeline_holds?:
  | ListingRequestFinalDeliveryTimelineHold[]
  | null;
};

export const getHasAllMilestonePaymentsPaid = (
  agreement: ListingRequestFinalDeliveryAgreement | null
): boolean => {
  if (!agreement) {
    return false;
  }

  if (
    agreement.payment_structure !==
    "milestone_payments"
  ) {
    return true;
  }

  const milestonePaymentItems =
    agreement.listing_request_payment_schedule_items?.filter(
      (paymentItem) =>
        paymentItem.payment_timing ===
        "due_at_milestone_approval"
    ) ?? [];

  return (
    milestonePaymentItems.length > 0 &&
    milestonePaymentItems.every(
      (paymentItem) =>
        paymentItem.status === "paid"
    )
  );
};

export const getListingRequestFinalDeliveryStatusLabel = (
  status: ListingRequestFinalDeliveryStatus,
  t: Translate = english
): string => t(`deliveryStatus.${status}`);

export const getListingRequestFinalDeliveryStatusSummary = (
  status: ListingRequestFinalDeliveryStatus,
  t: Translate = english
): string => t(`deliverySummary.${status}`);

export const getListingRequestFinalDeliveryStatusTone = (
  status: ListingRequestFinalDeliveryStatus
): ListingRequestFinalDeliveryTone =>
  status === "draft" ||
    status === "cancelled" ||
    status === "superseded"
    ? "muted"
    : status === "submitted"
      ? "review"
      : status === "buyer_approved"
        ? "success"
        : "danger";

export const canSubmitListingRequestFinalDelivery = (
  status: ListingRequestFinalDeliveryStatus
): boolean => status === "draft";

export const canBuyerRespondToListingRequestFinalDelivery = (
  status: ListingRequestFinalDeliveryStatus
): boolean => status === "submitted";

export const getLatestListingRequestFinalDelivery = <
  TFinalDelivery extends {
    created_at: string;
    id: string;
  },
>(
  finalDeliveries: TFinalDelivery[]
): TFinalDelivery | null =>
  [...finalDeliveries].sort((firstDelivery, secondDelivery) => {
    const dateDifference =
      new Date(secondDelivery.created_at).getTime() -
      new Date(firstDelivery.created_at).getTime();

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return secondDelivery.id.localeCompare(firstDelivery.id);
  })[0] ?? null;

export const getDraftListingRequestFinalDelivery = <
  TFinalDelivery extends {
    status: ListingRequestFinalDeliveryStatus;
    created_at: string;
    id: string;
  },
>(
  finalDeliveries: TFinalDelivery[]
): TFinalDelivery | null =>
  getLatestListingRequestFinalDelivery(
    finalDeliveries.filter(
      (finalDelivery) =>
        finalDelivery.status === "draft"
    )
  );

export const getSubmittedListingRequestFinalDelivery = <
  TFinalDelivery extends {
    status: ListingRequestFinalDeliveryStatus;
    created_at: string;
    id: string;
  },
>(
  finalDeliveries: TFinalDelivery[]
): TFinalDelivery | null =>
  getLatestListingRequestFinalDelivery(
    finalDeliveries.filter(
      (finalDelivery) =>
        finalDelivery.status === "submitted"
    )
  );

export const getListingRequestFinalDeliveryCreationBlockedReason =
  (
    agreement: ListingRequestFinalDeliveryAgreement | null,
    finalDeliveries: ListingRequestFinalDeliveryRow[]
  ): string | null => {
    if (!agreement) {
      return "A buyer-accepted project agreement is required before final delivery can be created.";
    }

    if (agreement.status !== "buyer_accepted") {
      return "A buyer-accepted project agreement is required before final delivery can be created.";
    }

    if (
      agreement.starting_payment_status !== "paid" &&
      agreement.starting_payment_status !== "not_required"
    ) {
      return "Starting payment must be resolved before final delivery can be created.";
    }

    if (!getHasAllMilestonePaymentsPaid(agreement)) {
      return "All milestone payments must be confirmed before final delivery can be created.";
    }

    const latestFinalDelivery =
      getLatestListingRequestFinalDelivery(finalDeliveries);

    if (
      latestFinalDelivery &&
      latestFinalDelivery.status !== "revision_requested" &&
      latestFinalDelivery.status !== "cancelled"
    ) {
      return "A new final delivery can only be created after the previous delivery is revised or cancelled.";
    }

    return null;
  };

export const canCreateNextListingRequestFinalDelivery = (
  agreement: ListingRequestFinalDeliveryAgreement | null,
  finalDeliveries: ListingRequestFinalDeliveryRow[]
): boolean =>
  getListingRequestFinalDeliveryCreationBlockedReason(
    agreement,
    finalDeliveries
  ) === null;

export const isListingRequestFinalDeliveryBuyerVisible = (input: {
  status: ListingRequestFinalDeliveryStatus;
  submittedAt: string | null;
}): boolean =>
  input.status !== "draft" &&
  Boolean(input.submittedAt);

export const getListingRequestFinalDeliveryApprovalBlockedReason =
  (
    agreement: ListingRequestFinalDeliveryAgreement | null,
    t: Translate = english
  ): string | null => {
    if (!agreement) {
      return null;
    }

    const hasUnconfirmedMilestonePayments =
      agreement.payment_structure ===
      "milestone_payments" &&
      !getHasAllMilestonePaymentsPaid(agreement);

    if (hasUnconfirmedMilestonePayments) {
      return t("deliveryBlocked.milestones");
    }

    const hasOutstandingFinalBalance =
      agreement
        .listing_request_payment_schedule_items
        ?.some(
          (paymentItem) =>
            paymentItem.payment_timing ===
            "due_before_final_release" &&
            (paymentItem.amount ?? 0) > 0 &&
            (paymentItem.status === "pending" ||
              paymentItem.status ===
              "payment_required")
        ) ?? false;

    if (hasOutstandingFinalBalance) {
      return t("deliveryBlocked.balance");
    }

    const hasActiveFinalBalanceHold =
      agreement.listing_request_timeline_holds?.some(
        (timelineHold) =>
          timelineHold.reason ===
          "balance_payment_pending" &&
          timelineHold.ended_at === null
      ) ?? false;

    if (hasActiveFinalBalanceHold) {
      return t("deliveryBlocked.balancePending");
    }

    return null;
  };

export const canApproveListingRequestFinalDelivery =
  (
    agreement: ListingRequestFinalDeliveryAgreement | null
  ): boolean =>
    agreement?.status === "buyer_accepted" &&
    getListingRequestFinalDeliveryApprovalBlockedReason(
      agreement
    ) === null;

export const canApproveSubmittedListingRequestFinalDelivery =
  (
    status: ListingRequestFinalDeliveryStatus,
    agreement: ListingRequestFinalDeliveryAgreement | null
  ): boolean =>
    canBuyerRespondToListingRequestFinalDelivery(status) &&
    canApproveListingRequestFinalDelivery(agreement);