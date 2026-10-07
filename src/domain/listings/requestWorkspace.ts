import type {
  ListingRequestAgreementStatus,
  ListingRequestPaymentStructure,
  ListingRequestStartingPaymentStatus,
} from "./listingRequestAgreements";
import type { ListingRequestFinalDeliveryStatus } from "./listingRequestFinalDeliveries";
import {
  getActiveListingRequestMilestone,
  getOrderedListingRequestMilestones,
  isListingRequestMilestoneTerminal,
  type ListingRequestMilestoneStatus,
} from "./listingRequestMilestones";
import type { ListingRequestStatus } from "./listingRequests";

export type RequestWorkspaceViewer = "buyer" | "creator" | "admin";
export type RequestParty = "buyer" | "creator";

export type RequestWorkspaceSectionId =
  | "request"
  | "agreement"
  | "payments"
  | "milestones"
  | "changeOrders"
  | "delivery"
  | "progress"
  | "snapshot";

export type RequestWorkspaceCancellationProposalStatus =
  | "pending_creator_statement"
  | "pending_buyer_response"
  | "accepted"
  | "disputed";

export type RequestWorkspaceInput = {
  requestStatus: ListingRequestStatus;
  agreement: {
    status: ListingRequestAgreementStatus;
    payment_structure: ListingRequestPaymentStructure;
    starting_payment_status: ListingRequestStartingPaymentStatus;
    listing_request_payment_schedule_items?: Array<{
      status: string;
      payment_timing: string;
    }>;
  } | null;
  milestones?: Array<{
    status: ListingRequestMilestoneStatus;
    sort_order: number;
    title: string;
  }>;
  changeOrders?: Array<{ status: string; created_at?: string }>;
  finalDeliveries?: Array<{
    status: ListingRequestFinalDeliveryStatus;
    created_at?: string;
    version_number?: number;
  }>;
  // Sprint 4 (launch-scope.md section 5.2): an open post-payment
  // cancellation proposal takes priority over the ordinary workflow steps
  // below -- neither party should be nudged to pay a milestone or submit
  // delivery while a cancellation is being negotiated.
  cancellationProposal?: {
    status: RequestWorkspaceCancellationProposalStatus;
    statement_due_at?: string | null;
  } | null;
};

export type RequestStageState = "done" | "current" | "upcoming";

export type RequestStage = {
  key: "submitted" | "agreement" | "payment" | "work" | "delivery" | "complete";
  label: string;
  state: RequestStageState;
};

export type RequestNextStep = {
  key: string;
  owner: RequestParty | null;
  tone: "action" | "closed" | "done";
  actionTitle: string;
  actionDescription: string;
  actionLabel?: string;
  waitingTitle: string;
  waitingDescription: string;
  sectionId?: RequestWorkspaceSectionId;
};

const hasStatus = (items: Array<{ status: string }> | undefined, status: string) =>
  (items ?? []).some((item) => item.status === status);

const latestByOrder = <T extends { created_at?: string; version_number?: number }>(
  items: T[]
): T | null =>
  [...items].sort(
    (a, b) =>
      (b.version_number ?? 0) - (a.version_number ?? 0) ||
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
  )[0] ?? null;

const hasSchedulePaymentDue = (
  agreement: RequestWorkspaceInput["agreement"],
  timing: string
) =>
  (agreement?.listing_request_payment_schedule_items ?? []).some(
    (item) => item.payment_timing === timing && item.status === "payment_required"
  );

const isAgreementAccepted = (input: RequestWorkspaceInput) =>
  input.agreement?.status === "buyer_accepted";

const isStartingPaymentResolved = (input: RequestWorkspaceInput) =>
  input.agreement?.starting_payment_status !== "payment_required";

export const getRequestMilestoneProgress = (
  milestones: RequestWorkspaceInput["milestones"] = []
): { done: number; total: number } => ({
  done: milestones.filter((milestone) => isListingRequestMilestoneTerminal(milestone.status))
    .length,
  total: milestones.length,
});

export const getRequestStages = (input: RequestWorkspaceInput): RequestStage[] => {
  const { requestStatus, agreement } = input;

  if (
    requestStatus === "declined" ||
    requestStatus === "archived" ||
    requestStatus === "cancelled"
  ) {
    return [];
  }

  const completed = requestStatus === "completed";
  const accepted = isAgreementAccepted(input);
  const latestDelivery = latestByOrder(input.finalDeliveries ?? []);
  const deliveryInReview =
    latestDelivery?.status === "submitted" ||
    latestDelivery?.status === "revision_requested";
  const needsStartingPayment = agreement?.starting_payment_status !== "not_required";
  const milestoneProgress = getRequestMilestoneProgress(input.milestones);

  const stateFor = (isDone: boolean, isCurrent: boolean): RequestStageState =>
    completed || isDone ? "done" : isCurrent ? "current" : "upcoming";

  const stages: RequestStage[] = [
    {
      key: "submitted",
      label: requestStatus === "submitted" ? "In review" : "Accepted",
      state: stateFor(requestStatus !== "submitted", requestStatus === "submitted"),
    },
    {
      key: "agreement",
      label: "Agreement",
      state: stateFor(accepted, requestStatus === "accepted" && !accepted),
    },
  ];

  if (needsStartingPayment) {
    stages.push({
      key: "payment",
      label: agreement?.payment_structure === "deposit_balance" ? "Deposit" : "Payment",
      state: stateFor(
        accepted && isStartingPaymentResolved(input),
        accepted && !isStartingPaymentResolved(input)
      ),
    });
  }

  const workLabel =
    agreement?.payment_structure === "milestone_payments" && milestoneProgress.total > 0
      ? `Milestones ${milestoneProgress.done}/${milestoneProgress.total}`
      : "In progress";

  stages.push(
    {
      key: "work",
      label: workLabel,
      state: stateFor(
        accepted && deliveryInReview,
        accepted && isStartingPaymentResolved(input) && !deliveryInReview
      ),
    },
    {
      key: "delivery",
      label: "Delivery",
      state: stateFor(false, accepted && deliveryInReview),
    },
    {
      key: "complete",
      label: "Complete",
      state: stateFor(false, false),
    }
  );

  return stages;
};

const step = (value: RequestNextStep): RequestNextStep => value;

export const getRequestNextStep = (input: RequestWorkspaceInput): RequestNextStep => {
  const { requestStatus, agreement } = input;

  if (requestStatus === "declined") {
    return step({
      key: "declined",
      owner: null,
      tone: "closed",
      actionTitle: "Commission request declined",
      actionDescription: "This commission is closed and read-only.",
      waitingTitle: "Commission request declined",
      waitingDescription: "This commission is closed and read-only.",
    });
  }

  if (requestStatus === "archived") {
    return step({
      key: "archived",
      owner: null,
      tone: "closed",
      actionTitle: "Commission archived",
      actionDescription: "Archived commissions are kept for your records and are read-only.",
      waitingTitle: "Commission archived",
      waitingDescription: "Archived commissions are kept for your records and are read-only.",
    });
  }

  if (requestStatus === "cancelled") {
    return step({
      key: "cancelled",
      owner: null,
      tone: "closed",
      actionTitle: "Commission cancelled",
      actionDescription: "This commission was cancelled and is now read-only.",
      waitingTitle: "Commission cancelled",
      waitingDescription: "This commission was cancelled and is now read-only.",
    });
  }

  if (input.cancellationProposal) {
    const { cancellationProposal } = input;

    if (cancellationProposal.status === "disputed") {
      return step({
        key: "cancellation-disputed",
        owner: null,
        tone: "closed",
        actionTitle: "Cancellation under review",
        actionDescription:
          "The cancellation statement was disputed. Made for Stream will review and decide.",
        waitingTitle: "Cancellation under review",
        waitingDescription:
          "The cancellation statement was disputed. Made for Stream will review and decide.",
        sectionId: "request",
      });
    }

    if (cancellationProposal.status === "pending_creator_statement") {
      return step({
        key: "submit-cancellation-statement",
        owner: "creator",
        tone: "action",
        actionTitle: "Submit the cancellation statement",
        actionDescription:
          "A cancellation was proposed. Provide an itemised earned-value statement for each paid payment.",
        actionLabel: "Open cancellation",
        waitingTitle: "Waiting for the creator's cancellation statement",
        waitingDescription: cancellationProposal.statement_due_at
          ? `The creator has until ${new Date(
              cancellationProposal.statement_due_at
            ).toLocaleString()} to respond.`
          : "The creator has three business days to respond.",
        sectionId: "request",
      });
    }

    if (cancellationProposal.status === "pending_buyer_response") {
      return step({
        key: "respond-cancellation-statement",
        owner: "buyer",
        tone: "action",
        actionTitle: "Review the cancellation statement",
        actionDescription:
          "The creator itemised what they consider earned. Accept it or dispute it.",
        actionLabel: "Review cancellation",
        waitingTitle: "Waiting for the buyer to respond to the cancellation statement",
        waitingDescription: "The project stays open until they accept or dispute it.",
        sectionId: "request",
      });
    }
  }

  if (requestStatus === "completed") {
    return step({
      key: "completed",
      owner: null,
      tone: "done",
      actionTitle: "Project complete",
      actionDescription: "The final delivery was approved. Everything below is kept for reference.",
      waitingTitle: "Project complete",
      waitingDescription: "The final delivery was approved. Everything below is kept for reference.",
      sectionId: "delivery",
    });
  }

  if (requestStatus === "submitted") {
    return step({
      key: "review-request",
      owner: "creator",
      tone: "action",
      actionTitle: "Review this commission",
      actionDescription: "Accept to start agreeing terms, or decline with a reason.",
      actionLabel: "Review commission",
      waitingTitle: "Waiting for the creator to review your commission request",
      waitingDescription: "You can agree terms once they accept.",
      sectionId: "request",
    });
  }

  if (!agreement || agreement.status === "superseded" || agreement.status === "cancelled") {
    return step({
      key: "create-agreement",
      owner: "creator",
      tone: "action",
      actionTitle: "Create the project agreement",
      actionDescription: "Set scope, price, timeline and payments for the buyer to accept.",
      actionLabel: "Start agreement",
      waitingTitle: "The creator is preparing the project agreement",
      waitingDescription: "You'll review scope, price and timeline before any payment.",
      sectionId: "agreement",
    });
  }

  if (agreement.status === "draft") {
    return step({
      key: "send-agreement",
      owner: "creator",
      tone: "action",
      actionTitle: "Send the project agreement",
      actionDescription: "Your draft is ready. Check it over and send it to the buyer.",
      actionLabel: "Review draft",
      waitingTitle: "The creator is preparing the project agreement",
      waitingDescription: "You'll review scope, price and timeline before any payment.",
      sectionId: "agreement",
    });
  }

  if (agreement.status === "sent") {
    return step({
      key: "accept-agreement",
      owner: "buyer",
      tone: "action",
      actionTitle: "Review and accept the agreement",
      actionDescription: "Check the scope, price and timeline, then accept or decline.",
      actionLabel: "Review agreement",
      waitingTitle: "Waiting for the buyer to accept the agreement",
      waitingDescription: "Work can start once they accept and pay any starting payment.",
      sectionId: "agreement",
    });
  }

  if (agreement.status === "buyer_declined") {
    return step({
      key: "revise-agreement",
      owner: "creator",
      tone: "action",
      actionTitle: "Revise the project agreement",
      actionDescription: "The buyer declined the last version. Update the terms and send a new one.",
      actionLabel: "Open agreement",
      waitingTitle: "The creator is revising the agreement",
      waitingDescription: "You declined the last version. A new one will appear here to review.",
      sectionId: "agreement",
    });
  }

  if (agreement.starting_payment_status === "payment_required") {
    const paymentName =
      agreement.payment_structure === "deposit_balance" ? "deposit" : "starting payment";

    return step({
      key: "pay-starting",
      owner: "buyer",
      tone: "action",
      actionTitle: `Pay the ${paymentName}`,
      actionDescription: "Work begins once it's paid.",
      actionLabel: "Go to payments",
      waitingTitle: `Waiting for the buyer's ${paymentName}`,
      waitingDescription: "Hold off on starting work until it's confirmed.",
      sectionId: "payments",
    });
  }

  if (hasStatus(input.changeOrders, "sent")) {
    return step({
      key: "respond-change-order",
      owner: "buyer",
      tone: "action",
      actionTitle: "Review the change order",
      actionDescription: "The creator proposed changes to the agreed terms. Accept or decline them.",
      actionLabel: "Review change order",
      waitingTitle: "Waiting for the buyer to respond to the change order",
      waitingDescription: "The current terms stay in place until they respond.",
      sectionId: "changeOrders",
    });
  }

  if (hasStatus(input.changeOrders, "draft")) {
    return step({
      key: "send-change-order",
      owner: "creator",
      tone: "action",
      actionTitle: "Send your change order",
      actionDescription: "You have a draft change order that the buyer hasn't seen yet.",
      actionLabel: "Review draft",
      waitingTitle: "The creator is working on your project",
      waitingDescription: "You'll be asked to review anything that needs your input.",
      sectionId: "changeOrders",
    });
  }

  if (hasSchedulePaymentDue(agreement, "due_on_change_order_acceptance")) {
    return step({
      key: "pay-change-order",
      owner: "buyer",
      tone: "action",
      actionTitle: "Pay for the accepted change order",
      actionDescription: "The extra work starts once this payment is made.",
      actionLabel: "Go to payments",
      waitingTitle: "Waiting for the change order payment",
      waitingDescription: "The added scope starts once it's paid.",
      sectionId: "payments",
    });
  }

  const latestDelivery = latestByOrder(input.finalDeliveries ?? []);

  if (latestDelivery?.status === "submitted") {
    return step({
      key: "review-delivery",
      owner: "buyer",
      tone: "action",
      actionTitle: "Review the final delivery",
      actionDescription: "Approve it to complete the project, or ask for revisions.",
      actionLabel: "Review delivery",
      waitingTitle: "Waiting for the buyer to review the final delivery",
      waitingDescription: "The project completes once they approve it.",
      sectionId: "delivery",
    });
  }

  if (hasStatus(input.finalDeliveries, "draft")) {
    return step({
      key: "submit-delivery-draft",
      owner: "creator",
      tone: "action",
      actionTitle: "Submit your final delivery",
      actionDescription: "Your final delivery draft is ready to send to the buyer.",
      actionLabel: "Review draft",
      waitingTitle: "The creator is preparing the final delivery",
      waitingDescription: "You'll be asked to review it when it's ready.",
      sectionId: "delivery",
    });
  }

  if (hasSchedulePaymentDue(agreement, "due_before_final_release")) {
    return step({
      key: "pay-final-balance",
      owner: "buyer",
      tone: "action",
      actionTitle: "Pay the final balance",
      actionDescription: "The final files are released once the balance is paid.",
      actionLabel: "Go to payments",
      waitingTitle: "Waiting for the buyer's final balance",
      waitingDescription: "Final release is unlocked once it's paid.",
      sectionId: "payments",
    });
  }

  if (agreement.payment_structure === "milestone_payments") {
    const milestones = getOrderedListingRequestMilestones(input.milestones ?? []);
    const active = getActiveListingRequestMilestone(milestones);

    if (active) {
      const label = `milestone ${active.sort_order + 1}: ${active.title}`;

      if (active.status === "submitted") {
        return step({
          key: "review-milestone",
          owner: "buyer",
          tone: "action",
          actionTitle: `Review ${label}`,
          actionDescription: "Approve the work to release this milestone's payment, or ask for revisions.",
          actionLabel: "Review milestone",
          waitingTitle: `Waiting for the buyer to review ${label}`,
          waitingDescription: "The next milestone unlocks after approval and payment.",
          sectionId: "milestones",
        });
      }

      if (active.status === "buyer_approved" || active.status === "payment_required") {
        return step({
          key: "pay-milestone",
          owner: "buyer",
          tone: "action",
          actionTitle: `Pay for ${label}`,
          actionDescription: "You approved this milestone. The next one unlocks once it's paid.",
          actionLabel: "Go to payments",
          waitingTitle: `Waiting for payment on ${label}`,
          waitingDescription: "The next milestone unlocks once it's confirmed.",
          sectionId: "payments",
        });
      }

      return step({
        key: "submit-milestone",
        owner: "creator",
        tone: "action",
        actionTitle:
          active.status === "revision_requested" ? `Revise ${label}` : `Submit ${label}`,
        actionDescription:
          active.status === "revision_requested"
            ? "The buyer asked for changes. Update the work and resubmit."
            : "Share the work and delivery links for the buyer to review.",
        actionLabel: "Open milestones",
        waitingTitle: `The creator is working on ${label}`,
        waitingDescription: "You'll be asked to review it once it's submitted.",
        sectionId: "milestones",
      });
    }
  }

  if (latestDelivery?.status === "revision_requested") {
    return step({
      key: "revise-delivery",
      owner: "creator",
      tone: "action",
      actionTitle: "Revise the final delivery",
      actionDescription: "The buyer asked for revisions. Prepare an updated delivery.",
      actionLabel: "Open delivery",
      waitingTitle: "The creator is revising the final delivery",
      waitingDescription: "You'll be asked to review the updated version.",
      sectionId: "delivery",
    });
  }

  return step({
    key: "work-in-progress",
    owner: "creator",
    tone: "action",
    actionTitle: "Work on the project and submit the final delivery",
    actionDescription: "Post progress updates as you go so the buyer stays in the loop.",
    actionLabel: "Open delivery",
    waitingTitle: "The creator is working on your project",
    waitingDescription: "You'll be asked to review anything that needs your input.",
    sectionId: "delivery",
  });
};
