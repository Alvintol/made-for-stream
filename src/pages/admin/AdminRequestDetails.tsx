import { Link, useParams } from "react-router-dom";
import { useAdminRequest } from "../../hooks/admin/useAdminRequest";
import {
  getListingRequestStatusLabel,
  getListingRequestStatusTone,
} from "../../domain/listings/listingRequests";
import { getRequestNextStep, getRequestStages } from "../../domain/listings/requestWorkspace";
import ListingSnapshotDetails from "../../components/listingRequests/workspace/ListingSnapshotDetails";
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
import ListingRequestAgreementSummary from '../../components/listingRequests/agreements/ListingRequestAgreementSummary';
import ListingRequestAgreementWorkReadinessCard from '../../components/listingRequests/agreements/ListingRequestAgreementWorkReadinessCard';
import ListingRequestChangeOrderSummary from '../../components/listingRequests/changeOrders/ListingRequestChangeOrderSummary';
import RequestConversationThread from '../../components/listingRequests/conversations/RequestConversationThread';
import ListingRequestSubmissionDetails from '../../components/listingRequests/core/ListingRequestSubmissionDetails';
import ListingRequestFinalDeliverySummary from '../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliverySummary';
import ListingRequestAgreementAdminPaymentActions from '../../components/listingRequests/payments/ListingRequestAgreementAdminPaymentActions';
import ListingRequestPaymentAdminRefundPanel from '../../components/listingRequests/payments/ListingRequestPaymentAdminRefundPanel';
import CreatorRecoveryBalanceAdminPanel from '../../components/listingRequests/payments/CreatorRecoveryBalanceAdminPanel';
import AdminNoticeClosurePanel from '../../components/listingRequests/core/AdminNoticeClosurePanel';
import ListingRequestChangeOrderPaymentAdminActions from '../../components/listingRequests/payments/ListingRequestChangeOrderPaymentAdminActions';
import ListingRequestFinalBalancePaymentAdminActions from '../../components/listingRequests/payments/ListingRequestFinalBalancePaymentAdminActions';
import ListingRequestProgressUpdateScheduleCard from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateScheduleCard';
import ListingRequestProgressUpdateTimeline from '../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateTimeline';
import { useAdminConfirmListingRequestChangeOrderPayment } from '../../hooks/admin/useAdminConfirmListingRequestChangeOrderPayment';
import { useAdminConfirmListingRequestFinalBalancePayment } from '../../hooks/admin/useAdminConfirmListingRequestFinalBalancePayment';
import { useAdminConfirmListingRequestStartingPayment } from '../../hooks/admin/useAdminConfirmListingRequestStartingPayment';
import { useListingRequestAgreement } from '../../hooks/creatorRequests/useListingRequestAgreement';
import { useListingRequestChangeOrders } from '../../hooks/creatorRequests/useListingRequestChangeOrders';
import { useListingRequestFinalDeliveries } from '../../hooks/creatorRequests/useListingRequestFinalDeliveries';
import { useListingRequestProgressUpdates } from '../../hooks/creatorRequests/useListingRequestProgressUpdates';
import { useListingRequestMilestoneSubmissions } from '../../hooks/creatorRequests/useListingRequestMilestoneSubmissions';
import { useListingRequestMilestones } from '../../hooks/creatorRequests/useListingRequestMilestones';
import ListingRequestMilestoneSummary from '../../components/listingRequests/milestones/ListingRequestMilestoneSummary';
import { useAdminConfirmListingRequestMilestonePayment } from '../../hooks/admin/useAdminConfirmListingRequestMilestonePayment';
import ListingRequestMilestonePaymentAdminActions from '../../components/listingRequests/payments/ListingRequestMilestonePaymentAdminActions';
import { useListingRequestCancellationProposal } from '../../hooks/creatorRequests/useListingRequestCancellationProposal';

const classes = {
  page: "space-y-6",
  backLink: "backLink",
  h1: "pageTitle",
  sub: "pageSub",
  card: "card p-6",
  btnOutline: "btnOutline btnSm",
  loadingText: "text-sm text-zinc-600",
} as const;

const profileText = (
  profile: {
    handle: string | null;
    display_name: string | null;
    user_id: string;
  } | null,
  fallbackUserId: string
) =>
  profile?.handle ? `@${profile.handle}` : profile?.display_name ?? fallbackUserId;

const AdminRequestDetails = () => {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useAdminRequest(id ?? null);

  const request = data?.request ?? null;
  const buyer = data?.buyer ?? null;
  const creator = data?.creator ?? null;

  const agreementQuery = useListingRequestAgreement(request?.id ?? null);

  const confirmStartingPaymentMutation =
    useAdminConfirmListingRequestStartingPayment();
  const confirmChangeOrderPaymentMutation =
    useAdminConfirmListingRequestChangeOrderPayment();
  const confirmFinalBalancePaymentMutation =
    useAdminConfirmListingRequestFinalBalancePayment();
  const confirmMilestonePaymentMutation =
    useAdminConfirmListingRequestMilestonePayment();

  const agreement = agreementQuery.data ?? null;

  const cancellationProposalQuery = useListingRequestCancellationProposal(
    request?.status === "accepted" ? request?.id ?? null : null
  );
  const cancellationProposal = cancellationProposalQuery.data ?? null;
  const isCancellationProposalOpen =
    cancellationProposal?.status === "pending_creator_statement" ||
    cancellationProposal?.status === "pending_buyer_response";

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

  const finalDeliveries =
    finalDeliveriesQuery.data ?? [];

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

  const milestones = milestonesQuery.data ?? [];

  const milestoneSubmissions =
    milestoneSubmissionsQuery.data ?? [];

  const milestonesAreLoading =
    milestonesQuery.isLoading ||
    milestoneSubmissionsQuery.isLoading;

  const milestoneError =
    milestonesQuery.error ??
    milestoneSubmissionsQuery.error;


  if (isLoading) {
    return <div className={classes.loadingText}>Loading…</div>;
  }

  if (error || !request) {
    return (
      <div className={classes.page}>
        <Link to="/admin/requests" className={classes.backLink}>
          ← Back to admin commissions
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>Commission not found</h1>
          <p className={classes.sub}>
            This commission could not be loaded for admin review.
          </p>
        </div>
      </div>
    );
  }

  const snapshot = request.listing_snapshot;
  const buyerLabel = profileText(buyer, request.buyer_user_id);
  const creatorLabel = profileText(creator, request.creator_user_id);
  const changeOrders = changeOrdersQuery.data ?? [];
  const progressUpdates = progressUpdatesQuery.data ?? [];
  const agreementAccepted = agreement?.status === "buyer_accepted";
  const requestReadOnly =
    request.status === "archived" ||
    request.status === "declined" ||
    request.status === "cancelled";

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
  const flags = getSectionFlags(nextStep, "admin", {
    readOnly: requestReadOnly,
    isLoading: workspaceLoading,
  });

  // Payment confirmation is the admin's own job, so due payments flag the section for admin.
  const paymentDue =
    agreement?.starting_payment_status === "payment_required" ||
    (agreement?.listing_request_payment_schedule_items ?? []).some(
      (item) => item.status === "payment_required"
    );

  const sections: WorkspaceSectionSpec[] = [
    {
      id: "payments",
      title: "Payments",
      summary: summarizeSchedule(agreement),
      ...flags("payments"),
      attention: paymentDue && !requestReadOnly,
      visible: Boolean(agreement),
      content: (
        <>
          <ListingRequestAgreementWorkReadinessCard
            requestStatus={request.status}
            agreement={agreement}
          />

          <ListingRequestAgreementAdminPaymentActions
            agreement={agreement}
            isPending={confirmStartingPaymentMutation.isPending}
            error={confirmStartingPaymentMutation.error}
            onConfirmPayment={(agreementId) =>
              confirmStartingPaymentMutation.mutateAsync({ agreementId })
            }
          />

          {agreementAccepted && agreement?.payment_structure === "milestone_payments" && (
            <ListingRequestMilestonePaymentAdminActions
              milestones={milestones}
              isPending={confirmMilestonePaymentMutation.isPending}
              error={confirmMilestonePaymentMutation.error}
              onConfirmPayment={(paymentScheduleItemId) =>
                confirmMilestonePaymentMutation.mutateAsync({ paymentScheduleItemId })
              }
            />
          )}

          <ListingRequestChangeOrderPaymentAdminActions
            agreement={agreement}
            isPending={confirmChangeOrderPaymentMutation.isPending}
            error={confirmChangeOrderPaymentMutation.error}
            onConfirmPayment={(paymentScheduleItemId) =>
              confirmChangeOrderPaymentMutation.mutateAsync({ paymentScheduleItemId })
            }
          />

          <ListingRequestFinalBalancePaymentAdminActions
            agreement={agreement}
            isPending={confirmFinalBalancePaymentMutation.isPending}
            error={confirmFinalBalancePaymentMutation.error}
            onConfirmPayment={(paymentScheduleItemId) =>
              confirmFinalBalancePaymentMutation.mutateAsync({ paymentScheduleItemId })
            }
          />

          <ListingRequestPaymentAdminRefundPanel listingRequestId={request.id} />
          <CreatorRecoveryBalanceAdminPanel creatorUserId={request.creator_user_id} />

          {request.status === "accepted" && (
            <AdminNoticeClosurePanel
              requestId={request.id}
              buyerUserId={request.buyer_user_id}
              creatorUserId={request.creator_user_id}
            />
          )}
        </>
      ),
    },
    {
      id: "request",
      title: "Commission request",
      summary: "Brief, timeline, budget and references",
      ...flags("request"),
      defaultOpen: true,
      content: (
        <ListingRequestSubmissionDetails
          requestTitle={request.request_title}
          requestDetails={request.request_details}
          fallbackMessage={request.message}
          requestedTimeline={request.requested_timeline}
          budgetAmount={request.budget_amount}
          referenceLinks={request.reference_links}
        />
      ),
    },
    {
      id: "agreement",
      title: "Project agreement",
      summary: summarizeAgreement(agreement, "Not created yet"),
      ...flags("agreement"),
      content: (
        <ListingRequestAgreementSummary
          agreement={agreement}
          isLoading={agreementQuery.isLoading}
        />
      ),
    },
    {
      id: "milestones",
      title: "Milestones",
      summary: summarizeMilestones(milestones),
      ...flags("milestones"),
      visible: agreementAccepted && agreement?.payment_structure === "milestone_payments",
      content: (
        <ListingRequestMilestoneSummary
          milestones={milestones}
          submissions={milestoneSubmissions}
          viewer="admin"
          isLoading={milestonesAreLoading}
          error={milestoneError}
        />
      ),
    },
    {
      id: "delivery",
      title: "Final delivery",
      summary: summarizeDeliveries(finalDeliveries),
      ...flags("delivery"),
      visible: agreementAccepted,
      content: (
        <ListingRequestFinalDeliverySummary
          finalDeliveries={finalDeliveries}
          viewer="admin"
          isLoading={finalDeliveriesQuery.isLoading}
          error={finalDeliveriesQuery.error}
        />
      ),
    },
    {
      id: "changeOrders",
      title: "Change orders",
      summary: summarizeChangeOrders(changeOrders),
      ...flags("changeOrders"),
      visible: agreementAccepted,
      content: (
        <ListingRequestChangeOrderSummary
          changeOrders={changeOrders}
          viewer="admin"
          isLoading={changeOrdersQuery.isLoading}
          error={changeOrdersQuery.error}
        />
      ),
    },
    {
      id: "progress",
      title: "Progress updates",
      summary: summarizeProgress(progressUpdates),
      ...flags("progress"),
      visible: agreementAccepted,
      content: (
        <>
          <ListingRequestProgressUpdateScheduleCard agreement={agreement} updates={progressUpdates} />

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
      title: "Listing snapshot",
      summary: "Captured when the buyer submitted",
      ...flags("snapshot"),
      content: <ListingSnapshotDetails snapshot={snapshot} />,
    },
  ];

  const meta = [
    <span key="parties">
      <span className="font-semibold text-zinc-900">{buyerLabel}</span> →{" "}
      <span className="font-semibold text-zinc-900">{creatorLabel}</span>
    </span>,
    <span key="submitted">Submitted {workspaceDate(request.created_at)}</span>,
    request.status === "completed" && request.completed_at ? (
      <span key="completed">Completed {workspaceDate(request.completed_at)}</span>
    ) : (
      <span key="updated">Updated {workspaceDate(request.updated_at)}</span>
    ),
  ];

  return (
    <RequestWorkspace
      header={
        <StatusHeader
          backTo="/admin/requests"
          backLabel="Back to admin commissions"
          eyebrow="Admin commission review"
          title={snapshot.title}
          meta={meta}
          statusLabel={getListingRequestStatusLabel(request.status, request, request)}
          statusTone={getListingRequestStatusTone(request.status)}
          stages={getRequestStages(workspaceInput)}
          actions={
            <Link
              className={classes.btnOutline}
              to={`/admin/listing-revisions/${request.listing_id}`}
            >
              View listing revisions
            </Link>
          }
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
          viewer="admin"
          isLoading={workspaceLoading}
          buyerLabel={buyerLabel}
          creatorLabel={creatorLabel}
        />
      }
      conversation={
        <RequestConversationThread
          requestId={request.id}
          buyerLabel={buyerLabel}
          creatorLabel={creatorLabel}
          viewer="admin"
          requestReadOnly={requestReadOnly}
          requestReadOnlyMessage={
            request.status === "archived"
              ? "Archived commissions are read-only."
              : request.status === "cancelled"
                ? "Cancelled commissions are read-only."
                : "Declined commission requests are read-only because the conversation has been ended."
          }
        />
      }
      sections={
        <WorkspaceSectionList
          requestStatus={request.status}
          sections={sections}
          order={[
            "payments",
            "request",
            "agreement",
            "milestones",
            "delivery",
            "changeOrders",
            "progress",
            "snapshot",
          ]}
        />
      }
    />
  );
};

export default AdminRequestDetails;
