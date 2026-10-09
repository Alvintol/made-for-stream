import { Collapse } from "../../lib/motion";
import { useCreatorPaymentAccount } from "../../hooks/payments/useCreatorPaymentAccount";
import { Link, useParams } from "react-router-dom";
import { useCreatorRequest } from "../../hooks/creatorRequests/useCreatorRequest";
import { useUpdateCreatorListingRequestStatus } from "../../hooks/creatorRequests/useUpdateCreatorListingRequestStatus";
import {
  canAcceptListingRequest,
  canArchiveListingRequest,
  canCancelListingRequestBeforePayment,
  canDeclineListingRequest,
  getListingRequestStatusLabel,
  getListingRequestStatusTone,
} from "../../domain/listings/listingRequests";
import { getRequestNextStep, getRequestStages } from "../../domain/listings/requestWorkspace";
import ExpandingFormPanel from "../../components/listingRequests/workspace/ExpandingFormPanel";
import ListingSnapshotDetails from "../../components/listingRequests/workspace/ListingSnapshotDetails";
import ActionMenu from "../../components/ui/ActionMenu";
import RequestNextStepCard from "../../components/listingRequests/workspace/RequestNextStepCard";
import RequestStatusNotice from "../../components/listingRequests/workspace/RequestStatusNotice";
import RequestWorkspace from "../../components/listingRequests/workspace/RequestWorkspace";
import StatusHeader from "../../components/ui/StatusHeader";
import WorkspaceSectionList from "../../components/listingRequests/workspace/WorkspaceSectionList";
import {
  getSectionFlags,
  summarizeAgreement,
  summarizeChangeOrders,
  summarizeDeliveries,
  summarizeMilestones,
  summarizeProgress,
  summarizeSchedule,
  workspaceDate,
  type WorkspaceSectionSpec,
} from "../../components/listingRequests/workspace/sectionSummaries";
import { useEffect, useState } from 'react';
import { getAgreementPersonName } from '../../domain/listings/listingRequestAgreements';
import ListingRequestAgreementBuilder from '../../components/listingRequests/agreements/ListingRequestAgreementBuilder';
import ListingRequestAgreementCreatorActions from '../../components/listingRequests/agreements/ListingRequestAgreementCreatorActions';
import ListingRequestAgreementSummary from '../../components/listingRequests/agreements/ListingRequestAgreementSummary';
import ListingRequestAgreementWorkReadinessCard from '../../components/listingRequests/agreements/ListingRequestAgreementWorkReadinessCard';
import ListingRequestChangeOrderBuilder from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderBuilder';
import ListingRequestChangeOrderCreatorActions from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderCreatorActions';
import ListingRequestChangeOrderSummary from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderSummary';
import RequestConversationThread from '../../components/listingRequests/conversations/RequestConversationThread';
import ListingRequestSubmissionDetails from '../../components/listingRequests/core/ListingRequestSubmissionDetails';
import ListingRequestFinalDeliveryBuilder from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliveryBuilder';
import ListingRequestFinalDeliveryCreatorActions from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliveryCreatorActions';
import ListingRequestFinalDeliverySummary from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliverySummary';
import ListingRequestProgressUpdateForm from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateForm';
import ListingRequestProgressUpdateScheduleCard from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateScheduleCard';
import ListingRequestProgressUpdateTimeline from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateTimeline';
import {
  canCreateNextListingRequestFinalDelivery,
  getDraftListingRequestFinalDelivery,
  getListingRequestFinalDeliveryCreationBlockedReason,
} from '../../domain/listings/listingRequestFinalDeliveries';
import { useCreateListingRequestAgreement } from '../../hooks/creatorRequests/useCreateListingRequestAgreement';
import { useCreateListingRequestChangeOrder } from '../../hooks/creatorRequests/useCreateListingRequestChangeOrder';
import { useCreateListingRequestFinalDelivery } from '../../hooks/creatorRequests/useCreateListingRequestFinalDelivery';
import { useCreateListingRequestProgressUpdate } from '../../hooks/creatorRequests/useCreateListingRequestProgressUpdate';
import { useListingRequestAgreement } from '../../hooks/creatorRequests/useListingRequestAgreement';
import { useListingRequestChangeOrders } from '../../hooks/creatorRequests/useListingRequestChangeOrders';
import { useListingRequestFinalDeliveries } from '../../hooks/creatorRequests/useListingRequestFinalDeliveries';
import { useListingRequestProgressUpdates } from '../../hooks/creatorRequests/useListingRequestProgressUpdates';
import { useSendDraftListingRequestAgreement } from '../../hooks/creatorRequests/useSendDraftListingRequestAgreement';
import { useSendDraftListingRequestChangeOrder } from '../../hooks/creatorRequests/useSendDraftListingRequestChangeOrder';
import { useSendDraftListingRequestFinalDelivery } from '../../hooks/creatorRequests/useSendDraftListingRequestFinalDelivery';
import { useSubmitListingRequestMilestone } from '../../hooks/creatorRequests/useSubmitListingRequestMilestone';
import { useListingRequestMilestoneSubmissions } from '../../hooks/creatorRequests/useListingRequestMilestoneSubmissions';
import { useListingRequestMilestones } from '../../hooks/creatorRequests/useListingRequestMilestones';
import ListingRequestMilestoneSubmissionForm from '../../components/listingRequests/milestones/ListingRequestMilestoneSubmissionForm';
import ListingRequestMilestoneSummary from '../../components/listingRequests/milestones/ListingRequestMilestoneSummary';
import { canSubmitListingRequestMilestone, getActiveListingRequestMilestone } from '../../domain/listings/listingRequestMilestones';
import { canStartWorkForAcceptedRequest } from '../../domain/listings/listingRequestAgreements';
import { canCreateListingRequestChangeOrder, getDraftListingRequestChangeOrder } from '../../domain/listings/listingRequestChangeOrders';
import { useListingRequestPayments } from '../../hooks/payments/useListingRequestPayments';
import { useCancelListingRequestBeforePayment } from '../../hooks/creatorRequests/useCancelListingRequestBeforePayment';
import { useListingRequestCancellationProposal } from '../../hooks/creatorRequests/useListingRequestCancellationProposal';
import { useProposeListingRequestCancellation } from '../../hooks/creatorRequests/useProposeListingRequestCancellation';
import { useRespondListingRequestCancellationProposal } from '../../hooks/creatorRequests/useRespondListingRequestCancellationProposal';
import { useSubmitListingRequestCancellationStatement } from '../../hooks/creatorRequests/useSubmitListingRequestCancellationStatement';
import ListingRequestCancelBeforePaymentAction from '../../components/listingRequests/core/ListingRequestCancelBeforePaymentAction';
import ListingRequestCancellationProposalPanel from '../../components/listingRequests/core/ListingRequestCancellationProposalPanel';
import NoticeAndClosurePanel from '../../components/listingRequests/core/NoticeAndClosurePanel';
import CancellationWarningPanel from '../../components/listingRequests/core/CancellationWarningPanel';

const classes = {
  page: "space-y-6",
  backLink: "backLink",
  h1: "pageTitle",
  sub: "pageSub",
  card: "card p-6",
  text: "text-sm text-zinc-600",
  respond: "space-y-3 border-t border-[var(--hairline)] pt-4",
  row: "flex flex-wrap items-center gap-3",
  btnOutline: "btnOutline btnSm",
  btnPrimary: "btnPrimary",
  btnDanger: "btnDangerOutline",
  submitError: "notice noticeError",
  loadingText: "text-sm text-zinc-600",
  errorCard: "notice noticeError",
  field: "space-y-2 pt-1",
  label: "formLabel",
  hint: "formHint",
  error: "formError",
  textarea: "formControl min-h-[140px]",
  infoCard: "notice noticeInfo",
} as const;

// Prefers handle for buyer display, then display name, then user id
const buyerText = (
  buyer: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) =>
  buyer?.handle ? `@${buyer.handle}` : buyer?.display_name ?? fallbackUserId;

const getCreatorMilestoneWaitMessage = (
  milestone: {
    status: string;
    sort_order: number;
    title: string;
  } | null
): string | null => {
  if (!milestone) {
    return null;
  }

  const milestoneLabel = `Milestone ${milestone.sort_order + 1
    }: ${milestone.title}`;

  if (milestone.status === "submitted") {
    return `${milestoneLabel} is waiting for buyer review. The next milestone will unlock after the buyer approves this one and payment is confirmed.`;
  }

  if (
    milestone.status === "buyer_approved" ||
    milestone.status === "payment_required"
  ) {
    return `${milestoneLabel} has been approved by the buyer and is waiting for admin payment confirmation. The next milestone will unlock after payment is confirmed.`;
  }

  return null;
};

const CreatorRequestDetails = () => {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useCreatorRequest(id ?? null);
  const updateStatusMutation = useUpdateCreatorListingRequestStatus();

  const request = data?.request ?? null;
  const buyer = data?.buyer ?? null;

  const agreementQuery = useListingRequestAgreement(request?.id ?? null);

  // An agreement is priced in the creator's payout currency; the database
  // refuses any other (AGR-008).
  const { data: paymentAccount } = useCreatorPaymentAccount();
  const payoutCurrency = paymentAccount?.default_currency ?? "cad";
  const createAgreementMutation = useCreateListingRequestAgreement();
  const sendDraftAgreementMutation = useSendDraftListingRequestAgreement();
  const createProgressUpdateMutation =
    useCreateListingRequestProgressUpdate();
  const sendDraftChangeOrderMutation =
    useSendDraftListingRequestChangeOrder();
  const createChangeOrderMutation =
    useCreateListingRequestChangeOrder();
  const createFinalDeliveryMutation =
    useCreateListingRequestFinalDelivery();
  const sendDraftFinalDeliveryMutation =
    useSendDraftListingRequestFinalDelivery();
  const submitMilestoneMutation =
    useSubmitListingRequestMilestone();


  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineReasonError, setDeclineReasonError] = useState<string | null>(null);

  useEffect(() => {
    if (!request?.creator_status_reason) return;
    setDeclineReason(request.creator_status_reason);
  }, [request?.creator_status_reason]);

  const trimmedDeclineReason = declineReason.trim();

  const canConfirmDecline =
    trimmedDeclineReason.length >= 10 &&
    trimmedDeclineReason.length <= 1000 &&
    !updateStatusMutation.isPending;

  const agreement = agreementQuery.data ?? null;

  const progressUpdatesQuery = useListingRequestProgressUpdates(
    agreement?.status === "buyer_accepted"
      ? request?.id ?? null
      : null
  );

  const changeOrdersQuery = useListingRequestChangeOrders(
    agreement?.status === "buyer_accepted"
      ? request?.id ?? null
      : null
  );

  const finalDeliveriesQuery =
    useListingRequestFinalDeliveries(
      agreement?.status === "buyer_accepted"
        ? request?.id ?? null
        : null
    );

  const milestoneRequestId =
    agreement?.status === "buyer_accepted" &&
      agreement.payment_structure === "milestone_payments"
      ? request?.id ?? null
      : null;

  const milestonesQuery =
    useListingRequestMilestones(milestoneRequestId);

  const milestoneSubmissionsQuery =
    useListingRequestMilestoneSubmissions(
      milestoneRequestId
    );

  const paymentsQuery = useListingRequestPayments(
    agreement?.status === "buyer_accepted" ? request?.id ?? null : null
  );
  const paidPayments = (paymentsQuery.data ?? []).filter(
    (payment) => payment.status === "paid"
  );

  const cancellationProposalQuery = useListingRequestCancellationProposal(
    request?.status === "accepted" ? request?.id ?? null : null
  );
  const cancelBeforePaymentMutation = useCancelListingRequestBeforePayment();
  const proposeCancellationMutation = useProposeListingRequestCancellation();
  const submitCancellationStatementMutation =
    useSubmitListingRequestCancellationStatement();
  const respondCancellationProposalMutation =
    useRespondListingRequestCancellationProposal();

  const cancellationProposal = cancellationProposalQuery.data ?? null;
  const isCancellationProposalOpen =
    cancellationProposal?.status === "pending_creator_statement" ||
    cancellationProposal?.status === "pending_buyer_response";

  const handleCancelBeforePayment = async (reason: string) => {
    if (!request) {
      return;
    }

    await cancelBeforePaymentMutation.mutateAsync({
      requestId: request.id,
      reason,
    });
  };

  const handleProposeCancellation = async (
    reason: string,
    items?: Parameters<
      typeof proposeCancellationMutation.mutateAsync
    >[0]["items"]
  ) => {
    if (!request) {
      return;
    }

    await proposeCancellationMutation.mutateAsync({
      requestId: request.id,
      reason,
      items,
    });
  };

  const handleSubmitCancellationStatement = async (
    items: Parameters<
      typeof submitCancellationStatementMutation.mutateAsync
    >[0]["items"]
  ) => {
    if (!cancellationProposal) {
      return;
    }

    await submitCancellationStatementMutation.mutateAsync({
      proposalId: cancellationProposal.id,
      items,
    });
  };

  const handleAcceptCancellationProposal = async () => {
    if (!cancellationProposal || !request) {
      return;
    }

    await respondCancellationProposalMutation.mutateAsync({
      proposalId: cancellationProposal.id,
      requestId: request.id,
      response: "accepted",
    });
  };

  const handleDisputeCancellationProposal = async (disputeReason: string) => {
    if (!cancellationProposal || !request) {
      return;
    }

    await respondCancellationProposalMutation.mutateAsync({
      proposalId: cancellationProposal.id,
      requestId: request.id,
      response: "disputed",
      disputeReason,
    });
  };

  const handleAcceptRequest = async () => {
    if (!request) return;

    setShowDeclineForm(false);
    setDeclineReasonError(null);

    try {
      await updateStatusMutation.mutateAsync({
        requestId: request.id,
        status: "accepted",
        reason: null,
      });
    } catch {
      // Error is surfaced below
    }
  };

  const handleDeclineRequest = async () => {
    if (!request) return;

    if (trimmedDeclineReason.length < 10 || trimmedDeclineReason.length > 1000) {
      setDeclineReasonError(
        "Decline reason must be between 10 and 1000 characters."
      );
      return;
    }

    setDeclineReasonError(null);

    try {
      await updateStatusMutation.mutateAsync({
        requestId: request.id,
        status: "declined",
        reason: trimmedDeclineReason,
      });

      setShowDeclineForm(false);
    } catch {
      // Error is surfaced below
    }
  };

  const handleArchiveRequest = async () => {
    if (!request) return;

    setShowDeclineForm(false);
    setDeclineReasonError(null);

    try {
      await updateStatusMutation.mutateAsync({
        requestId: request.id,
        status: "archived",
        reason: null,
      });
    } catch {
      // Error is surfaced below
    }
  };

  if (isLoading) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  if (error || !request) {
    return (
      <div className={classes.page}>
        <Link to="/creator/requests" className={classes.backLink}>
          ← Back to creator commissions
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Commission not found</h1>
          <p className={classes.sub}>
            This commission could not be loaded from your creator account.
          </p>
        </div>
      </div>
    );
  }

  const snapshot = request.listing_snapshot;


  const backTo =
    request.status === "archived" || request.status === "cancelled"
      ? "/creator/requests/archived"
      : request.status === "completed"
        ? "/creator/requests/completed"
        : "/creator/requests";

  const changeOrders = changeOrdersQuery.data ?? [];

  const canCreateChangeOrder =
    canCreateListingRequestChangeOrder(
      request.status,
      agreement,
      changeOrders
    ) &&
    !changeOrdersQuery.isLoading &&
    !changeOrdersQuery.error;

  const draftChangeOrder =
    getDraftListingRequestChangeOrder(changeOrders);

  const finalDeliveries =
    finalDeliveriesQuery.data ?? [];

  const draftFinalDelivery =
    getDraftListingRequestFinalDelivery(
      finalDeliveries
    );

  const startingPaymentResolved =
    agreement?.starting_payment_status === "paid" ||
    agreement?.starting_payment_status ===
    "not_required";

  const canCreateFinalDelivery =
    request.status === "accepted" &&
    agreement?.status === "buyer_accepted" &&
    startingPaymentResolved &&
    canCreateNextListingRequestFinalDelivery(
      agreement,
      finalDeliveries
    ) &&
    !finalDeliveriesQuery.isLoading &&
    !finalDeliveriesQuery.error;

  const finalDeliveryCreationBlockedReason =
    request.status === "accepted" &&
      agreement?.status === "buyer_accepted" &&
      !canCreateFinalDelivery &&
      !finalDeliveriesQuery.isLoading &&
      !finalDeliveriesQuery.error
      ? getListingRequestFinalDeliveryCreationBlockedReason(
        agreement,
        finalDeliveries
      )
      : null;

  const requestReadOnly =
    request.status === "archived" ||
    request.status === "declined" ||
    request.status === "completed" ||
    request.status === "cancelled";

  const milestones = milestonesQuery.data ?? [];

  const milestoneSubmissions =
    milestoneSubmissionsQuery.data ?? [];

  const activeMilestone =
    getActiveListingRequestMilestone(milestones);

  const canSubmitActiveMilestone =
    activeMilestone
      ? canSubmitListingRequestMilestone(
        activeMilestone.status
      )
      : false;

  const activeMilestoneWaitMessage =
    getCreatorMilestoneWaitMessage(activeMilestone);

  const milestonesAreLoading =
    milestonesQuery.isLoading ||
    milestoneSubmissionsQuery.isLoading;

  const milestoneError =
    milestonesQuery.error ??
    milestoneSubmissionsQuery.error;

  const requestReadOnlyMessage =
    request.status === "archived"
      ? "Archived commissions are read-only."
      : request.status === "declined"
        ? "Declined commission requests are read-only because the conversation has been ended."
        : request.status === "completed"
          ? "Completed projects are read-only because the buyer approved the final delivery."
          : request.status === "cancelled"
            ? "Cancelled commissions are read-only."
            : undefined;

  const buyerLabel = buyerText(buyer, request.buyer_user_id);
  const agreementAccepted = agreement?.status === "buyer_accepted";
  const usesMilestones =
    agreementAccepted && agreement?.payment_structure === "milestone_payments";
  const progressUpdates = progressUpdatesQuery.data ?? [];

  const workspaceInput = {
    requestStatus: request.status,
    agreement,
    milestones,
    changeOrders,
    finalDeliveries,
    cancellationProposal: isCancellationProposalOpen
      ? {
          status: cancellationProposal!.status,
          statement_due_at: cancellationProposal!.statement_due_at,
        }
      : null,
  };

  const nextStep = getRequestNextStep(workspaceInput);
  const workspaceLoading =
    agreementQuery.isLoading ||
    milestonesAreLoading ||
    changeOrdersQuery.isLoading ||
    finalDeliveriesQuery.isLoading;
  const flags = getSectionFlags(nextStep, "creator", {
    readOnly: requestReadOnly,
    isLoading: workspaceLoading,
  });

  const canPostProgressUpdate = agreement
    ? canStartWorkForAcceptedRequest({
      requestStatus: request.status,
      agreementStatus: agreement.status,
      startingPaymentStatus: agreement.starting_payment_status,
    })
    : false;

  // Closes the form sheet only once the save succeeds, so validation errors stay visible.
  const thenClose = <Input,>(save: (input: Input) => Promise<unknown>, close: () => void) =>
    async (input: Input) => {
      await save(input);
      close();
    };

  const canRespondToRequest =
    canAcceptListingRequest(request.status) || canDeclineListingRequest(request.status);

  const sections: WorkspaceSectionSpec[] = [
    {
      id: "request",
      title: "Commission request",
      summary: canRespondToRequest ? "Accept or decline" : "Brief, timeline, budget and references",
      ...flags("request"),
      defaultOpen: request.status === "submitted" || isCancellationProposalOpen,
      content: (
        <>
          {request.status === "accepted" && paidPayments.length > 0 && (
            <ListingRequestCancellationProposalPanel
              viewer="creator"
              paidPayments={paidPayments}
              proposal={cancellationProposal}
              isProposePending={proposeCancellationMutation.isPending}
              proposeError={proposeCancellationMutation.error}
              onPropose={handleProposeCancellation}
              isSubmitStatementPending={submitCancellationStatementMutation.isPending}
              submitStatementError={submitCancellationStatementMutation.error}
              onSubmitStatement={handleSubmitCancellationStatement}
              isRespondPending={respondCancellationProposalMutation.isPending}
              respondError={respondCancellationProposalMutation.error}
              onAccept={handleAcceptCancellationProposal}
              onDispute={handleDisputeCancellationProposal}
            />
          )}

          {request.status === "accepted" && (
            <NoticeAndClosurePanel
              requestId={request.id}
              currentUserId={request.creator_user_id}
            />
          )}

          {request.status === "accepted" && (
            <CancellationWarningPanel
              requestId={request.id}
              currentUserId={request.creator_user_id}
              currentUserRole="creator"
            />
          )}

          <ListingRequestSubmissionDetails
            requestTitle={request.request_title}
            requestDetails={request.request_details}
            fallbackMessage={request.message}
            requestedTimeline={request.requested_timeline}
            budgetAmount={request.budget_amount}
            budgetAmountMax={request.budget_amount_max}
            currency={request.listing_snapshot?.currency}
            referenceLinks={request.reference_links}
          />

          {canRespondToRequest && (
            <div className={classes.respond}>
              {updateStatusMutation.error && (
                <div className={classes.submitError}>
                  The commission status could not be updated right now.
                </div>
              )}

              <div className={classes.row}>
                {canAcceptListingRequest(request.status) && (
                  <button
                    className={classes.btnPrimary}
                    type="button"
                    onClick={() => void handleAcceptRequest()}
                    disabled={updateStatusMutation.isPending}
                  >
                    {updateStatusMutation.isPending ? "Updating…" : "Accept commission request"}
                  </button>
                )}

                {canDeclineListingRequest(request.status) && (
                  <button
                    className={classes.btnDanger}
                    type="button"
                    onClick={() => {
                      setShowDeclineForm((current) => !current);
                      setDeclineReasonError(null);
                    }}
                    disabled={updateStatusMutation.isPending}
                  >
                    {showDeclineForm ? "Cancel decline" : "Decline commission request"}
                  </button>
                )}
              </div>

              <Collapse open={showDeclineForm && canDeclineListingRequest(request.status)}>
                <div className={classes.field}>
                  <label className={classes.label} htmlFor="declineReason">
                    Decline reason
                  </label>

                  <textarea
                    id="declineReason"
                    className={classes.textarea}
                    value={declineReason}
                    onChange={(event) => {
                      setDeclineReason(event.target.value);
                      setDeclineReasonError(null);
                    }}
                    placeholder="Explain why this commission request is being declined for audit and client clarity."
                    maxLength={1000}
                  />

                  <div className={classes.hint}>
                    {trimmedDeclineReason.length}/1000 characters. Minimum 10 characters required.
                  </div>

                  {declineReasonError && (
                    <div className={classes.error}>{declineReasonError}</div>
                  )}

                  <div className={classes.row}>
                    <button
                      className={classes.btnDanger}
                      type="button"
                      onClick={() => void handleDeclineRequest()}
                      disabled={!canConfirmDecline}
                    >
                      {updateStatusMutation.isPending
                        ? "Declining commission request…"
                        : "Confirm decline"}
                    </button>
                  </div>
                </div>
              </Collapse>
            </div>
          )}
        </>
      ),
    },
    {
      id: "agreement",
      title: "Project agreement",
      summary: summarizeAgreement(agreement, "Not created yet"),
      ...flags("agreement"),
      visible: request.status !== "submitted" || Boolean(agreement),
      content: (
        <>
          {agreementQuery.error && (
            <div className={classes.errorCard}>
              Project agreement could not be loaded right now.
            </div>
          )}

          <ListingRequestAgreementCreatorActions
            agreement={agreement}
            isPending={sendDraftAgreementMutation.isPending}
            error={sendDraftAgreementMutation.error}
            onSendAgreement={(agreementId) =>
              sendDraftAgreementMutation.mutateAsync({ agreementId })
            }
          />

          {request.status === "accepted" &&
            !agreement &&
            !agreementQuery.isLoading &&
            !agreementQuery.error && (
              <ExpandingFormPanel
                title="Create project agreement"
                description="Scope, price, timeline and payments for the buyer to accept."
                launchLabel="Create agreement"
              >
                {(close) => (
                  <ListingRequestAgreementBuilder
                    request={request}
                    buyerName={getAgreementPersonName(buyer, "The buyer")}
                    currency={payoutCurrency}
                    isPending={createAgreementMutation.isPending}
                    error={createAgreementMutation.error}
                    onCreateAgreement={thenClose(createAgreementMutation.mutateAsync, close)}
                  />
                )}
              </ExpandingFormPanel>
            )}

          <ListingRequestAgreementSummary
            agreement={agreement}
            isLoading={agreementQuery.isLoading}
            buyerName={getAgreementPersonName(buyer, "The buyer")}
          />
        </>
      ),
    },
    {
      id: "payments",
      title: "Payments",
      summary: summarizeSchedule(agreement),
      ...flags("payments"),
      visible: request.status === "accepted" || Boolean(agreement),
      content: (
        <ListingRequestAgreementWorkReadinessCard
          requestStatus={request.status}
          agreement={agreement}
        />
      ),
    },
    {
      id: "milestones",
      title: "Milestones",
      summary: summarizeMilestones(milestones),
      ...flags("milestones"),
      visible: usesMilestones,
      content: (
        <>
          {activeMilestoneWaitMessage && (
            <div className={classes.infoCard}>{activeMilestoneWaitMessage}</div>
          )}

          {!requestReadOnly &&
            request.status === "accepted" &&
            startingPaymentResolved &&
            canSubmitActiveMilestone && (
              <ExpandingFormPanel
                title={`Submit milestone ${(activeMilestone?.sort_order ?? 0) + 1}`}
                description={activeMilestone?.title ?? "Share the work for buyer review."}
                launchLabel={activeMilestone?.status === "revision_requested" ? "Resubmit milestone" : "Submit milestone"}
              >
                {(close) => (
                  <ListingRequestMilestoneSubmissionForm
                    milestone={activeMilestone}
                    isPending={submitMilestoneMutation.isPending}
                    error={submitMilestoneMutation.error}
                    onSubmitMilestone={thenClose(submitMilestoneMutation.mutateAsync, close)}
                  />
                )}
              </ExpandingFormPanel>
            )}

          <ListingRequestMilestoneSummary
            milestones={milestones}
            submissions={milestoneSubmissions}
            viewer="creator"
            isLoading={milestonesAreLoading}
            error={milestoneError}
          />
        </>
      ),
    },
    {
      id: "delivery",
      title: "Final delivery",
      summary: summarizeDeliveries(finalDeliveries),
      ...flags("delivery"),
      visible: agreementAccepted,
      content: (
        <>
          <ListingRequestFinalDeliveryCreatorActions
            finalDelivery={draftFinalDelivery}
            isPending={sendDraftFinalDeliveryMutation.isPending}
            error={sendDraftFinalDeliveryMutation.error}
            onSubmitFinalDelivery={(finalDeliveryId) =>
              sendDraftFinalDeliveryMutation.mutateAsync({ finalDeliveryId })
            }
          />

          {finalDeliveryCreationBlockedReason && (
            <div className={classes.infoCard}>{finalDeliveryCreationBlockedReason}</div>
          )}

          {canCreateFinalDelivery && agreement && (
            <ExpandingFormPanel
              title="Create final delivery"
              description="Package the finished files for the buyer's approval."
              launchLabel="Create delivery"
            >
              {(close) => (
                <ListingRequestFinalDeliveryBuilder
                  requestStatus={request.status}
                  agreement={agreement}
                  isPending={createFinalDeliveryMutation.isPending}
                  error={createFinalDeliveryMutation.error}
                  onCreateFinalDelivery={thenClose(createFinalDeliveryMutation.mutateAsync, close)}
                />
              )}
            </ExpandingFormPanel>
          )}

          <ListingRequestFinalDeliverySummary
            finalDeliveries={finalDeliveries}
            viewer="creator"
            isLoading={finalDeliveriesQuery.isLoading}
            error={finalDeliveriesQuery.error}
          />
        </>
      ),
    },
    {
      id: "changeOrders",
      title: "Change orders",
      summary: summarizeChangeOrders(changeOrders),
      ...flags("changeOrders"),
      visible: agreementAccepted,
      content: (
        <>
          <ListingRequestChangeOrderCreatorActions
            changeOrder={draftChangeOrder}
            isPending={sendDraftChangeOrderMutation.isPending}
            error={sendDraftChangeOrderMutation.error}
            onSendChangeOrder={(changeOrderId) =>
              sendDraftChangeOrderMutation.mutateAsync({ changeOrderId })
            }
          />

          {canCreateChangeOrder && agreement && (
            <ExpandingFormPanel
              title="Propose a change order"
              description="Add scope, cost or time after the agreement was accepted."
              launchLabel="Propose change"
            >
              {(close) => (
                <ListingRequestChangeOrderBuilder
                  requestStatus={request.status}
                  agreement={agreement}
                  isPending={createChangeOrderMutation.isPending}
                  error={createChangeOrderMutation.error}
                  onCreateChangeOrder={thenClose(createChangeOrderMutation.mutateAsync, close)}
                />
              )}
            </ExpandingFormPanel>
          )}

          <ListingRequestChangeOrderSummary
            changeOrders={changeOrders}
            viewer="creator"
            isLoading={changeOrdersQuery.isLoading}
            error={changeOrdersQuery.error}
          />
        </>
      ),
    },
    {
      id: "progress",
      title: "Progress updates",
      summary: summarizeProgress(progressUpdates),
      ...flags("progress"),
      visible: Boolean(agreement),
      content: (
        <>
          <ListingRequestProgressUpdateScheduleCard agreement={agreement} updates={progressUpdates} />

          {canPostProgressUpdate && (
            <ExpandingFormPanel
              title="Post a progress update"
              description="Keep the buyer in the loop and meet the update schedule."
              launchLabel="Post update"
            >
              {(close) => (
                <ListingRequestProgressUpdateForm
                  requestStatus={request.status}
                  agreement={agreement}
                  isPending={createProgressUpdateMutation.isPending}
                  error={createProgressUpdateMutation.error}
                  onCreateProgressUpdate={thenClose(createProgressUpdateMutation.mutateAsync, close)}
                />
              )}
            </ExpandingFormPanel>
          )}

          {agreementAccepted && (
            <ListingRequestProgressUpdateTimeline
              updates={progressUpdates}
              isLoading={progressUpdatesQuery.isLoading}
              error={progressUpdatesQuery.error}
            />
          )}
        </>
      ),
    },
    {
      id: "snapshot",
      title: "Listing snapshot",
      summary: "As it was when the buyer reached out",
      ...flags("snapshot"),
      content: <ListingSnapshotDetails snapshot={snapshot} />,
    },
  ];

  const meta = [
    <span key="buyer">
      From <span className="font-semibold text-zinc-900">{buyerLabel}</span>
    </span>,
    <span key="submitted">Submitted {workspaceDate(request.created_at)}</span>,
    request.status === "completed" && request.completed_at ? (
      <span key="completed">Completed {workspaceDate(request.completed_at)}</span>
    ) : (
      <span key="updated">Updated {workspaceDate(request.updated_at)}</span>
    ),
  ];

  const manageMenu = canArchiveListingRequest(request.status) ? (
    <ActionMenu>
      <p className={classes.text}>
        Archive this commission to remove it from your active queue without declining it.
      </p>

      <button
        className={classes.btnOutline}
        type="button"
        onClick={() => void handleArchiveRequest()}
        disabled={updateStatusMutation.isPending}
      >
        {updateStatusMutation.isPending ? "Updating…" : "Archive commission"}
      </button>
    </ActionMenu>
  ) : canCancelListingRequestBeforePayment(request.status) &&
    paidPayments.length === 0 ? (
    <ActionMenu>
      <ListingRequestCancelBeforePaymentAction
        isPending={cancelBeforePaymentMutation.isPending}
        error={cancelBeforePaymentMutation.error}
        onCancel={handleCancelBeforePayment}
      />
    </ActionMenu>
  ) : undefined;

  return (
    <RequestWorkspace
      header={
        <StatusHeader
          backTo={backTo}
          backLabel="Back to creator commissions"
          eyebrow="Commission request"
          title={snapshot.title}
          meta={meta}
          statusLabel={getListingRequestStatusLabel(request.status, request, request)}
          statusTone={getListingRequestStatusTone(request.status)}
          stages={getRequestStages(workspaceInput)}
          actions={manageMenu}
          notice={
            (request.status === "declined" ||
              request.status === "archived" ||
              request.status === "cancelled") && (
              <RequestStatusNotice
                status={request.status}
                reason={request.creator_status_reason}
                archiveContext={request}
                cancellationContext={request}
              />
            )
          }
        />
      }
      nextStep={
        <RequestNextStepCard
          step={nextStep}
          viewer="creator"
          isLoading={workspaceLoading}
          buyerLabel={buyerLabel}
          creatorLabel="You"
        />
      }
      conversation={
        <RequestConversationThread
          requestId={request.id}
          buyerLabel={buyerLabel}
          creatorLabel="You"
          viewer="creator"
          requestReadOnly={requestReadOnly}
          requestReadOnlyMessage={requestReadOnlyMessage}
        />
      }
      sections={<WorkspaceSectionList requestStatus={request.status} sections={sections} />}
    />
  );
};

export default CreatorRequestDetails;
