import { hasErrorMessage } from "../../lib/errorMessage";
import { FadeIn } from "../../lib/motion";
import { useLanguage, useT } from "../../lib/i18n/i18n";
import { Link, useParams } from "react-router-dom";
import { useBuyerRequest } from "../../hooks/creatorRequests/useBuyerRequest";
import {
  getListingRequestStatusLabel,
  getListingRequestStatusTone,
} from "../../domain/listings/listingRequests";
import { getRequestNextStep, getRequestStages } from "../../domain/listings/requestWorkspace";
import { useState } from 'react';

import { getAgreementPersonName } from '../../domain/listings/listingRequestAgreements';
import { useMyProfile } from '../../hooks/profile/useMyProfile';
import { useOffSiteReceipts } from '../../hooks/conversations/useOffSiteReceipts';
import ListingRequestAgreementBuyerActions from '../../components/listingRequests/agreements/ListingRequestAgreementBuyerActions';
import ListingRequestAgreementSummary from '../../components/listingRequests/agreements/ListingRequestAgreementSummary';
import ListingRequestAgreementWorkReadinessCard from '../../components/listingRequests/agreements/ListingRequestAgreementWorkReadinessCard';
import ListingRequestChangeOrderBuyerActions from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderBuyerActions';
import ListingRequestChangeOrderSummary from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderSummary';
import RequestConversationThread from '../../components/listingRequests/conversations/RequestConversationThread';
import ListingRequestSubmissionDetails from '../../components/listingRequests/core/ListingRequestSubmissionDetails';
import ListingRequestFinalDeliveryBuyerActions from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliveryBuyerActions';
import ListingRequestFinalDeliverySummary from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliverySummary';
import ListingRequestProgressUpdateScheduleCard from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateScheduleCard';
import ListingRequestProgressUpdateTimeline from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateTimeline';
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
import { useArchiveBuyerListingRequest } from '../../hooks/creatorRequests/useArchiveBuyerListingRequest';
import { useListingRequestAgreement } from '../../hooks/creatorRequests/useListingRequestAgreement';
import { useListingRequestChangeOrders } from '../../hooks/creatorRequests/useListingRequestChangeOrders';
import { useListingRequestFinalDeliveries } from '../../hooks/creatorRequests/useListingRequestFinalDeliveries';
import { useListingRequestProgressUpdates } from '../../hooks/creatorRequests/useListingRequestProgressUpdates';
import { useRespondListingRequestAgreement } from '../../hooks/creatorRequests/useRespondListingRequestAgreement';
import { useRespondListingRequestChangeOrder } from '../../hooks/creatorRequests/useRespondListingRequestChangeOrder';
import { useRespondListingRequestFinalDelivery } from '../../hooks/creatorRequests/useRespondListingRequestFinalDelivery';
import { useRespondListingRequestMilestone } from '../../hooks/creatorRequests/useRespondListingRequestMilestone';
import { useListingRequestMilestoneSubmissions } from '../../hooks/creatorRequests/useListingRequestMilestoneSubmissions';
import { useListingRequestMilestones } from '../../hooks/creatorRequests/useListingRequestMilestones';
import ListingRequestMilestoneBuyerActions from '../../components/listingRequests/milestones/ListingRequestMilestoneBuyerActions';
import ListingRequestMilestoneSummary from '../../components/listingRequests/milestones/ListingRequestMilestoneSummary';
import { canApproveSubmittedListingRequestFinalDelivery, getListingRequestFinalDeliveryApprovalBlockedReason, getSubmittedListingRequestFinalDelivery } from '../../domain/listings/listingRequestFinalDeliveries';
import { getActiveListingRequestMilestone } from '../../domain/listings/listingRequestMilestones';
import { getSentListingRequestChangeOrder } from '../../domain/listings/listingRequestChangeOrders';
import { useListingRequestPayments } from '../../hooks/payments/useListingRequestPayments';
import ListingRequestPaymentsCard from '../../components/listingRequests/payments/ListingRequestPaymentsCard';
import { canCancelListingRequestBeforePayment } from '../../domain/listings/listingRequests';
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
  row: "flex flex-wrap items-center gap-3",
  btnOutline: "btnOutline btnSm",
  loadingText: "text-sm text-zinc-600",
  errorBox: "notice noticeError",
  warningBox: "notice noticeWarning space-y-3",
  btnDanger: "btnDangerOutline btnSm",
} as const;

// Prefers handle for creator display, then display name, then user id
const creatorText = (
  creator: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) =>
  creator?.handle ? `@${creator.handle}` : creator?.display_name ?? fallbackUserId;

const BuyerRequestDetails = () => {

  const [isArchiveConfirming, setIsArchiveConfirming] = useState(false);

  const { id } = useParams<{ id: string }>();
  const t = useT();
  const language = useLanguage();

  const { data, isLoading, error } = useBuyerRequest(id ?? null);
  const archiveRequestMutation = useArchiveBuyerListingRequest();

  const request = data?.request ?? null;
  const creator = data?.creator ?? null;

  const agreementQuery = useListingRequestAgreement(request?.id ?? null);
  const respondAgreementMutation = useRespondListingRequestAgreement();
  // The buyer's own name, for the lines of an agreement that are theirs to do.
  const { data: myProfile } = useMyProfile();
  const { data: offSiteReceipts = [] } = useOffSiteReceipts(id ?? "");
  const buyerName = getAgreementPersonName(myProfile, t("commission.buyerFallback"));
  const respondChangeOrderMutation =
    useRespondListingRequestChangeOrder();
  const respondFinalDeliveryMutation =
    useRespondListingRequestFinalDelivery();
  const respondMilestoneMutation =
    useRespondListingRequestMilestone();

  const agreement = agreementQuery.data ?? null;

  // Buyers should not see creator drafts.
  // RLS should block these too, but this keeps the UI safe if stale mocked data exists.
  const buyerVisibleAgreement =
    agreement?.status === "draft" ? null : agreement;

  const milestoneRequestId =
    buyerVisibleAgreement?.status === "buyer_accepted" &&
      buyerVisibleAgreement.payment_structure ===
      "milestone_payments"
      ? request?.id ?? null
      : null;

  const milestonesQuery =
    useListingRequestMilestones(milestoneRequestId);

  const milestoneSubmissionsQuery =
    useListingRequestMilestoneSubmissions(
      milestoneRequestId
    );

  const progressUpdatesQuery = useListingRequestProgressUpdates(
    buyerVisibleAgreement?.status === "buyer_accepted"
      ? request?.id ?? null
      : null
  );

  const paymentsQuery = useListingRequestPayments(
    buyerVisibleAgreement?.status === "buyer_accepted"
      ? request?.id ?? null
      : null,
  );

  const payments = paymentsQuery.data ?? [];
  const paidPayments = payments.filter((payment) => payment.status === "paid");

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

  const changeOrdersQuery = useListingRequestChangeOrders(
    buyerVisibleAgreement?.status === "buyer_accepted"
      ? request?.id ?? null
      : null
  );

  const changeOrders = changeOrdersQuery.data ?? [];

  const activeSentChangeOrder =
    getSentListingRequestChangeOrder(changeOrders);

  const finalDeliveriesQuery =
    useListingRequestFinalDeliveries(
      buyerVisibleAgreement?.status ===
        "buyer_accepted"
        ? request?.id ?? null
        : null
    );

  const finalDeliveries =
    finalDeliveriesQuery.data ?? [];

  const activeSubmittedFinalDelivery =
    getSubmittedListingRequestFinalDelivery(
      finalDeliveries
    );

  const milestones = milestonesQuery.data ?? [];

  const milestoneSubmissions =
    milestoneSubmissionsQuery.data ?? [];

  const activeMilestone =
    getActiveListingRequestMilestone(milestones);

  const milestonesAreLoading =
    milestonesQuery.isLoading ||
    milestoneSubmissionsQuery.isLoading;

  const milestoneError =
    milestonesQuery.error ??
    milestoneSubmissionsQuery.error;

  const finalDeliveryApprovalBlockedReason =
    getListingRequestFinalDeliveryApprovalBlockedReason(
      buyerVisibleAgreement,
      t
    );

  // The same rule as require_off_site_receipts_before_approval: receipts of
  // a replaced final delivery do not hold up this one.
  const offSiteReceiptPending = offSiteReceipts.some(
    (receipt) =>
      receipt.status !== "received" &&
      (!receipt.final_delivery_id ||
        receipt.final_delivery_id === activeSubmittedFinalDelivery?.id)
  );

  const canApproveFinalDelivery =
    activeSubmittedFinalDelivery
      ? canApproveSubmittedListingRequestFinalDelivery(
        activeSubmittedFinalDelivery.status,
        buyerVisibleAgreement
      )
      : false;

  const handleArchiveRequest = async () => {
    if (!request) {
      return;
    }

    await archiveRequestMutation.mutateAsync({
      requestId: request.id,
    });

    setIsArchiveConfirming(false);
  };

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

  if (isLoading) {
    return <div className={classes.loadingText}>{t("common.loading")}</div>;
  }

  if (error || !request) {
    return (
      <div className={classes.page}>
        <Link to="/requests" className={classes.backLink}>
          ← {t("commission.back")}
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>{t("commission.notFound")}</h1>
          <p className={classes.sub}>{t("commission.notFoundText")}</p>
        </div>
      </div>
    );
  }

  const snapshot = request.listing_snapshot;

  const backTo =
    request.status === "archived" || request.status === "cancelled"
      ? "/requests/archived"
      : request.status === "completed"
        ? "/requests/completed"
        : "/requests";

  const handleAcceptAgreement = async (
    acknowledgementKeys: string[],
    earlyServiceRequested: boolean,
  ) => {
    if (!buyerVisibleAgreement || buyerVisibleAgreement.status !== "sent") {
      return;
    }

    await respondAgreementMutation.mutateAsync({
      agreementId: buyerVisibleAgreement.id,
      response: "buyer_accepted",
      acknowledgementKeys,
      earlyServiceRequested,
    });
  };

  const handleDeclineAgreement = async () => {
    if (!buyerVisibleAgreement || buyerVisibleAgreement.status !== "sent") {
      return;
    }

    await respondAgreementMutation.mutateAsync({
      agreementId: buyerVisibleAgreement.id,
      response: "buyer_declined",
    });
  };

  const requestReadOnly =
    request.status === "archived" ||
    request.status === "declined" ||
    request.status === "completed" ||
    request.status === "cancelled";

  const requestReadOnlyMessage =
    request.status === "archived"
      ? t("commission.readOnlyArchived")
      : request.status === "declined"
        ? t("commission.readOnlyDeclined")
        : request.status === "completed"
          ? t("commission.readOnlyCompleted")
          : request.status === "cancelled"
            ? t("commission.readOnlyCancelled")
            : undefined;

  const creatorLabel = creatorText(creator, request.creator_user_id);

  const workspaceInput = {
    requestStatus: request.status,
    agreement: buyerVisibleAgreement,
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

  const nextStep = getRequestNextStep(workspaceInput, t, language);
  const workspaceLoading =
    agreementQuery.isLoading ||
    milestonesAreLoading ||
    changeOrdersQuery.isLoading ||
    finalDeliveriesQuery.isLoading;
  const flags = getSectionFlags(nextStep, "buyer", {
    readOnly: requestReadOnly,
    isLoading: workspaceLoading,
  });

  const agreementAccepted = buyerVisibleAgreement?.status === "buyer_accepted";
  const usesMilestones =
    agreementAccepted && buyerVisibleAgreement?.payment_structure === "milestone_payments";
  const progressUpdates = progressUpdatesQuery.data ?? [];

  const sections: WorkspaceSectionSpec[] = [
    {
      id: "request",
      title: t("section.yourCommission"),
      summary: t("section.yourCommissionSummary"),
      ...flags("request"),
      defaultOpen: request.status === "submitted" || isCancellationProposalOpen,
      content: (
        <>
          {request.status === "accepted" && paidPayments.length > 0 && (
            <ListingRequestCancellationProposalPanel
              viewer="buyer"
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
              currentUserId={request.buyer_user_id}
            />
          )}

          {request.status === "accepted" && (
            <CancellationWarningPanel
              requestId={request.id}
              currentUserId={request.buyer_user_id}
              currentUserRole="buyer"
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
        </>
      ),
    },
    {
      id: "agreement",
      title: t("section.agreement"),
      summary: summarizeAgreement(buyerVisibleAgreement, t("section.agreementEmpty"), t),
      ...flags("agreement"),
      content: (
        <>
          <ListingRequestAgreementBuyerActions
            agreement={buyerVisibleAgreement}
            isPending={respondAgreementMutation.isPending}
            error={respondAgreementMutation.error}
            onAccept={handleAcceptAgreement}
            onDecline={handleDeclineAgreement}
            buyerName={buyerName}
          />

          {/* A sent agreement is shown by the panel above, with an
              "I understand" box under each section. */}
          {buyerVisibleAgreement?.status !== "sent" && (
            <ListingRequestAgreementSummary
              agreement={buyerVisibleAgreement}
              isLoading={agreementQuery.isLoading}
              buyerName={buyerName}
            />
          )}
        </>
      ),
    },
    {
      id: "payments",
      title: t("section.payments"),
      summary: summarizeSchedule(buyerVisibleAgreement, t),
      ...flags("payments"),
      visible: request.status === "accepted" || Boolean(buyerVisibleAgreement),
      content: (
        <>
          <ListingRequestAgreementWorkReadinessCard
            requestStatus={request.status}
            agreement={buyerVisibleAgreement}
          />

          {agreementAccepted && (
            <ListingRequestPaymentsCard
              payments={paymentsQuery.data ?? []}
              isLoading={paymentsQuery.isLoading}
              error={paymentsQuery.error}
              readOnly={requestReadOnly}
            />
          )}
        </>
      ),
    },
    {
      id: "milestones",
      title: t("section.milestones"),
      summary: summarizeMilestones(milestones, t),
      ...flags("milestones"),
      visible: usesMilestones,
      content: (
        <>
          {!requestReadOnly && request.status === "accepted" && (
            <ListingRequestMilestoneBuyerActions
              milestone={activeMilestone}
              isPending={respondMilestoneMutation.isPending}
              error={respondMilestoneMutation.error}
              onRespondMilestone={(input) => respondMilestoneMutation.mutateAsync(input)}
            />
          )}

          <ListingRequestMilestoneSummary
            milestones={milestones}
            submissions={milestoneSubmissions}
            viewer="buyer"
            isLoading={milestonesAreLoading}
            error={milestoneError}
          />
        </>
      ),
    },
    {
      id: "delivery",
      title: t("section.delivery"),
      summary: summarizeDeliveries(finalDeliveries, t),
      ...flags("delivery"),
      visible: agreementAccepted,
      content: (
        <>
          <ListingRequestFinalDeliveryBuyerActions
            finalDelivery={activeSubmittedFinalDelivery}
            canApprove={canApproveFinalDelivery}
            approvalBlockedReason={finalDeliveryApprovalBlockedReason}
            offSiteReceiptPending={offSiteReceiptPending}
            isPending={respondFinalDeliveryMutation.isPending}
            error={respondFinalDeliveryMutation.error}
            onApprove={(finalDeliveryId) =>
              respondFinalDeliveryMutation.mutateAsync({
                finalDeliveryId,
                response: "buyer_approved",
              })
            }
            onRequestRevision={(finalDeliveryId, revisionRequestReason) =>
              respondFinalDeliveryMutation.mutateAsync({
                finalDeliveryId,
                response: "revision_requested",
                revisionRequestReason,
              })
            }
          />

          <ListingRequestFinalDeliverySummary
            finalDeliveries={finalDeliveries}
            viewer="buyer"
            isLoading={finalDeliveriesQuery.isLoading}
            error={finalDeliveriesQuery.error}
          />
        </>
      ),
    },
    {
      id: "changeOrders",
      title: t("section.changeOrders"),
      summary: summarizeChangeOrders(changeOrders, t),
      ...flags("changeOrders"),
      visible: agreementAccepted,
      content: (
        <>
          <ListingRequestChangeOrderBuyerActions
            // A fresh panel per change order: if the creator withdraws one and
            // sends another, a half-finished "confirm accept" must not carry over.
            key={activeSentChangeOrder?.id ?? "none"}
            changeOrder={activeSentChangeOrder}
            isPending={respondChangeOrderMutation.isPending}
            error={respondChangeOrderMutation.error}
            onAccept={(changeOrderId) =>
              respondChangeOrderMutation.mutateAsync({
                changeOrderId,
                response: "buyer_accepted",
              })
            }
            onDecline={(changeOrderId, responseReason) =>
              respondChangeOrderMutation.mutateAsync({
                changeOrderId,
                response: "buyer_declined",
                responseReason,
              })
            }
          />

          <ListingRequestChangeOrderSummary
            changeOrders={changeOrders}
            viewer="buyer"
            isLoading={changeOrdersQuery.isLoading}
            error={changeOrdersQuery.error}
          />
        </>
      ),
    },
    {
      id: "progress",
      title: t("section.progress"),
      summary: summarizeProgress(progressUpdates, t, language),
      ...flags("progress"),
      visible: agreementAccepted,
      content: (
        <>
          <ListingRequestProgressUpdateScheduleCard
            agreement={buyerVisibleAgreement}
            updates={progressUpdates}
          />

          <ListingRequestProgressUpdateTimeline
            updates={progressUpdates}
            isLoading={progressUpdatesQuery.isLoading}
            error={progressUpdatesQuery.error}
          />
        </>
      ),
    },
    {
      id: "snapshot",
      title: t("section.snapshot"),
      summary: t("section.snapshotSummary"),
      ...flags("snapshot"),
      content: <ListingSnapshotDetails snapshot={snapshot} />,
    },
  ];

  const meta = [
    <span key="creator">
      {t("commission.with")} <span className="font-semibold text-zinc-900">{creatorLabel}</span>
    </span>,
    <span key="submitted">
      {t("commission.submitted", { date: workspaceDate(request.created_at, language) })}
    </span>,
    request.status === "completed" && request.completed_at ? (
      <span key="completed">
        {t("commission.completed", { date: workspaceDate(request.completed_at, language) })}
      </span>
    ) : (
      <span key="updated">
        {t("commission.updated", { date: workspaceDate(request.updated_at, language) })}
      </span>
    ),
  ];

  const manageMenu =
    request.status === "submitted" ? (
      <ActionMenu>
        <p className={classes.text}>{t("archive.text")}</p>

        {archiveRequestMutation.error && (
          <div className={classes.errorBox}>
            {hasErrorMessage(archiveRequestMutation.error)
              ? archiveRequestMutation.error.message
              : t("archive.failed")}
          </div>
        )}

        {isArchiveConfirming ? (
          <FadeIn className={classes.warningBox}>
            <p>{t("archive.sure")}</p>

            <div className={classes.row}>
              <button
                className={classes.btnDanger}
                type="button"
                disabled={archiveRequestMutation.isPending}
                onClick={() => void handleArchiveRequest()}
              >
                {t(archiveRequestMutation.isPending ? "archive.archiving" : "archive.confirm")}
              </button>

              <button
                className={classes.btnOutline}
                type="button"
                disabled={archiveRequestMutation.isPending}
                onClick={() => setIsArchiveConfirming(false)}
              >
                {t("cancelEarly.keep")}
              </button>
            </div>
          </FadeIn>
        ) : (
          <button
            className={classes.btnDanger}
            type="button"
            disabled={archiveRequestMutation.isPending}
            onClick={() => setIsArchiveConfirming(true)}
          >
            {t("archive.button")}
          </button>
        )}
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
          backLabel={t("commission.back")}
          eyebrow={t("commission.eyebrow")}
          title={snapshot.title}
          meta={meta}
          statusLabel={getListingRequestStatusLabel(request.status, request, request, t)}
          statusTone={getListingRequestStatusTone(request.status)}
          stages={getRequestStages(workspaceInput, t)}
          actions={manageMenu}
          notice={
            (request.status === "declined" ||
              request.status === "archived" ||
              request.status === "cancelled") &&
            <RequestStatusNotice
              status={request.status}
              reason={request.creator_status_reason}
              archiveContext={request}
              cancellationContext={request}
            />
          }
        />
      }
      nextStep={
        <RequestNextStepCard
          step={nextStep}
          viewer="buyer"
          isLoading={workspaceLoading}
          buyerLabel={t("common.you")}
          creatorLabel={creatorLabel}
        />
      }
      conversation={
        <RequestConversationThread
          requestId={request.id}
          buyerLabel={t("common.you")}
          buyerName={
            myProfile
              ? creatorText(
                { ...myProfile, user_id: request.buyer_user_id },
                request.buyer_user_id
              )
              : undefined
          }
          creatorLabel={creatorLabel}
          viewer="buyer"
          requestReadOnly={requestReadOnly}
          requestReadOnlyMessage={requestReadOnlyMessage}
        />
      }
      sections={<WorkspaceSectionList requestStatus={request.status} sections={sections} />}
    />
  );
};

export default BuyerRequestDetails;
