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
  label: string;
}> = [
    { value: "full_prepayment", label: "Full prepayment" },
    { value: "deposit_balance", label: "Deposit + balance" },
    { value: "milestone_payments", label: "Milestone payments" },
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
  reason: ListingRequestBuyerHoldReason
): string =>
  reason === "agreement_acceptance_pending"
    ? "Agreement acceptance pending"
    : reason === "starting_payment_pending"
      ? "Starting payment pending"
      : reason === "milestone_approval_pending"
        ? "Milestone approval pending"
        : reason === "milestone_payment_pending"
          ? "Milestone payment pending"
          : reason === "change_order_response_pending"
            ? "Change order response pending"
            : reason === "change_order_payment_pending"
              ? "Change order payment pending"
              : "Balance payment pending";

export const getListingRequestAgreementStatusLabel = (
  status: ListingRequestAgreementStatus
): string =>
  status === "draft"
    ? "Draft"
    : status === "sent"
      ? "Awaiting buyer review"
      : status === "buyer_accepted"
        ? "Accepted by buyer"
        : status === "buyer_declined"
          ? "Declined by buyer"
          : status === "superseded"
            ? "Superseded"
            : "Cancelled";

export const getListingRequestAgreementStatusSummary = (
  status: ListingRequestAgreementStatus
): string =>
  status === "draft"
    ? "The creator is preparing the project agreement."
    : status === "sent"
      ? "The buyer needs to review and accept the project agreement before payment or work can begin."
      : status === "buyer_accepted"
        ? "The buyer accepted the project agreement."
        : status === "buyer_declined"
          ? "The buyer declined this project agreement."
          : status === "superseded"
            ? "This agreement was replaced by a newer version."
            : "This agreement was cancelled.";

export const getListingRequestPaymentStructureLabel = (
  structure: ListingRequestPaymentStructure
): string =>
  structure === "full_prepayment"
    ? "Full prepayment"
    : structure === "deposit_balance"
      ? "Deposit + balance"
      : "Milestone payments";

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
  timing: ListingRequestPaymentTiming
): string =>
  timing === "due_before_work_starts"
    ? "Due before work starts"
    : timing === "due_at_milestone_approval"
      ? "Due at milestone approval"
      : timing === "due_before_final_release"
        ? "Due before final release"
        : timing === "due_on_change_order_acceptance"
          ? "Due when change order is accepted"
          : timing === "included_no_extra_charge"
            ? "Included, no extra charge"
            : "Optional, not selected";

export const getMinimumCreatorUpdateRule = (
  estimatedWorkDays: number
): ListingRequestMinimumUpdateRule => {
  // Keep the rule stable even if the creator enters a rough/invalid estimate.
  const safeEstimatedDays = Math.max(1, Math.ceil(estimatedWorkDays));

  return safeEstimatedDays < 7
    ? {
      rule: "single_progress_update",
      label: "One progress update required",
      summary:
        "This project is estimated under one week, so the creator must provide at least one progress update before final delivery.",
      firstUpdateDueDays: null,
      updateFrequencyDays: null,
      recommendedCheckpoints: ["50% progress update"],
    }
    : {
      rule: "weekly_updates",
      label: "Weekly updates required",
      summary:
        "This project is estimated at one week or longer, so the creator must provide weekly progress updates until delivery.",
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
    label: `I understand this scope item: ${item.title}`,
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
