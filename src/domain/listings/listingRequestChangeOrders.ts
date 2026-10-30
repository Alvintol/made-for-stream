import { english, type Translate } from "../../lib/i18n/i18n";
import type { ListingRequestChangeOrderStatus } from "./listingRequestAgreements";

export type ListingRequestChangeOrderTone =
  | "muted"
  | "review"
  | "success"
  | "danger";

export type ListingRequestChangeOrderImpact = {
  changesScope?: boolean;
  changesPrice?: boolean;
  changesTimeline?: boolean;
  changesDeliverables?: boolean;
  changesPaymentSchedule?: boolean;
  changesMilestones?: boolean;
};

export const getListingRequestChangeOrderStatusLabel = (
  status: ListingRequestChangeOrderStatus,
  t: Translate = english
): string => t(`changeOrderStatus.${status}`);

export const getListingRequestChangeOrderStatusSummary = (
  status: ListingRequestChangeOrderStatus,
  t: Translate = english
): string => t(`changeOrderSummary.${status}`);

export const getListingRequestChangeOrderStatusTone = (
  status: ListingRequestChangeOrderStatus
): ListingRequestChangeOrderTone =>
  status === "draft" ||
    status === "cancelled" ||
    status === "superseded"
    ? "muted"
    : status === "sent"
      ? "review"
      : status === "buyer_accepted"
        ? "success"
        : "danger";

export const canSendListingRequestChangeOrder = (
  status: ListingRequestChangeOrderStatus
): boolean => status === "draft";

// The creator can take back their own change order until the buyer has
// answered it. The database decides (withdraw_listing_request_change_order).
export const canWithdrawListingRequestChangeOrder = (
  status: ListingRequestChangeOrderStatus
): boolean => status === "draft" || status === "sent";

export const canBuyerRespondToListingRequestChangeOrder = (
  status: ListingRequestChangeOrderStatus
): boolean => status === "sent";

export const isListingRequestChangeOrderBuyerVisible = (input: {
  status: ListingRequestChangeOrderStatus;
  sentAt: string | null;
}): boolean => input.status !== "draft" && Boolean(input.sentAt);

export const hasListingRequestChangeOrderImpact = (
  impact: ListingRequestChangeOrderImpact
): boolean =>
  Boolean(
    impact.changesScope ||
    impact.changesPrice ||
    impact.changesTimeline ||
    impact.changesDeliverables ||
    impact.changesPaymentSchedule ||
    impact.changesMilestones
  );

export const getListingRequestChangeOrderImpactLabels = (
  impact: ListingRequestChangeOrderImpact,
  t: Translate = english
): string[] => {
  const labels: string[] = [];

  if (impact.changesScope) {
    labels.push(t("changeOrderImpact.scope"));
  }

  if (impact.changesPrice) {
    labels.push(t("changeOrderImpact.price"));
  }

  if (impact.changesTimeline) {
    labels.push(t("changeOrderImpact.timeline"));
  }

  if (impact.changesDeliverables) {
    labels.push(t("changeOrderImpact.deliverables"));
  }

  if (impact.changesPaymentSchedule) {
    labels.push(t("changeOrderImpact.paymentSchedule"));
  }

  if (impact.changesMilestones) {
    labels.push(t("changeOrderImpact.milestones"));
  }

  return labels;
};

export const getLatestListingRequestChangeOrder = <
  TChangeOrder extends {
    created_at: string;
    id: string;
  },
>(
  changeOrders: TChangeOrder[]
): TChangeOrder | null =>
  [...changeOrders].sort((firstChangeOrder, secondChangeOrder) => {
    const dateDifference =
      new Date(secondChangeOrder.created_at).getTime() -
      new Date(firstChangeOrder.created_at).getTime();

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return secondChangeOrder.id.localeCompare(firstChangeOrder.id);
  })[0] ?? null;

export const getDraftListingRequestChangeOrder = <
  TChangeOrder extends {
    status: string;
    created_at: string;
    id: string;
  },
>(
  changeOrders: TChangeOrder[]
): TChangeOrder | null =>
  getLatestListingRequestChangeOrder(
    changeOrders.filter(
      (changeOrder) => changeOrder.status === "draft"
    )
  );

export const getSentListingRequestChangeOrder = <
  TChangeOrder extends {
    status: string;
    created_at: string;
    id: string;
  },
>(
  changeOrders: TChangeOrder[]
): TChangeOrder | null =>
  getLatestListingRequestChangeOrder(
    changeOrders.filter(
      (changeOrder) => changeOrder.status === "sent"
    )
  );

// The one change order still waiting on someone: a draft, or one sent and
// not yet answered. There is never more than one.
export const getPendingListingRequestChangeOrder = <
  TChangeOrder extends {
    status: string;
    created_at: string;
    id: string;
  },
>(
  changeOrders: TChangeOrder[]
): TChangeOrder | null =>
  getLatestListingRequestChangeOrder(
    changeOrders.filter(
      (changeOrder) =>
        changeOrder.status === "draft" ||
        changeOrder.status === "sent"
    )
  );

export const getHasPendingListingRequestChangeOrder = <
  TChangeOrder extends {
    status: string;
  },
>(
  changeOrders: TChangeOrder[]
): boolean =>
  changeOrders.some(
    (changeOrder) =>
      changeOrder.status === "draft" ||
      changeOrder.status === "sent"
  );

type ListingRequestChangeOrderCreatableAgreement = {
  status: string;
};

export const canCreateListingRequestChangeOrder = <
  TChangeOrder extends {
    status: string;
  },
>(
  requestStatus: string,
  agreement: ListingRequestChangeOrderCreatableAgreement | null,
  changeOrders: TChangeOrder[]
): boolean =>
  requestStatus === "accepted" &&
  agreement?.status === "buyer_accepted" &&
  !getHasPendingListingRequestChangeOrder(changeOrders);
