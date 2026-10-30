import { english, type Translate } from "../../lib/i18n/i18n";
import { allowsMilestonePayments } from "./listingRequestAgreements";

export type ListingRequestMilestoneStatus =
  | "pending"
  | "submitted"
  | "revision_requested"
  | "buyer_approved"
  | "payment_required"
  | "paid"
  | "cancelled";

export type ListingRequestMilestoneTone =
  | "muted"
  | "review"
  | "success"
  | "danger";

export type ListingRequestMilestonePlanItem = {
  title: string;
  description?: string | null;
  amount: number;
  sortOrder: number;
};

export type ListingRequestMilestonePlanValidation = {
  isValid: boolean;
  errors: string[];
  milestoneTotal: number;
};

export type ListingRequestMilestoneOrderable = {
  status: ListingRequestMilestoneStatus;
  sort_order: number;
};

const roundCurrencyAmount = (
  amount: number
): number =>
  Math.round((amount + Number.EPSILON) * 100) /
  100;

export const getListingRequestMilestoneStatusLabel = (
  status: ListingRequestMilestoneStatus,
  t: Translate = english
): string => t(`milestoneStatus.${status}`);

export const getListingRequestMilestoneStatusSummary = (
  status: ListingRequestMilestoneStatus,
  t: Translate = english
): string => t(`milestoneSummary.${status}`);

export const getListingRequestMilestoneStatusTone = (
  status: ListingRequestMilestoneStatus
): ListingRequestMilestoneTone =>
  status === "submitted" ||
    status === "payment_required"
    ? "review"
    : status === "buyer_approved" ||
      status === "paid"
      ? "success"
      : status === "revision_requested"
        ? "danger"
        : "muted";

export const canSubmitListingRequestMilestone = (
  status: ListingRequestMilestoneStatus
): boolean =>
  status === "pending" ||
  status === "revision_requested";

export const getListingRequestMilestonePlanTotal = (
  milestones: ListingRequestMilestonePlanItem[]
): number =>
  roundCurrencyAmount(
    milestones.reduce(
      (total, milestone) =>
        total + milestone.amount,
      0
    )
  );

export const isListingRequestMilestoneTerminal = (
  status: ListingRequestMilestoneStatus
): boolean =>
  status === "paid" || status === "cancelled";

export const validateListingRequestMilestonePlan = (
  input: {
    estimatedWorkDays: number;
    agreementTotal: number;
    milestones: ListingRequestMilestonePlanItem[];
  },
  t: Translate = english
): ListingRequestMilestonePlanValidation => {
  const errors: string[] = [];

  const agreementTotal = roundCurrencyAmount(
    input.agreementTotal
  );

  const milestoneTotal =
    getListingRequestMilestonePlanTotal(
      input.milestones
    );

  if (
    !allowsMilestonePayments(
      input.estimatedWorkDays
    )
  ) {
    errors.push(t("milestonePlan.errorLength"));
  }

  if (input.milestones.length < 2) {
    errors.push(t("milestonePlan.errorCount"));
  }

  const sortOrders = new Set<number>();

  input.milestones.forEach(
    (milestone, index) => {
      const cleanTitle = milestone.title.trim();
      const cleanDescription =
        milestone.description?.trim() ?? "";

      if (
        cleanTitle.length < 3 ||
        cleanTitle.length > 160
      ) {
        errors.push(t("milestonePlan.errorTitle", { number: index + 1 }));
      }

      if (cleanDescription.length > 2000) {
        errors.push(t("milestonePlan.errorDescription", { number: index + 1 }));
      }

      if (
        !Number.isFinite(milestone.amount) ||
        milestone.amount <= 0
      ) {
        errors.push(t("milestonePlan.errorAmount", { number: index + 1 }));
      }

      if (
        !Number.isInteger(milestone.sortOrder) ||
        milestone.sortOrder < 0
      ) {
        errors.push(t("milestonePlan.errorOrder", { number: index + 1 }));
      }

      if (sortOrders.has(milestone.sortOrder)) {
        errors.push(t("milestonePlan.errorUnique"));
      }

      sortOrders.add(milestone.sortOrder);
    }
  );

  if (
    Number.isFinite(agreementTotal) &&
    agreementTotal > 0 &&
    milestoneTotal !== agreementTotal
  ) {
    errors.push(t("milestonePlan.errorTotal"));
  }

  return {
    isValid: errors.length === 0,
    errors,
    milestoneTotal,
  };
};

export const getOrderedListingRequestMilestones = <
  TMilestone extends ListingRequestMilestoneOrderable,
>(
  milestones: TMilestone[]
): TMilestone[] =>
  [...milestones].sort(
    (firstMilestone, secondMilestone) =>
      firstMilestone.sort_order -
      secondMilestone.sort_order
  );

export const getActiveListingRequestMilestone = <
  TMilestone extends ListingRequestMilestoneOrderable,
>(
  milestones: TMilestone[]
): TMilestone | null =>
  getOrderedListingRequestMilestones(milestones).find(
    (milestone) =>
      !isListingRequestMilestoneTerminal(
        milestone.status
      )
  ) ?? null;

export const getListingRequestMilestonesAreComplete = (
  milestones: Array<{
    status: ListingRequestMilestoneStatus;
  }>
): boolean =>
  milestones.length > 0 &&
  milestones.every((milestone) =>
    isListingRequestMilestoneTerminal(
      milestone.status
    )
  );