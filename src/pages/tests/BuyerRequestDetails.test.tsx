import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BuyerRequestDetails from "../buyer/BuyerRequestDetails";

const mocks = vi.hoisted(() => ({
  useBuyerRequest: vi.fn(),
  archiveRequest: vi.fn(),
  useListingRequestAgreement: vi.fn(),
  respondAgreement: vi.fn(),
  useListingRequestProgressUpdates:
    vi.fn(),
  useListingRequestChangeOrders:
    vi.fn(),
  respondChangeOrder: vi.fn(),
  useListingRequestFinalDeliveries:
    vi.fn(),
  respondFinalDelivery: vi.fn(),
  useListingRequestMilestones: vi.fn(),
  useListingRequestMilestoneSubmissions: vi.fn(),
  respondMilestone: vi.fn(),
  useListingRequestPayments: vi.fn(),
  useListingRequestCancellationProposal: vi.fn(),
  cancelBeforePayment: vi.fn(),
  proposeCancellation: vi.fn(),
  submitCancellationStatement: vi.fn(),
  respondCancellationProposal: vi.fn(),
}));

vi.mock(
  "../../hooks/creatorRequests/useCancelListingRequestBeforePayment",
  () => ({
    useCancelListingRequestBeforePayment: () => ({
      mutateAsync: mocks.cancelBeforePayment,
      isPending: false,
      error: null,
    }),
  })
);

vi.mock(
  "../../hooks/creatorRequests/useListingRequestCancellationProposal",
  () => ({
    useListingRequestCancellationProposal:
      mocks.useListingRequestCancellationProposal,
  })
);

vi.mock("../../hooks/creatorRequests/useListingRequestNotices", () => ({
  useListingRequestNotices: () => ({ data: [], isLoading: false }),
}));

vi.mock("../../hooks/creatorRequests/useListingRequestEarlyReviewFlags", () => ({
  useListingRequestEarlyReviewFlags: () => ({ data: [] }),
}));

vi.mock("../../hooks/creatorRequests/useSendListingRequestNotice", () => ({
  useSendListingRequestFirstNotice: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
  useSendListingRequestFinalNotice: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../hooks/creatorRequests/useFlagListingRequestForEarlyReview", () => ({
  useFlagListingRequestForEarlyReview: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock(
  "../../hooks/creatorRequests/useProposeListingRequestCancellation",
  () => ({
    useProposeListingRequestCancellation: () => ({
      mutateAsync: mocks.proposeCancellation,
      isPending: false,
      error: null,
    }),
  })
);

vi.mock(
  "../../hooks/creatorRequests/useSubmitListingRequestCancellationStatement",
  () => ({
    useSubmitListingRequestCancellationStatement: () => ({
      mutateAsync: mocks.submitCancellationStatement,
      isPending: false,
      error: null,
    }),
  })
);

vi.mock(
  "../../hooks/creatorRequests/useRespondListingRequestCancellationProposal",
  () => ({
    useRespondListingRequestCancellationProposal: () => ({
      mutateAsync: mocks.respondCancellationProposal,
      isPending: false,
      error: null,
    }),
  })
);

vi.mock(
  "../../hooks/creatorRequests/useBuyerRequest",
  () => ({
    useBuyerRequest:
      mocks.useBuyerRequest,
  })
);

vi.mock(
  "../../hooks/payments/useListingRequestPayments",
  () => ({
    useListingRequestPayments:
      mocks.useListingRequestPayments,
  }),
);

vi.mock(
  "../../components/listingRequests/conversations/RequestConversationThread",
  () => ({
    default: ({
      requestReadOnly,
      requestReadOnlyMessage,
    }: {
      requestReadOnly?: boolean;
      requestReadOnlyMessage?: string;
    }) => (
      <div>
        <div>
          Conversation thread loaded
        </div>

        <div>
          {requestReadOnly
            ? "Conversation is read-only"
            : "Conversation is writable"}
        </div>

        {requestReadOnlyMessage && (
          <div>
            {requestReadOnlyMessage}
          </div>
        )}
      </div>
    ),
  })
);

vi.mock(
  "../../hooks/creatorRequests/useArchiveBuyerListingRequest",
  () => ({
    useArchiveBuyerListingRequest:
      () => ({
        mutateAsync:
          mocks.archiveRequest,
        isPending: false,
        error: null,
      }),
  })
);

vi.mock(
  "../../hooks/creatorRequests/useListingRequestAgreement",
  () => ({
    useListingRequestAgreement:
      mocks.useListingRequestAgreement,
  })
);

vi.mock(
  "../../hooks/creatorRequests/useRespondListingRequestAgreement",
  () => ({
    useRespondListingRequestAgreement:
      () => ({
        mutateAsync:
          mocks.respondAgreement,
        isPending: false,
        error: null,
      }),
  })
);

vi.mock(
  "../../components/listingRequests/agreements/ListingRequestAgreementWorkReadinessCard",
  () => ({
    default: ({
      requestStatus,
      agreement,
    }: {
      requestStatus: string;
      agreement: {
        status: string;
      } | null;
    }) => (
      <div>
        Mock work readiness card:{" "}
        {requestStatus} /{" "}
        {agreement?.status ?? "none"}
      </div>
    ),
  })
);

vi.mock(
  "../../hooks/creatorRequests/useListingRequestProgressUpdates",
  () => ({
    useListingRequestProgressUpdates:
      mocks.useListingRequestProgressUpdates,
  })
);

vi.mock(
  "../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateTimeline",
  () => ({
    default: ({
      updates,
      isLoading,
      error,
    }: {
      updates: Array<{
        id: string;
      }>;
      isLoading?: boolean;
      error?: unknown;
    }) => (
      <div>
        Mock progress timeline:{" "}
        {updates.length} /{" "}
        {isLoading
          ? "loading"
          : "ready"}{" "}
        /{" "}
        {error !== null &&
          error !== undefined
          ? "error"
          : "no error"}
      </div>
    ),
  })
);

vi.mock(
  "../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateScheduleCard",
  () => ({
    default: ({
      agreement,
      updates,
    }: {
      agreement: {
        status: string;
        starting_payment_status: string;
      } | null;
      updates: Array<{
        id: string;
      }>;
    }) =>
      agreement ? (
        <div>
          Mock progress schedule:{" "}
          {agreement.status} /{" "}
          {
            agreement.starting_payment_status
          }{" "}
          / {updates.length}
        </div>
      ) : null,
  })
);

vi.mock(
  "../../hooks/creatorRequests/useListingRequestChangeOrders",
  () => ({
    useListingRequestChangeOrders:
      mocks.useListingRequestChangeOrders,
  })
);

vi.mock(
  "../../components/listingRequests/changeOrders/ListingRequestChangeOrderSummary",
  () => ({
    default: ({
      changeOrders,
      viewer,
      isLoading,
      error,
    }: {
      changeOrders: Array<{
        id: string;
      }>;
      viewer: string;
      isLoading?: boolean;
      error?: unknown;
    }) => (
      <div>
        Mock change-order summary:{" "}
        {viewer} /{" "}
        {changeOrders.length} /{" "}
        {isLoading
          ? "loading"
          : "ready"}{" "}
        /{" "}
        {error !== null &&
          error !== undefined
          ? "error"
          : "no error"}
      </div>
    ),
  })
);

vi.mock(
  "../../hooks/creatorRequests/useRespondListingRequestChangeOrder",
  () => ({
    useRespondListingRequestChangeOrder:
      () => ({
        mutateAsync:
          mocks.respondChangeOrder,
        isPending: false,
        error: null,
      }),
  })
);

vi.mock(
  "../../components/listingRequests/changeOrders/ListingRequestChangeOrderBuyerActions",
  () => ({
    default: ({
      changeOrder,
      onAccept,
      onDecline,
    }: {
      changeOrder: {
        id: string;
        status: string;
      } | null;
      onAccept: (
        changeOrderId: string
      ) => unknown;
      onDecline: (
        changeOrderId: string,
        responseReason: string | null
      ) => unknown;
    }) =>
      changeOrder?.status === "sent" ? (
        <div>
          <button
            type="button"
            onClick={() =>
              onAccept(changeOrder.id)
            }
          >
            Mock accept change order
          </button>

          <button
            type="button"
            onClick={() =>
              onDecline(
                changeOrder.id,
                "Not needed anymore."
              )
            }
          >
            Mock decline change order
          </button>
        </div>
      ) : null,
  })
);

vi.mock(
  "../../hooks/creatorRequests/useListingRequestFinalDeliveries",
  () => ({
    useListingRequestFinalDeliveries:
      mocks.useListingRequestFinalDeliveries,
  })
);

vi.mock(
  "../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliverySummary",
  () => ({
    default: ({
      finalDeliveries,
      viewer,
      isLoading,
      error,
    }: {
      finalDeliveries: Array<{
        id: string;
      }>;
      viewer: string;
      isLoading?: boolean;
      error?: unknown;
    }) => (
      <div>
        Mock final delivery summary:{" "}
        {viewer} /{" "}
        {finalDeliveries.length} /{" "}
        {isLoading
          ? "loading"
          : "ready"}{" "}
        /{" "}
        {error !== null &&
          error !== undefined
          ? "error"
          : "no error"}
      </div>
    ),
  })
);

vi.mock(
  "../../hooks/creatorRequests/useRespondListingRequestFinalDelivery",
  () => ({
    useRespondListingRequestFinalDelivery:
      () => ({
        mutateAsync:
          mocks.respondFinalDelivery,
        isPending: false,
        error: null,
      }),
  })
);

vi.mock(
  "../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliveryBuyerActions",
  () => ({
    default: ({
      finalDelivery,
      canApprove,
      approvalBlockedReason,
      onApprove,
      onRequestRevision,
    }: {
      finalDelivery: {
        id: string;
        status: string;
      } | null;
      canApprove: boolean;
      approvalBlockedReason?:
      | string
      | null;
      onApprove: (
        finalDeliveryId: string
      ) => unknown;
      onRequestRevision: (
        finalDeliveryId: string,
        revisionRequestReason: string
      ) => unknown;
    }) =>
      finalDelivery?.status ===
        "submitted" ? (
        <div>
          <div>
            Mock final delivery
            approval:{" "}
            {canApprove
              ? "ready"
              : "blocked"}
          </div>

          {approvalBlockedReason && (
            <div>
              {approvalBlockedReason}
            </div>
          )}

          <button
            disabled={!canApprove}
            type="button"
            onClick={() =>
              onApprove(finalDelivery.id)
            }
          >
            Mock approve final delivery
          </button>

          <button
            type="button"
            onClick={() =>
              onRequestRevision(
                finalDelivery.id,
                "Please adjust the title alignment."
              )
            }
          >
            Mock commission final revisions
          </button>
        </div>
      ) : null,
  })
);

vi.mock(
  "../../components/listingRequests/milestones/ListingRequestMilestoneSummary",
  () => ({
    default: ({
      milestones,
      submissions,
      viewer,
      isLoading,
      error,
    }: {
      milestones: Array<{ id: string }>;
      submissions: Array<{ id: string }>;
      viewer: string;
      isLoading?: boolean;
      error?: unknown;
    }) => (
      <div>
        Mock milestone summary: {viewer} / {milestones.length} /{" "}
        {submissions.length} / {isLoading ? "loading" : "ready"} /{" "}
        {error ? "error" : "no error"}
      </div>
    ),
  })
);

vi.mock(
  "../../hooks/creatorRequests/useListingRequestMilestones",
  () => ({
    useListingRequestMilestones:
      mocks.useListingRequestMilestones,
  })
);

vi.mock(
  "../../hooks/creatorRequests/useListingRequestMilestoneSubmissions",
  () => ({
    useListingRequestMilestoneSubmissions:
      mocks.useListingRequestMilestoneSubmissions,
  })
);

vi.mock(
  "../../hooks/creatorRequests/useRespondListingRequestMilestone",
  () => ({
    useRespondListingRequestMilestone: () => ({
      mutateAsync: mocks.respondMilestone,
      isPending: false,
      error: null,
    }),
  })
);

vi.mock(
  "../../components/listingRequests/milestones/ListingRequestMilestoneBuyerActions",
  () => ({
    default: ({
      milestone,
      onRespondMilestone,
    }: {
      milestone: {
        id: string;
        status: string;
        title: string;
        sort_order: number;
      } | null;
      onRespondMilestone: (
        input:
          | {
            milestoneId: string;
            response: "buyer_approved";
          }
          | {
            milestoneId: string;
            response: "revision_requested";
            revisionRequestReason: string;
          }
      ) => unknown;
    }) =>
      milestone?.status === "submitted" ? (
        <div>
          <button
            type="button"
            onClick={() =>
              onRespondMilestone({
                milestoneId: milestone.id,
                response: "buyer_approved",
              })
            }
          >
            Mock approve milestone: {milestone.title}
          </button>

          <button
            type="button"
            onClick={() =>
              onRespondMilestone({
                milestoneId: milestone.id,
                response: "revision_requested",
                revisionRequestReason:
                  "Please adjust the colour contrast.",
              })
            }
          >
            Mock commission milestone revisions: {milestone.title}
          </button>
        </div>
      ) : null,
  })
);

vi.mock(
  "../../components/listingRequests/payments/ListingRequestPaymentsCard",
  () => ({
    default: ({
      payments,
      isLoading,
      error,
      readOnly,
    }: {
      payments: Array<{ id: string }>;
      isLoading?: boolean;
      error?: unknown;
      readOnly?: boolean;
    }) => (
      <div>
        Mock payments card: {payments.length} /{" "}
        {isLoading ? "loading" : "ready"} /{" "}
        {error !== null && error !== undefined
          ? "error"
          : "no error"}{" "}
        / {readOnly ? "read-only" : "writable"}
      </div>
    ),
  }),
);

const request = {
  id: "request-1",
  listing_id: "listing-1",
  buyer_user_id: "buyer-1",
  creator_user_id: "creator-1",
  status: "submitted",
  message: "Legacy commission message.",
  request_title: "Custom cozy emote pack",
  request_details: "I need three cozy emotes for my Twitch channel launch.",
  requested_timeline: "Flexible, ideally before June 10.",
  budget_amount: 75,
  reference_links: ["https://example.com/reference"],
  creator_status_reason: null,
  created_at: "2026-05-17T12:00:00.000Z",
  updated_at: "2026-05-17T12:00:00.000Z",
  archived_at: null,
  archived_by_user_id: null,
  completed_at: null,
  completed_by_user_id: null,
  listing_snapshot: {
    listing_id: "listing-1",
    creator_user_id: "creator-1",
    title: "Custom Emote Pack",
    short: "A custom emote pack for streamers.",
    offering_type: "commission",
    category: "emotes",
    video_subtype: null,
    price_type: "fixed",
    price_min: 50,
    price_max: null,
    deliverables: ["3 emotes", "PNG files"],
    tags: ["emotes"],
    preview_url: null,
    fulfilment_mode: "request",
    status: "published",
    is_active: true,
    updated_at: "2026-05-09T12:00:00.000Z",
  },
};

const agreement = {
  id: "agreement-1",
  listing_request_id: "request-1",
  creator_user_id: "creator-1",
  buyer_user_id: "buyer-1",
  version_number: 1,
  status: "sent",
  payment_structure: "deposit_balance",
  starting_payment_status: "payment_required",
  currency: "cad",
  base_amount: 200,
  total_amount: 250,
  deposit_amount: 100,
  estimated_start_at: "2026-06-01T12:00:00.000Z",
  estimated_completion_at: "2026-06-15T12:00:00.000Z",
  adjusted_estimated_completion_at: "2026-06-17T12:00:00.000Z",
  late_delivery_grace_days: 7,
  included_revision_count: 2,
  minimum_update_rule: "weekly_updates",
  first_update_due_days: 5,
  update_frequency_days: 7,
  scope_summary: "Create a custom overlay package for the buyer.",
  included_deliverables: ["Starting soon screen", "BRB screen"],
  additional_cost_policy:
    "Additional animated screens require an accepted change order.",
  revision_policy: "Includes two revision passes.",
  update_schedule_summary:
    "First update within 5 days, then weekly until delivery.",
  sent_at: "2026-05-24T12:00:00.000Z",
  buyer_accepted_at: null,
  buyer_declined_at: null,
  superseded_at: null,
  cancelled_at: null,
  created_at: "2026-05-24T12:00:00.000Z",
  updated_at: "2026-05-24T12:00:00.000Z",
  listing_request_agreement_acknowledgements: [],
  listing_request_agreement_items: [
    {
      id: "item-1",
      agreement_id: "agreement-1",
      title: "Starting soon screen",
      description: "Static starting soon scene.",
      item_type: "included",
      price_amount: 0,
      timeline_impact_days: 0,
      payment_timing: "included_no_extra_charge",
      is_required: true,
      is_selected: true,
      sort_order: 0,
      created_at: "2026-05-24T12:00:00.000Z",
      updated_at: "2026-05-24T12:00:00.000Z",
    },
  ],
  listing_request_payment_schedule_items: [
    {
      id: "payment-1",
      agreement_id: "agreement-1",
      title: "Deposit",
      description: "Required before work starts.",
      amount: 100,
      currency: "cad",
      payment_timing: "due_before_work_starts",
      status: "payment_required",
      due_at: null,
      paid_at: null,
      sort_order: 0,
      created_at: "2026-05-24T12:00:00.000Z",
      updated_at: "2026-05-24T12:00:00.000Z",
    },
  ],
  listing_request_timeline_holds: [],
} as const;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/requests/request-1"]}>
      <Routes>
        <Route path="/requests/:id" element={<BuyerRequestDetails />} />
      </Routes>
    </MemoryRouter>
  );

// Agreements only exist once the creator has accepted the request.
const mockAcceptedRequest = () => {
  mocks.useBuyerRequest.mockReturnValue({
    data: {
      request: { ...request, status: "accepted" },
      creator: {
        user_id: "creator-1",
        handle: "creatoruser",
        display_name: "Creator User",
        avatar_url: null,
      },
    },
    isLoading: false,
    error: null,
  });
};

describe("<BuyerRequestDetails />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request,
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.archiveRequest.mockResolvedValue("request-1");

    mocks.useListingRequestAgreement.mockReturnValue({
      data: agreement,
      isLoading: false,
      error: null,
    });

    mocks.respondAgreement.mockResolvedValue({
      id: "agreement-1",
      status: "buyer_accepted",
      starting_payment_status: "payment_required",
    });

    mocks.useListingRequestProgressUpdates.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestChangeOrders.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    mocks.respondChangeOrder.mockResolvedValue(
      undefined
    );

    mocks.useListingRequestFinalDeliveries.mockReturnValue(
      {
        data: [],
        isLoading: false,
        error: null,
      }
    );

    mocks.respondFinalDelivery.mockResolvedValue(undefined);

    mocks.useListingRequestMilestones.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestMilestoneSubmissions.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    mocks.respondMilestone.mockResolvedValue(undefined);

    mocks.useListingRequestPayments.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestCancellationProposal.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
  });


  it("renders structured buyer commission details", () => {
    renderPage();

    // A submitted request opens its request section; the snapshot starts collapsed.
    const requestToggle = screen.getByRole("button", { name: /Your commission/ });
    const snapshotToggle = screen.getByRole("button", { name: /Listing snapshot/ });

    expect(requestToggle).toHaveAttribute("aria-expanded", "true");
    expect(snapshotToggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(snapshotToggle);

    expect(snapshotToggle).toHaveAttribute("aria-expanded", "true");

    expect(screen.getByText("Custom cozy emote pack")).toBeInTheDocument();
    expect(
      screen.getByText("I need three cozy emotes for my Twitch channel launch.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Flexible, ideally before June 10.")
    ).toBeInTheDocument();
    expect(screen.getByText("$75")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/reference")).toHaveAttribute(
      "href",
      "https://example.com/reference"
    );

    expect(screen.getByRole("heading", { level: 1, name: "Custom Emote Pack" })).toBeInTheDocument();
    expect(screen.getAllByText("Custom Emote Pack")).toHaveLength(2);
    expect(screen.getByText("Conversation thread loaded")).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Next step" })).getByText("Waiting on @creatoruser")
    ).toBeInTheDocument();
  });

  it("asks for confirmation before archiving a submitted commission", async () => {
    renderPage();

    // Archiving lives in the header's Manage menu.
    fireEvent.click(screen.getByRole("button", { name: /Manage/ }));

    fireEvent.click(screen.getByRole("button", { name: "Archive commission" }));

    expect(
      screen.getByText(
        "Are you sure you want to archive this commission? The creator will no longer see it as an active commission."
      )
    ).toBeInTheDocument();

    expect(mocks.archiveRequest).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm archive" }));

    await waitFor(() => {
      expect(mocks.archiveRequest).toHaveBeenCalledWith({
        requestId: "request-1",
      });
    });
  });

  it("lets the buyer cancel archive confirmation", () => {
    renderPage();

    // Archiving lives in the header's Manage menu.
    fireEvent.click(screen.getByRole("button", { name: /Manage/ }));

    fireEvent.click(screen.getByRole("button", { name: "Archive commission" }));

    expect(screen.getByRole("button", { name: "Confirm archive" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep commission" }));

    expect(
      screen.queryByRole("button", { name: "Confirm archive" })
    ).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Archive commission" })).toBeInTheDocument();
  });

  it("lets the buyer accept a sent project agreement after checking all acknowledgements", async () => {
    mockAcceptedRequest();
    mocks.useListingRequestAgreement.mockReturnValue({
      data: agreement,
      isLoading: false,
      error: null,
    });

    renderPage();

    const acceptButton = screen.getByRole("button", {
      name: "Accept project agreement",
    });

    expect(acceptButton).toBeDisabled();

    screen.getAllByRole("checkbox").forEach((checkbox) => {
      fireEvent.click(checkbox);
    });

    expect(acceptButton).toBeEnabled();

    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(mocks.respondAgreement).toHaveBeenCalledWith({
        agreementId: "agreement-1",
        response: "buyer_accepted",
        acknowledgementKeys: [
          "agreement:scope_summary",
          "scope_item:item-1",
          "agreement:payment_schedule",
          "payment_item:payment-1",
          "agreement:timeline",
          "agreement:update_schedule",
          "agreement:revision_policy",
          "agreement:additional_cost_policy",
          "agreement:change_orders",
          "agreement:final_release_payment",
        ],
        earlyServiceRequested: true,
      });
    });
  });

  it("lets the buyer decline a sent project agreement without acknowledgements", async () => {
    mockAcceptedRequest();
    mocks.useListingRequestAgreement.mockReturnValue({
      data: agreement,
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Decline agreement" }));

    await waitFor(() => {
      expect(mocks.respondAgreement).toHaveBeenCalledWith({
        agreementId: "agreement-1",
        response: "buyer_declined",
      });
    });
  });

  it("does not show creator draft agreements to the buyer", () => {
    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "draft",
        sent_at: null,
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText("No project agreement has been created for this commission yet.")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Create a custom overlay package for the buyer.")
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Accept project agreement" })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Decline agreement" })
    ).not.toBeInTheDocument();

    expect(
      mocks.useListingRequestProgressUpdates
    ).toHaveBeenCalledWith(null);

    expect(
      screen.queryByText(/Mock progress timeline:/)
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText(/Mock progress schedule:/)
    ).not.toBeInTheDocument();

  });

  it("passes the accepted commission and buyer accepted agreement into the work readiness card", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        buyer_accepted_at: "2026-05-25T13:00:00.000Z",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText("Mock work readiness card: accepted / buyer_accepted")
    ).toBeInTheDocument();
  });

  it("renders progress updates after the buyer accepts the agreement", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        starting_payment_status: "paid",
        buyer_accepted_at: "2026-06-06T12:00:00.000Z",
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestProgressUpdates.mockReturnValue({
      data: [
        {
          id: "progress-update-1",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      mocks.useListingRequestProgressUpdates
    ).toHaveBeenCalledWith("request-1");

    expect(
      screen.getByText(
        "Mock progress timeline: 1 / ready / no error"
      )
    ).toBeInTheDocument();
  });

  it("does not render progress updates before the buyer accepts the agreement", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "sent",
        buyer_accepted_at: null,
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      mocks.useListingRequestProgressUpdates
    ).toHaveBeenCalledWith(null);

    expect(
      screen.queryByText(/Mock progress timeline:/)
    ).not.toBeInTheDocument();

    expect(
      mocks.useListingRequestFinalDeliveries
    ).toHaveBeenCalledWith(null);

    expect(
      screen.queryByText(
        /Mock final delivery summary:/
      )
    ).not.toBeInTheDocument();
  });

  it("passes the visible agreement and progress updates into the buyer schedule card", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        starting_payment_status: "paid",
        buyer_accepted_at: "2026-06-06T12:00:00.000Z",
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestProgressUpdates.mockReturnValue({
      data: [
        {
          id: "progress-update-1",
        },
        {
          id: "progress-update-2",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText(
        "Mock progress schedule: buyer_accepted / paid / 2"
      )
    ).toBeInTheDocument();
  });

  it("shows the buyer schedule before starting payment is confirmed", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        starting_payment_status: "payment_required",
        buyer_accepted_at: "2026-06-06T12:00:00.000Z",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText(
        "Mock progress schedule: buyer_accepted / payment_required / 0"
      )
    ).toBeInTheDocument();

    expect(
      mocks.useListingRequestProgressUpdates
    ).toHaveBeenCalledWith("request-1");

    expect(
      mocks.useListingRequestChangeOrders
    ).toHaveBeenCalledWith("request-1");

    expect(
      screen.getByText(
        "Mock change-order summary: buyer / 0 / ready / no error"
      )
    ).toBeInTheDocument();
  });

  it("renders buyer-visible change orders after agreement acceptance", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        starting_payment_status: "paid",
        buyer_accepted_at: "2026-06-06T12:00:00.000Z",
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestChangeOrders.mockReturnValue({
      data: [
        {
          id: "change-order-1",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      mocks.useListingRequestChangeOrders
    ).toHaveBeenCalledWith("request-1");

    expect(
      screen.getByText(
        "Mock change-order summary: buyer / 1 / ready / no error"
      )
    ).toBeInTheDocument();
  });

  it("accepts the active sent change order from the buyer page", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        starting_payment_status: "paid",
        buyer_accepted_at:
          "2026-06-06T12:00:00.000Z",
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestChangeOrders.mockReturnValue({
      data: [
        {
          id: "change-order-1",
          status: "sent",
          title: "Additional animated overlay",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Mock accept change order",
      })
    );

    expect(
      mocks.respondChangeOrder
    ).toHaveBeenCalledWith({
      changeOrderId: "change-order-1",
      response: "buyer_accepted",
    });
  });

  it("declines the active sent change order from the buyer page", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        starting_payment_status: "paid",
        buyer_accepted_at:
          "2026-06-06T12:00:00.000Z",
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestChangeOrders.mockReturnValue({
      data: [
        {
          id: "change-order-1",
          status: "sent",
          title: "Additional animated overlay",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Mock decline change order",
      })
    );

    expect(
      mocks.respondChangeOrder
    ).toHaveBeenCalledWith({
      changeOrderId: "change-order-1",
      response: "buyer_declined",
      responseReason: "Not needed anymore.",
    });
  });

  it("renders buyer-visible final deliveries after agreement acceptance", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        starting_payment_status: "paid",
        buyer_accepted_at:
          "2026-06-06T12:00:00.000Z",
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestFinalDeliveries.mockReturnValue(
      {
        data: [
          {
            id: "final-delivery-1",
          },
        ],
        isLoading: false,
        error: null,
      }
    );

    renderPage();

    expect(
      mocks.useListingRequestFinalDeliveries
    ).toHaveBeenCalledWith("request-1");

    expect(
      screen.getByText(
        "Mock final delivery summary: buyer / 1 / ready / no error"
      )
    ).toBeInTheDocument();
  });

  it("makes a completed buyer project read-only", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "completed",
          completed_at:
            "2026-06-09T15:00:00.000Z",
          completed_by_user_id: "buyer-1",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    // The status pill sits beside the page title.
    const heading = screen.getByRole("heading", { level: 1 });

    expect(
      within(heading.parentElement as HTMLElement).getByText("Completed")
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /Manage/ })
    ).not.toBeInTheDocument();

    expect(
      screen.getByText("Conversation is read-only")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Completed projects are read-only because the buyer approved the final delivery."
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Archive commission",
      })
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "← Back to my commissions",
      })
    ).toHaveAttribute(
      "href",
      "/requests/completed"
    );

    expect(
      screen.getByText(/Jun 9, 2026/)
    ).toBeInTheDocument();
  });

  it("approves a submitted final delivery after the final balance is resolved", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        starting_payment_status: "paid",
        listing_request_payment_schedule_items: [
          {
            ...agreement
              .listing_request_payment_schedule_items[0],
            id: "final-payment-1",
            amount: 150,
            payment_timing:
              "due_before_final_release",
            status: "paid",
            paid_at:
              "2026-06-09T13:00:00.000Z",
          },
        ],
        listing_request_timeline_holds: [],
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestFinalDeliveries.mockReturnValue({
      data: [
        {
          id: "final-delivery-1",
          status: "submitted",
          title: "Final overlay delivery",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText(
        "Mock final delivery approval: ready"
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Mock approve final delivery",
      })
    );

    expect(
      mocks.respondFinalDelivery
    ).toHaveBeenCalledWith({
      finalDeliveryId: "final-delivery-1",
      response: "buyer_approved",
    });
  });

  it("blocks final-delivery approval while the final balance is pending", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        starting_payment_status: "paid",
        listing_request_payment_schedule_items: [
          {
            ...agreement
              .listing_request_payment_schedule_items[0],
            id: "final-payment-1",
            amount: 150,
            payment_timing:
              "due_before_final_release",
            status: "payment_required",
            paid_at: null,
          },
        ],
        listing_request_timeline_holds: [
          {
            id: "hold-1",
            reason: "balance_payment_pending",
            ended_at: null,
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestFinalDeliveries.mockReturnValue({
      data: [
        {
          id: "final-delivery-1",
          status: "submitted",
          title: "Final overlay delivery",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText(
        "Mock final delivery approval: blocked"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Mock approve final delivery",
      })
    ).toBeDisabled();

    expect(
      screen.getByText(
        "The final balance must be confirmed as paid before you can approve this delivery."
      )
    ).toBeInTheDocument();
  });

  it("commissions revisions for a submitted final delivery", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        starting_payment_status: "paid",
        listing_request_payment_schedule_items: [],
        listing_request_timeline_holds: [],
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestFinalDeliveries.mockReturnValue({
      data: [
        {
          id: "final-delivery-1",
          status: "submitted",
          title: "Final overlay delivery",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Mock commission final revisions",
      })
    );

    expect(
      mocks.respondFinalDelivery
    ).toHaveBeenCalledWith({
      finalDeliveryId: "final-delivery-1",
      response: "revision_requested",
      revisionRequestReason:
        "Please adjust the title alignment.",
    });
  });

  it("blocks final-delivery approval while milestone payments are unconfirmed", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        payment_structure: "milestone_payments",
        starting_payment_status: "not_required",
        listing_request_payment_schedule_items: [
          {
            id: "payment-1",
            agreement_id: "agreement-1",
            agreement_item_id: "agreement-item-1",
            payment_timing: "due_at_milestone_approval",
            status: "paid",
            amount: 100,
            currency: "cad",
            due_at: null,
            paid_at: "2026-06-18T12:00:00.000Z",
            created_at: "2026-06-18T12:00:00.000Z",
            updated_at: "2026-06-18T12:00:00.000Z",
          },
          {
            id: "payment-2",
            agreement_id: "agreement-1",
            agreement_item_id: "agreement-item-2",
            payment_timing: "due_at_milestone_approval",
            status: "payment_required",
            amount: 150,
            currency: "cad",
            due_at: "2026-06-18T13:00:00.000Z",
            paid_at: null,
            created_at: "2026-06-18T12:00:00.000Z",
            updated_at: "2026-06-18T13:00:00.000Z",
          },
        ],
        listing_request_timeline_holds: [],
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestFinalDeliveries.mockReturnValue({
      data: [
        {
          id: "final-delivery-1",
          status: "submitted",
          title: "Final package",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText(
        "All milestone payments must be confirmed before you can approve the final delivery."
      )
    ).toBeInTheDocument();
  });

  it("does not allow final delivery approval without an active submitted delivery", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        starting_payment_status: "paid",
        listing_request_payment_schedule_items: [],
        listing_request_timeline_holds: [],
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestFinalDeliveries.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.queryByRole("button", {
        name: /approve final delivery/i,
      })
    ).not.toBeInTheDocument();
  });

  it("renders payments after the buyer accepts the agreement", () => {
    mocks.useBuyerRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        creator: {
          user_id: "creator-1",
          handle: "creatoruser",
          display_name: "Creator User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "buyer_accepted",
        starting_payment_status: "paid",
        buyer_accepted_at:
          "2026-06-06T12:00:00.000Z",
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestPayments.mockReturnValue({
      data: [
        {
          id: "stripe-payment-1",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      mocks.useListingRequestPayments,
    ).toHaveBeenCalledWith("request-1");

    expect(
      screen.getByText(
        "Mock payments card: 1 / ready / no error / writable",
      ),
    ).toBeInTheDocument();
  });

  it("does not load payments before the buyer accepts the agreement", () => {
    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        ...agreement,
        status: "sent",
        buyer_accepted_at: null,
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      mocks.useListingRequestPayments,
    ).toHaveBeenCalledWith(null);

    expect(
      screen.queryByText(/Mock payments card:/),
    ).not.toBeInTheDocument();
  });
});