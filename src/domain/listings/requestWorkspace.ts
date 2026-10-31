import { english, type Translate } from "../../lib/i18n/i18n";
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

export const getRequestStages = (
  input: RequestWorkspaceInput,
  t: Translate = english
): RequestStage[] => {
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
      label: t(requestStatus === "submitted" ? "stage.inReview" : "stage.accepted"),
      state: stateFor(requestStatus !== "submitted", requestStatus === "submitted"),
    },
    {
      key: "agreement",
      label: t("stage.agreement"),
      state: stateFor(accepted, requestStatus === "accepted" && !accepted),
    },
  ];

  if (needsStartingPayment) {
    stages.push({
      key: "payment",
      label: t(agreement?.payment_structure === "deposit_balance" ? "stage.deposit" : "stage.payment"),
      state: stateFor(
        accepted && isStartingPaymentResolved(input),
        accepted && !isStartingPaymentResolved(input)
      ),
    });
  }

  const workLabel =
    agreement?.payment_structure === "milestone_payments" && milestoneProgress.total > 0
      ? t("stage.milestones", { done: milestoneProgress.done, total: milestoneProgress.total })
      : t("stage.inProgress");

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
      label: t("stage.delivery"),
      state: stateFor(false, accepted && deliveryInReview),
    },
    {
      key: "complete",
      label: t("stage.complete"),
      state: stateFor(false, false),
    }
  );

  return stages;
};

const step = (value: RequestNextStep): RequestNextStep => value;

export const getRequestNextStep = (
  input: RequestWorkspaceInput,
  t: Translate = english,
  language?: string
): RequestNextStep => {
  const { requestStatus, agreement } = input;

  if (requestStatus === "declined") {
    return step({
      key: "declined",
      owner: null,
      tone: "closed",
      actionTitle: t("nextStep.declined.actionTitle"),
      actionDescription: t("nextStep.declined.actionDescription"),
      waitingTitle: t("nextStep.declined.actionTitle"),
      waitingDescription: t("nextStep.declined.actionDescription"),
    });
  }

  if (requestStatus === "archived") {
    return step({
      key: "archived",
      owner: null,
      tone: "closed",
      actionTitle: t("nextStep.archived.actionTitle"),
      actionDescription: t("nextStep.archived.actionDescription"),
      waitingTitle: t("nextStep.archived.actionTitle"),
      waitingDescription: t("nextStep.archived.actionDescription"),
    });
  }

  if (requestStatus === "cancelled") {
    return step({
      key: "cancelled",
      owner: null,
      tone: "closed",
      actionTitle: t("nextStep.cancelled.actionTitle"),
      actionDescription: t("nextStep.cancelled.actionDescription"),
      waitingTitle: t("nextStep.cancelled.actionTitle"),
      waitingDescription: t("nextStep.cancelled.actionDescription"),
    });
  }

  if (input.cancellationProposal) {
    const { cancellationProposal } = input;

    if (cancellationProposal.status === "disputed") {
      return step({
        key: "cancellation-disputed",
        owner: null,
        tone: "closed",
        actionTitle: t("nextStep.cancellationDisputed.actionTitle"),
        actionDescription: t("nextStep.cancellationDisputed.actionDescription"),
        waitingTitle: t("nextStep.cancellationDisputed.actionTitle"),
        waitingDescription: t("nextStep.cancellationDisputed.actionDescription"),
        sectionId: "request",
      });
    }

    if (cancellationProposal.status === "pending_creator_statement") {
      return step({
        key: "submit-cancellation-statement",
        owner: "creator",
        tone: "action",
        actionTitle: t("nextStep.submitCancellationStatement.actionTitle"),
        actionDescription: t("nextStep.submitCancellationStatement.actionDescription"),
        actionLabel: t("nextStep.submitCancellationStatement.actionLabel"),
        waitingTitle: t("nextStep.submitCancellationStatement.waitingTitle"),
        waitingDescription: cancellationProposal.statement_due_at
          ? t("nextStep.submitCancellationStatement.waitingUntil", {
              date: new Date(cancellationProposal.statement_due_at).toLocaleString(language, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })
          : t("nextStep.submitCancellationStatement.waitingDays"),
        sectionId: "request",
      });
    }

    if (cancellationProposal.status === "pending_buyer_response") {
      return step({
        key: "respond-cancellation-statement",
        owner: "buyer",
        tone: "action",
        actionTitle: t("nextStep.respondCancellationStatement.actionTitle"),
        actionDescription: t("nextStep.respondCancellationStatement.actionDescription"),
        actionLabel: t("nextStep.respondCancellationStatement.actionLabel"),
        waitingTitle: t("nextStep.respondCancellationStatement.waitingTitle"),
        waitingDescription: t("nextStep.respondCancellationStatement.waitingDescription"),
        sectionId: "request",
      });
    }
  }

  if (requestStatus === "completed") {
    return step({
      key: "completed",
      owner: null,
      tone: "done",
      actionTitle: t("nextStep.completed.actionTitle"),
      actionDescription: t("nextStep.completed.actionDescription"),
      waitingTitle: t("nextStep.completed.actionTitle"),
      waitingDescription: t("nextStep.completed.actionDescription"),
      sectionId: "delivery",
    });
  }

  if (requestStatus === "submitted") {
    return step({
      key: "review-request",
      owner: "creator",
      tone: "action",
      actionTitle: t("nextStep.reviewRequest.actionTitle"),
      actionDescription: t("nextStep.reviewRequest.actionDescription"),
      actionLabel: t("nextStep.reviewRequest.actionLabel"),
      waitingTitle: t("nextStep.reviewRequest.waitingTitle"),
      waitingDescription: t("nextStep.reviewRequest.waitingDescription"),
      sectionId: "request",
    });
  }

  if (!agreement || agreement.status === "superseded" || agreement.status === "cancelled") {
    return step({
      key: "create-agreement",
      owner: "creator",
      tone: "action",
      actionTitle: t("nextStep.createAgreement.actionTitle"),
      actionDescription: t("nextStep.createAgreement.actionDescription"),
      actionLabel: t("nextStep.createAgreement.actionLabel"),
      waitingTitle: t("nextStep.createAgreement.waitingTitle"),
      waitingDescription: t("nextStep.createAgreement.waitingDescription"),
      sectionId: "agreement",
    });
  }

  if (agreement.status === "draft") {
    return step({
      key: "send-agreement",
      owner: "creator",
      tone: "action",
      actionTitle: t("nextStep.sendAgreement.actionTitle"),
      actionDescription: t("nextStep.sendAgreement.actionDescription"),
      actionLabel: t("nextStep.sendAgreement.actionLabel"),
      waitingTitle: t("nextStep.createAgreement.waitingTitle"),
      waitingDescription: t("nextStep.createAgreement.waitingDescription"),
      sectionId: "agreement",
    });
  }

  if (agreement.status === "sent") {
    return step({
      key: "accept-agreement",
      owner: "buyer",
      tone: "action",
      actionTitle: t("nextStep.acceptAgreement.actionTitle"),
      actionDescription: t("nextStep.acceptAgreement.actionDescription"),
      actionLabel: t("nextStep.acceptAgreement.actionLabel"),
      waitingTitle: t("nextStep.acceptAgreement.waitingTitle"),
      waitingDescription: t("nextStep.acceptAgreement.waitingDescription"),
      sectionId: "agreement",
    });
  }

  if (agreement.status === "buyer_declined") {
    return step({
      key: "revise-agreement",
      owner: "creator",
      tone: "action",
      actionTitle: t("nextStep.reviseAgreement.actionTitle"),
      actionDescription: t("nextStep.reviseAgreement.actionDescription"),
      actionLabel: t("nextStep.reviseAgreement.actionLabel"),
      waitingTitle: t("nextStep.reviseAgreement.waitingTitle"),
      waitingDescription: t("nextStep.reviseAgreement.waitingDescription"),
      sectionId: "agreement",
    });
  }

  if (agreement.starting_payment_status === "payment_required") {
    const isDeposit = agreement.payment_structure === "deposit_balance";

    return step({
      key: "pay-starting",
      owner: "buyer",
      tone: "action",
      actionTitle: t(isDeposit ? "nextStep.payStarting.actionTitleDeposit" : "nextStep.payStarting.actionTitle"),
      actionDescription: t("nextStep.payStarting.actionDescription"),
      actionLabel: t("nextStep.payStarting.actionLabel"),
      waitingTitle: t(isDeposit ? "nextStep.payStarting.waitingTitleDeposit" : "nextStep.payStarting.waitingTitle"),
      waitingDescription: t("nextStep.payStarting.waitingDescription"),
      sectionId: "payments",
    });
  }

  if (hasStatus(input.changeOrders, "sent")) {
    return step({
      key: "respond-change-order",
      owner: "buyer",
      tone: "action",
      actionTitle: t("nextStep.respondChangeOrder.actionTitle"),
      actionDescription: t("nextStep.respondChangeOrder.actionDescription"),
      actionLabel: t("nextStep.respondChangeOrder.actionLabel"),
      waitingTitle: t("nextStep.respondChangeOrder.waitingTitle"),
      waitingDescription: t("nextStep.respondChangeOrder.waitingDescription"),
      sectionId: "changeOrders",
    });
  }

  if (hasStatus(input.changeOrders, "draft")) {
    return step({
      key: "send-change-order",
      owner: "creator",
      tone: "action",
      actionTitle: t("nextStep.sendChangeOrder.actionTitle"),
      actionDescription: t("nextStep.sendChangeOrder.actionDescription"),
      actionLabel: t("nextStep.sendAgreement.actionLabel"),
      waitingTitle: t("nextStep.sendChangeOrder.waitingTitle"),
      waitingDescription: t("nextStep.sendChangeOrder.waitingDescription"),
      sectionId: "changeOrders",
    });
  }

  if (hasSchedulePaymentDue(agreement, "due_on_change_order_acceptance")) {
    return step({
      key: "pay-change-order",
      owner: "buyer",
      tone: "action",
      actionTitle: t("nextStep.payChangeOrder.actionTitle"),
      actionDescription: t("nextStep.payChangeOrder.actionDescription"),
      actionLabel: t("nextStep.payStarting.actionLabel"),
      waitingTitle: t("nextStep.payChangeOrder.waitingTitle"),
      waitingDescription: t("nextStep.payChangeOrder.waitingDescription"),
      sectionId: "payments",
    });
  }

  const latestDelivery = latestByOrder(input.finalDeliveries ?? []);

  if (latestDelivery?.status === "submitted") {
    return step({
      key: "review-delivery",
      owner: "buyer",
      tone: "action",
      actionTitle: t("nextStep.reviewDelivery.actionTitle"),
      actionDescription: t("nextStep.reviewDelivery.actionDescription"),
      actionLabel: t("nextStep.reviewDelivery.actionLabel"),
      waitingTitle: t("nextStep.reviewDelivery.waitingTitle"),
      waitingDescription: t("nextStep.reviewDelivery.waitingDescription"),
      sectionId: "delivery",
    });
  }

  if (hasStatus(input.finalDeliveries, "draft")) {
    return step({
      key: "submit-delivery-draft",
      owner: "creator",
      tone: "action",
      actionTitle: t("nextStep.submitDeliveryDraft.actionTitle"),
      actionDescription: t("nextStep.submitDeliveryDraft.actionDescription"),
      actionLabel: t("nextStep.sendAgreement.actionLabel"),
      waitingTitle: t("nextStep.submitDeliveryDraft.waitingTitle"),
      waitingDescription: t("nextStep.submitDeliveryDraft.waitingDescription"),
      sectionId: "delivery",
    });
  }

  if (hasSchedulePaymentDue(agreement, "due_before_final_release")) {
    return step({
      key: "pay-final-balance",
      owner: "buyer",
      tone: "action",
      actionTitle: t("nextStep.payFinalBalance.actionTitle"),
      actionDescription: t("nextStep.payFinalBalance.actionDescription"),
      actionLabel: t("nextStep.payStarting.actionLabel"),
      waitingTitle: t("nextStep.payFinalBalance.waitingTitle"),
      waitingDescription: t("nextStep.payFinalBalance.waitingDescription"),
      sectionId: "payments",
    });
  }

  if (agreement.payment_structure === "milestone_payments") {
    const milestones = getOrderedListingRequestMilestones(input.milestones ?? []);
    const active = getActiveListingRequestMilestone(milestones);

    if (active) {
      const label = t("nextStep.milestoneLabel", {
        number: active.sort_order + 1,
        title: active.title,
      });

      if (active.status === "submitted") {
        return step({
          key: "review-milestone",
          owner: "buyer",
          tone: "action",
          actionTitle: t("nextStep.reviewMilestone.actionTitle", { label }),
          actionDescription: t("nextStep.reviewMilestone.actionDescription"),
          actionLabel: t("nextStep.reviewMilestone.actionLabel"),
          waitingTitle: t("nextStep.reviewMilestone.waitingTitle", { label }),
          waitingDescription: t("nextStep.reviewMilestone.waitingDescription"),
          sectionId: "milestones",
        });
      }

      if (active.status === "buyer_approved" || active.status === "payment_required") {
        return step({
          key: "pay-milestone",
          owner: "buyer",
          tone: "action",
          actionTitle: t("nextStep.payMilestone.actionTitle", { label }),
          actionDescription: t("nextStep.payMilestone.actionDescription"),
          actionLabel: t("nextStep.payStarting.actionLabel"),
          waitingTitle: t("nextStep.payMilestone.waitingTitle", { label }),
          waitingDescription: t("nextStep.payMilestone.waitingDescription"),
          sectionId: "payments",
        });
      }

      return step({
        key: "submit-milestone",
        owner: "creator",
        tone: "action",
        actionTitle: t(
          active.status === "revision_requested"
            ? "nextStep.submitMilestone.actionTitleRevise"
            : "nextStep.submitMilestone.actionTitle",
          { label }
        ),
        actionDescription: t(
          active.status === "revision_requested"
            ? "nextStep.submitMilestone.actionDescriptionRevise"
            : "nextStep.submitMilestone.actionDescription"
        ),
        actionLabel: t("nextStep.submitMilestone.actionLabel"),
        waitingTitle: t("nextStep.submitMilestone.waitingTitle", { label }),
        waitingDescription: t("nextStep.submitMilestone.waitingDescription"),
        sectionId: "milestones",
      });
    }
  }

  if (latestDelivery?.status === "revision_requested") {
    return step({
      key: "revise-delivery",
      owner: "creator",
      tone: "action",
      actionTitle: t("nextStep.reviseDelivery.actionTitle"),
      actionDescription: t("nextStep.reviseDelivery.actionDescription"),
      actionLabel: t("nextStep.reviseDelivery.actionLabel"),
      waitingTitle: t("nextStep.reviseDelivery.waitingTitle"),
      waitingDescription: t("nextStep.reviseDelivery.waitingDescription"),
      sectionId: "delivery",
    });
  }

  return step({
    key: "work-in-progress",
    owner: "creator",
    tone: "action",
    actionTitle: t("nextStep.workInProgress.actionTitle"),
    actionDescription: t("nextStep.workInProgress.actionDescription"),
    actionLabel: t("nextStep.reviseDelivery.actionLabel"),
    waitingTitle: t("nextStep.sendChangeOrder.waitingTitle"),
    waitingDescription: t("nextStep.sendChangeOrder.waitingDescription"),
    sectionId: "delivery",
  });
};
