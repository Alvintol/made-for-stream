import { english, type Translate } from "../../lib/i18n/i18n";

export type ListingRequestAgreementStatus =
  | "draft"
  | "sent"
  | "buyer_accepted"
  | "buyer_declined"
  | "superseded"
  | "cancelled";

export type ListingRequestPaymentStructure =
  | "full_prepayment"
  | "deposit_balance"
  | "milestone_payments";

export type ListingRequestPaymentTiming =
  | "due_before_work_starts"
  | "due_at_milestone_approval"
  | "due_before_final_release"
  | "due_on_change_order_acceptance"
  | "included_no_extra_charge"
  | "optional_not_selected";

export type ListingRequestStartingPaymentStatus =
  | "not_required"
  | "payment_required"
  | "paid";

export type ListingRequestChangeOrderStatus =
  | "draft"
  | "sent"
  | "buyer_accepted"
  | "buyer_declined"
  | "cancelled"
  | "superseded";

export type ListingRequestMinimumUpdateRule = {
  rule: "single_progress_update" | "weekly_updates";
  label: string;
  summary: string;
  firstUpdateDueDays: number | null;
  updateFrequencyDays: number | null;
  recommendedCheckpoints: string[];
};

export const listingRequestPaymentStructureOptions: Array<{
  value: ListingRequestPaymentStructure;
}> = [
    { value: "full_prepayment" },
    { value: "deposit_balance" },
    { value: "milestone_payments" },
  ];

export type ListingRequestBuyerHoldReason =
  | "agreement_acceptance_pending"
  | "starting_payment_pending"
  | "milestone_approval_pending"
  | "milestone_payment_pending"
  | "change_order_response_pending"
  | "change_order_payment_pending"
  | "balance_payment_pending";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getListingRequestBuyerHoldReasonLabel = (
  reason: ListingRequestBuyerHoldReason,
  t: Translate = english
): string => t(`holdReason.${reason}`);

export const getListingRequestAgreementStatusLabel = (
  status: ListingRequestAgreementStatus,
  t: Translate = english
): string => t(`agreementStatus.${status}`);

export const getListingRequestAgreementStatusSummary = (
  status: ListingRequestAgreementStatus,
  t: Translate = english
): string => t(`agreementSummary.${status}`);

export const getListingRequestPaymentStructureLabel = (
  structure: ListingRequestPaymentStructure,
  t: Translate = english
): string => t(`paymentStructure.${structure}`);

// Sprint 4 (launch-scope.md section 5.4): a null included_revision_count
// means the agreement never stated a number, and Refund Policy section 5's
// fallback is two rounds per separately priced deliverable. A stored 0
// predates this migration and is left exactly as written -- it is not
// treated as "not stated."
export const DEFAULT_LISTING_REQUEST_INCLUDED_REVISION_COUNT = 2;

export const getListingRequestIncludedRevisionCount = (
  includedRevisionCount: number | null
): number =>
  includedRevisionCount ?? DEFAULT_LISTING_REQUEST_INCLUDED_REVISION_COUNT;

export const getListingRequestPaymentTimingLabel = (
  timing: ListingRequestPaymentTiming,
  t: Translate = english
): string => t(`paymentTiming.${timing}`);

export const getMinimumCreatorUpdateRule = (
  estimatedWorkDays: number,
  t: Translate = english
): ListingRequestMinimumUpdateRule => {
  // Keep the rule stable even if the creator enters a rough/invalid estimate.
  const safeEstimatedDays = Math.max(1, Math.ceil(estimatedWorkDays));

  return safeEstimatedDays < 7
    ? {
      rule: "single_progress_update",
      label: t("updateRule.singleLabel"),
      summary: t("updateRule.singleSummary"),
      firstUpdateDueDays: null,
      updateFrequencyDays: null,
      recommendedCheckpoints: ["50% progress update"],
    }
    : {
      rule: "weekly_updates",
      label: t("updateRule.weeklyLabel"),
      summary: t("updateRule.weeklySummary"),
      firstUpdateDueDays: 5,
      updateFrequencyDays: 7,
      recommendedCheckpoints: [
        "First update within 5 days",
        "Weekly progress update",
        "Pre-final preview",
      ],
    };
};

// A website rule only: the database accepts a milestone plan of any length.
export const MILESTONE_MINIMUM_WORK_DAYS = 7;

export const allowsMilestonePayments =(estimatedWorkDays: number): boolean =>
  estimatedWorkDays >= MILESTONE_MINIMUM_WORK_DAYS;

export const canSendListingRequestAgreement = (
  status: ListingRequestAgreementStatus
): boolean => status === "draft";

export const canStartWorkForAcceptedRequest = (input: {
  requestStatus: string;
  agreementStatus: ListingRequestAgreementStatus;
  startingPaymentStatus: ListingRequestStartingPaymentStatus;
}): boolean =>
  input.requestStatus === "accepted" &&
  input.agreementStatus === "buyer_accepted" &&
  input.startingPaymentStatus !== "payment_required";

export type ListingRequestAgreementAcknowledgementInput = {
  id: string;
  scope_summary: string;
  additional_cost_policy: string;
  revision_policy?: string | null;
  update_schedule_summary?: string | null;
  estimated_completion_at: string;
  adjusted_estimated_completion_at: string;
  listing_request_agreement_items: Array<{
    id: string;
    title: string;
    item_type?: string;
    is_required: boolean;
    is_selected: boolean;
    sort_order: number;
  }>;
  listing_request_payment_schedule_items: Array<{
    id: string;
    title: string;
    amount: number;
    currency: string;
    sort_order: number;
  }>;
};

export type ListingRequestAgreementAcknowledgement = {
  key: string;
  label: string;
};

const sortBySortOrder = <T extends { sort_order: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.sort_order - b.sort_order);

export const getRequiredListingRequestAgreementAcknowledgements = (
  agreement: ListingRequestAgreementAcknowledgementInput
): ListingRequestAgreementAcknowledgement[] => {
  const requiredScopeItems = sortBySortOrder(
    agreement.listing_request_agreement_items.filter(
      (item) => item.is_required && item.is_selected
    )
  ).map((item) => ({
    key: `scope_item:${item.id}`,
    // Same words as respond_listing_request_agreement (20261027_167).
    label: `${
      item.item_type === "buyer_provides"
        ? "I understand I need to provide:"
        : item.item_type === "buyer_approves"
          ? "I understand I need to approve:"
          : item.item_type === "milestone"
            ? "I understand this milestone:"
            : "I understand this scope item:"
    } ${item.title}`,
  }));

  const requiredPaymentItems = sortBySortOrder(
    agreement.listing_request_payment_schedule_items
  ).map((item) => ({
    key: `payment_item:${item.id}`,
    label: `I understand this payment item: ${item.title}`,
  }));

  return [
    {
      key: "agreement:scope_summary",
      label: "I understand the project scope summary.",
    },
    ...requiredScopeItems,
    {
      key: "agreement:payment_schedule",
      label: "I understand the payment schedule.",
    },
    ...requiredPaymentItems,
    {
      key: "agreement:timeline",
      label:
        "I understand the estimated completion date and buyer-side hold rules.",
    },
    {
      key: "agreement:update_schedule",
      label: "I understand the creator update schedule.",
    },
    {
      key: "agreement:revision_policy",
      label: "I understand the included revision policy.",
    },
    {
      key: "agreement:additional_cost_policy",
      label: "I understand the additional cost policy.",
    },
    {
      key: "agreement:change_orders",
      label:
        "I understand scope, price, timeline, deliverable, or payment changes require an accepted change order.",
    },
    {
      key: "agreement:final_release_payment",
      label:
        "I understand final files or deliverables may be held until required payments are complete.",
    },
  ];
};

// What a scope checklist line is: part of the work, or something the buyer
// has to do (20261008_153). Shown beside the line, with the buyer's own
// handle or display name in place of "the buyer".
export type AgreementChecklistItemType = "included" | "buyer_provides" | "buyer_approves";

// Null for a line that is not a checklist line (a milestone, an add-on).
export const getAgreementChecklistItemLabel = (
  itemType: string,
  buyerName: string,
  t: Translate = english
): string | null =>
  itemType === "buyer_provides"
    ? t("checklistItem.buyerProvides", { name: buyerName })
    : itemType === "buyer_approves"
      ? t("checklistItem.buyerApproves", { name: buyerName })
      : itemType === "included"
        ? t("checklistItem.included")
        : null;

// How a person is named on an agreement: their handle, else their display
// name, else the fallback ("The buyer").
export const getAgreementPersonName = (
  profile: { handle?: string | null; display_name?: string | null } | null | undefined,
  fallback: string
): string => profile?.handle?.trim() || profile?.display_name?.trim() || fallback;

// The buyer confirms the agreement one displayed section at a time: an
// "I understand" box under each section stands for every acknowledgement the
// database requires about that section (respond_listing_request_agreement
// still receives, checks and records each key). Anything not recognised
// falls under "policies", which is always shown, so no key can be left
// without a box.
export type AgreementAcknowledgementSection =
  | "terms"
  | "scope"
  | "checklist"
  | "schedule"
  | "policies";

export const getAgreementAcknowledgementSection = (
  key: string
): AgreementAcknowledgementSection =>
  key === "agreement:timeline"
    ? "terms"
    : key === "agreement:scope_summary"
      ? "scope"
      : key.startsWith("scope_item:")
        ? "checklist"
        : key === "agreement:payment_schedule" ||
            key === "agreement:final_release_payment" ||
            key.startsWith("payment_item:")
          ? "schedule"
          : "policies";

export const getAgreementAcknowledgementKeysBySection = (
  requiredAcknowledgements: ListingRequestAgreementAcknowledgement[]
): Record<AgreementAcknowledgementSection, string[]> => {
  const sections: Record<AgreementAcknowledgementSection, string[]> = {
    terms: [],
    scope: [],
    checklist: [],
    schedule: [],
    policies: [],
  };

  requiredAcknowledgements.forEach((acknowledgement) => {
    sections[getAgreementAcknowledgementSection(acknowledgement.key)].push(acknowledgement.key);
  });

  return sections;
};

export const areRequiredAgreementAcknowledgementsChecked = (input: {
  requiredAcknowledgements: ListingRequestAgreementAcknowledgement[];
  checkedKeys: string[];
}): boolean => {
  const checkedSet = new Set(input.checkedKeys);

  return input.requiredAcknowledgements.every((acknowledgement) =>
    checkedSet.has(acknowledgement.key)
  );
};
// The standard Made for Stream rate on each side, in basis points. A rate is
// resolved per user and locked at agreement acceptance as a ceiling that can
// only be lowered (launch-scope.md sections 3.5-3.6), so fees worked out at
// this rate are the most an agreement can cost -- which is why the agreement
// quotes them as a maximum (Fee Schedule section 2).
export const STANDARD_FEE_BPS = 500;

// Mirrors ensure_listing_request_payment_for_schedule_item: each instalment's
// fee is rounded up to the cent on its own, then summed. Waived and cancelled
// items are never charged.
export const getMaximumAgreementFeeAmount = (
  scheduleItems: ReadonlyArray<{ amount: number; status: string }>,
  feeBps: number = STANDARD_FEE_BPS,
): number =>
  scheduleItems
    .filter((item) => item.status !== "waived" && item.status !== "cancelled")
    .reduce(
      (totalCents, item) =>
        totalCents + Math.ceil((Math.round(item.amount * 100) * feeBps) / 10000),
      0,
    ) / 100;
