import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorRequestDetails from "../creator/CreatorRequestDetails";

const mocks = vi.hoisted(() => ({
  useCreatorRequest: vi.fn(),
  updateRequestStatus: vi.fn(),
  createAgreement: vi.fn(),
  sendDraftAgreement: vi.fn(),
  useListingRequestAgreement: vi.fn(),
  useListingRequestProgressUpdates:
    vi.fn(),
  createProgressUpdate: vi.fn(),
  useListingRequestChangeOrders:
    vi.fn(),
  createChangeOrder: vi.fn(),
  sendDraftChangeOrder: vi.fn(),
  useListingRequestFinalDeliveries:
    vi.fn(),
  createFinalDelivery: vi.fn(),
  sendDraftFinalDelivery: vi.fn(),
  useListingRequestMilestones: vi.fn(),
  useListingRequestMilestoneSubmissions: vi.fn(),
  submitMilestone: vi.fn(),
  useListingRequestPayments: vi.fn(),
  useListingRequestCancellationProposal: vi.fn(),
  cancelBeforePayment: vi.fn(),
  proposeCancellation: vi.fn(),
  submitCancellationStatement: vi.fn(),
  respondCancellationProposal: vi.fn(),
}));

// Prices are shown in the creator's own currency in these tests; the
// conversion has its own tests (ListingPriceText, displayCurrency).
vi.mock("../../hooks/money/useDisplayCurrency", () => ({
  useDisplayCurrency: () => ({ displayCurrency: null, rates: null }),
  useDisplayPreferences: () => ({ data: null, isLoading: false }),
  useSaveDisplayPreferences: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useExchangeRates: () => ({ data: null }),
}));

vi.mock("../../hooks/payments/useCreatorPaymentAccount", () => ({
  useCreatorPaymentAccount: () => ({ data: { default_currency: "cad" } }),
}));

vi.mock(
  "../../hooks/payments/useListingRequestPayments",
  () => ({
    useListingRequestPayments: mocks.useListingRequestPayments,
  })
);

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
  "../../hooks/creatorRequests/useCreatorRequest",
  () => ({
    useCreatorRequest:
      mocks.useCreatorRequest,
  })
);

vi.mock(
  "../../hooks/creatorRequests/useUpdateCreatorListingRequestStatus",
  () => ({
    useUpdateCreatorListingRequestStatus:
      () => ({
        mutateAsync:
          mocks.updateRequestStatus,
        isPending: false,
        error: null,
      }),
  })
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
  "../../hooks/creatorRequests/useListingRequestAgreement",
  () => ({
    useListingRequestAgreement:
      mocks.useListingRequestAgreement,
  })
);

vi.mock(
  "../../hooks/creatorRequests/useCreateListingRequestAgreement",
  () => ({
    useCreateListingRequestAgreement:
      () => ({
        mutateAsync:
          mocks.createAgreement,
        isPending: false,
        error: null,
      }),
  })
);

vi.mock(
  "../../components/listingRequests/agreements/ListingRequestAgreementSummary",
  () => ({
    default: ({
      agreement,
      isLoading,
    }: {
      agreement: unknown;
      isLoading?: boolean;
    }) => (
      <div>
        {isLoading
          ? "Mock agreement loading"
          : agreement
            ? "Mock agreement summary"
            : "Mock no agreement summary"}
      </div>
    ),
  })
);

vi.mock(
  "../../components/listingRequests/agreements/ListingRequestAgreementBuilder",
  () => ({
    default: ({
      request,
      onCreateAgreement,
    }: {
      request: {
        id: string;
      };
      onCreateAgreement: (input: {
        listingRequestId: string;
      }) => void;
    }) => (
      <button
        type="button"
        onClick={() =>
          onCreateAgreement({
            listingRequestId:
              request.id,
          })
        }
      >
        Mock agreement builder
      </button>
    ),
  })
);

vi.mock(
  "../../hooks/creatorRequests/useSendDraftListingRequestAgreement",
  () => ({
    useSendDraftListingRequestAgreement:
      () => ({
        mutateAsync:
          mocks.sendDraftAgreement,
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
        {error
          ? "error"
          : "no error"}
      </div>
    ),
  })
);

vi.mock(
  "../../hooks/creatorRequests/useCreateListingRequestProgressUpdate",
  () => ({
    useCreateListingRequestProgressUpdate:
      () => ({
        mutateAsync:
          mocks.createProgressUpdate,
        isPending: false,
        error: null,
      }),
  })
);

vi.mock(
  "../../components/listingRequests/progressUpdates/ListingRequestProgressUpdateForm",
  () => ({
    default: ({
      requestStatus,
      agreement,
      onCreateProgressUpdate,
    }: {
      requestStatus: string;
      agreement: {
        id: string;
        status: string;
        starting_payment_status: string;
      } | null;
      onCreateProgressUpdate: (input: {
        agreementId: string;
        updateKind: "progress";
        title: string;
        body: string;
        progressPercent: number;
      }) => void;
    }) =>
      agreement?.status ===
        "buyer_accepted" &&
        agreement.starting_payment_status ===
        "paid" &&
        requestStatus === "accepted" ? (
        <button
          type="button"
          onClick={() =>
            onCreateProgressUpdate({
              agreementId:
                agreement.id,
              updateKind: "progress",
              title:
                "Initial concepts completed",
              body:
                "The first concept sketches are ready for review.",
              progressPercent: 35,
            })
          }
        >
          Mock post progress update
        </button>
      ) : null,
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
  "../../hooks/creatorRequests/useCreateListingRequestChangeOrder",
  () => ({
    useCreateListingRequestChangeOrder:
      () => ({
        mutateAsync:
          mocks.createChangeOrder,
        isPending: false,
        error: null,
      }),
  })
);

vi.mock(
  "../../components/listingRequests/changeOrders/ListingRequestChangeOrderSummary",
  () => ({
    default: ({
      changeOrders,
      viewer,
    }: {
      changeOrders: Array<{
        id: string;
      }>;
      viewer: string;
    }) => (
      <div>
        Mock change-order summary:{" "}
        {viewer} /{" "}
        {changeOrders.length}
      </div>
    ),
  })
);

vi.mock(
  "../../components/listingRequests/changeOrders/ListingRequestChangeOrderBuilder",
  () => ({
    default: ({
      agreement,
      onCreateChangeOrder,
    }: {
      agreement: {
        id: string;
      } | null;
      onCreateChangeOrder: (input: {
        agreementId: string;
      }) => unknown;
    }) =>
      agreement ? (
        <button
          type="button"
          onClick={() =>
            onCreateChangeOrder({
              agreementId:
                agreement.id,
            })
          }
        >
          Mock change-order builder
        </button>
      ) : null,
  })
);

vi.mock(
  "../../hooks/creatorRequests/useSendDraftListingRequestChangeOrder",
  () => ({
    useSendDraftListingRequestChangeOrder:
      () => ({
        mutateAsync:
          mocks.sendDraftChangeOrder,
        isPending: false,
        error: null,
      }),
  })
);

vi.mock(
  "../../components/listingRequests/changeOrders/ListingRequestChangeOrderCreatorActions",
  () => ({
    default: ({
      changeOrder,
      onSendChangeOrder,
    }: {
      changeOrder: {
        id: string;
        status: string;
      } | null;
      onSendChangeOrder: (
        changeOrderId: string
      ) => unknown;
    }) =>
      changeOrder?.status === "draft" ? (
        <button
          type="button"
          onClick={() =>
            onSendChangeOrder(
              changeOrder.id
            )
          }
        >
          Mock send draft change order
        </button>
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
  "../../hooks/creatorRequests/useCreateListingRequestFinalDelivery",
  () => ({
    useCreateListingRequestFinalDelivery:
      () => ({
        mutateAsync:
          mocks.createFinalDelivery,
        isPending: false,
        error: null,
      }),
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
        {error
          ? "error"
          : "no error"}
      </div>
    ),
  })
);

vi.mock(
  "../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliveryBuilder",
  () => ({
    default: ({
      agreement,
      onCreateFinalDelivery,
    }: {
      agreement: {
        id: string;
      } | null;
      onCreateFinalDelivery: (input: {
        agreementId: string;
      }) => unknown;
    }) =>
      agreement ? (
        <button
          type="button"
          onClick={() =>
            onCreateFinalDelivery({
              agreementId:
                agreement.id,
            })
          }
        >
          Mock final delivery builder
        </button>
      ) : null,
  })
);

vi.mock(
  "../../hooks/creatorRequests/useSendDraftListingRequestFinalDelivery",
  () => ({
    useSendDraftListingRequestFinalDelivery:
      () => ({
        mutateAsync:
          mocks.sendDraftFinalDelivery,
        isPending: false,
        error: null,
      }),
  })
);

vi.mock(
  "../../components/listingRequests/finalDeliveries/ListingRequestFinalDeliveryCreatorActions",
  () => ({
    default: ({
      finalDelivery,
      onSubmitFinalDelivery,
    }: {
      finalDelivery: {
        id: string;
        status: string;
      } | null;
      onSubmitFinalDelivery: (
        finalDeliveryId: string
      ) => unknown;
    }) =>
      finalDelivery?.status ===
        "draft" ? (
        <button
          type="button"
          onClick={() =>
            onSubmitFinalDelivery(
              finalDelivery.id
            )
          }
        >
          Mock submit final-delivery
          draft
        </button>
      ) : null,
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
  "../../hooks/creatorRequests/useSubmitListingRequestMilestone",
  () => ({
    useSubmitListingRequestMilestone: () => ({
      mutateAsync: mocks.submitMilestone,
      isPending: false,
      error: null,
    }),
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
  "../../components/listingRequests/milestones/ListingRequestMilestoneSubmissionForm",
  () => ({
    default: ({
      milestone,
      onSubmitMilestone,
    }: {
      milestone: {
        id: string;
        status: string;
        title: string;
      } | null;
      onSubmitMilestone: (input: {
        milestoneId: string;
        summary: string;
        deliveryLinks: string[];
      }) => unknown;
    }) =>
      milestone ? (
        <button
          type="button"
          onClick={() =>
            onSubmitMilestone({
              milestoneId: milestone.id,
              summary:
                "Milestone work is ready for buyer review.",
              deliveryLinks: [
                "https://example.com/milestone",
              ],
            })
          }
        >
          Mock submit milestone: {milestone.title}
        </button>
      ) : null,
  })
);

vi.mock(
  "../../components/listingRequests/milestones/ListingRequestMilestoneSubmissionForm",
  () => ({
    default: ({
      milestone,
      onSubmitMilestone,
    }: {
      milestone: {
        id: string;
        status: string;
        title: string;
      } | null;
      onSubmitMilestone: (input: {
        milestoneId: string;
        summary: string;
        deliveryLinks: string[];
      }) => unknown;
    }) =>
      milestone &&
        (
          milestone.status === "pending" ||
          milestone.status === "revision_requested"
        ) ? (
        <button
          type="button"
          onClick={() =>
            onSubmitMilestone({
              milestoneId: milestone.id,
              summary:
                "Milestone work is ready for buyer review.",
              deliveryLinks: [
                "https://example.com/milestone",
              ],
            })
          }
        >
          Mock submit milestone: {milestone.title}
        </button>
      ) : null,
  })
);

const request = {
  id: "request-1",
  listing_id: "listing-1",
  buyer_user_id: "buyer-1",
  creator_user_id: "creator-1",
  status: "submitted",
  message: "Legacy request message.",
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

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/creator/requests/request-1"]}>
      <Routes>
        <Route
          path="/creator/requests/:id"
          element={<CreatorRequestDetails />}
        />
      </Routes>
    </MemoryRouter>
  );

// Creator forms open in a full-page sheet from a launcher inside their section.
const openForm = (launchLabel: string) => {
  const launcher = screen.getByRole("button", { name: launchLabel, hidden: true });
  const section = launcher.closest("section");
  const toggle = section?.querySelector("h2 button");

  if (toggle && toggle.getAttribute("aria-expanded") !== "true") {
    fireEvent.click(toggle);
  }

  fireEvent.click(screen.getByRole("button", { name: launchLabel }));
};

describe("<CreatorRequestDetails />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request,
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.updateRequestStatus.mockResolvedValue(undefined);

    mocks.useListingRequestAgreement.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
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

    mocks.createChangeOrder.mockResolvedValue(undefined);

    mocks.sendDraftChangeOrder.mockResolvedValue(
      undefined
    );

    mocks.useListingRequestFinalDeliveries.mockReturnValue(
      {
        data: [],
        isLoading: false,
        error: null,
      }
    );

    mocks.createFinalDelivery.mockResolvedValue(
      undefined
    );

    mocks.sendDraftFinalDelivery.mockResolvedValue(
      undefined
    );

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

    mocks.submitMilestone.mockResolvedValue(undefined);

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

  it("renders structured buyer request details for the creator", () => {
    renderPage();

    // A submitted request opens the buyer request section with its accept/decline controls.
    expect(screen.getByRole("button", { name: /Buyer request/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getByRole("button", { name: "Accept request" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Next step" })).getByText("Next step for you")
    ).toBeInTheDocument();

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

    expect(screen.getByText("@buyeruser")).toBeInTheDocument();
    expect(screen.getByText("Conversation thread loaded")).toBeInTheDocument();
  });

  it("renders the agreement builder for an accepted request without an agreement", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    renderPage();
    openForm("Create agreement");

    expect(screen.getByText("Mock no agreement summary")).toBeInTheDocument();
    expect(screen.getByText("Mock agreement builder")).toBeInTheDocument();
  });

  it("creates an agreement from the creator request detail page", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    renderPage();
    openForm("Create agreement");

    screen.getByRole("button", { name: "Mock agreement builder" }).click();

    expect(mocks.createAgreement).toHaveBeenCalledWith({
      listingRequestId: "request-1",
    });
  });

  it("does not render the agreement builder when an agreement already exists", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(screen.getByText("Mock agreement summary")).toBeInTheDocument();
    expect(screen.queryByText("Mock agreement builder")).not.toBeInTheDocument();
  });

  it("sends a draft agreement from the creator request detail page", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "draft",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    screen.getByRole("button", { name: "Send draft to buyer" }).click();

    expect(mocks.sendDraftAgreement).toHaveBeenCalledWith({
      agreementId: "agreement-1",
    });
  });

  it("passes accepted request and buyer accepted agreement state into the work readiness card", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
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
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
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
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "sent",
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
  });

  it("posts a progress update from the creator request detail page", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
      },
      isLoading: false,
      error: null,
    });

    renderPage();
    openForm("Post update");

    screen
      .getByRole("button", {
        name: "Mock post progress update",
      })
      .click();

    expect(
      mocks.createProgressUpdate
    ).toHaveBeenCalledWith({
      agreementId: "agreement-1",
      updateKind: "progress",
      title: "Initial concepts completed",
      body:
        "The first concept sketches are ready for review.",
      progressPercent: 35,
    });
  });

  it("does not show the progress update form while starting payment is required", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "payment_required",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.queryByRole("button", {
        name: "Mock post progress update",
      })
    ).not.toBeInTheDocument();
  });

  it("passes the agreement and progress updates into the creator schedule card", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
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

  it("shows the creator schedule card while starting payment is pending", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "payment_required",
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
      screen.queryByRole("button", {
        name: "Mock post progress update",
      })
    ).not.toBeInTheDocument();
  });

  it("renders change-order history and the builder for an accepted agreement", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
        currency: "cad",
        total_amount: 300,
        adjusted_estimated_completion_at:
          "2026-06-20T12:00:00.000Z",
      },
      isLoading: false,
      error: null,
    });

    renderPage();
    openForm("Propose change");

    expect(
      mocks.useListingRequestChangeOrders
    ).toHaveBeenCalledWith("request-1");

    expect(
      screen.getByText(
        "Mock change-order summary: creator / 0"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Mock change-order builder",
      })
    ).toBeInTheDocument();
  });

  it("creates a change order from the creator request page", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
        currency: "cad",
        total_amount: 300,
        adjusted_estimated_completion_at:
          "2026-06-20T12:00:00.000Z",
      },
      isLoading: false,
      error: null,
    });

    renderPage();
    openForm("Propose change");

    screen
      .getByRole("button", {
        name: "Mock change-order builder",
      })
      .click();

    expect(mocks.createChangeOrder).toHaveBeenCalledWith({
      agreementId: "agreement-1",
    });
  });

  it.each(["draft", "sent"] as const)(
    "hides the builder while a %s change order is pending",
    (status) => {
      mocks.useCreatorRequest.mockReturnValue({
        data: {
          request: {
            ...request,
            status: "accepted",
          },
          buyer: {
            user_id: "buyer-1",
            handle: "buyeruser",
            display_name: "Buyer User",
            avatar_url: null,
          },
        },
        isLoading: false,
        error: null,
      });

      mocks.useListingRequestAgreement.mockReturnValue({
        data: {
          id: "agreement-1",
          status: "buyer_accepted",
          starting_payment_status: "paid",
          currency: "cad",
          total_amount: 300,
          adjusted_estimated_completion_at:
            "2026-06-20T12:00:00.000Z",
        },
        isLoading: false,
        error: null,
      });

      mocks.useListingRequestChangeOrders.mockReturnValue({
        data: [
          {
            id: "change-order-1",
            status,
          },
        ],
        isLoading: false,
        error: null,
      });

      renderPage();

      expect(
        screen.getByText(
          "Mock change-order summary: creator / 1"
        )
      ).toBeInTheDocument();

      expect(
        screen.queryByRole("button", {
          name: "Mock change-order builder",
        })
      ).not.toBeInTheDocument();
    }
  );

  it("sends a draft change order from the creator request page", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
        currency: "cad",
        total_amount: 300,
        adjusted_estimated_completion_at:
          "2026-06-20T12:00:00.000Z",
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestChangeOrders.mockReturnValue({
      data: [
        {
          id: "change-order-1",
          status: "draft",
          title: "Additional animated overlay",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    screen
      .getByRole("button", {
        name: "Mock send draft change order",
      })
      .click();

    expect(
      mocks.sendDraftChangeOrder
    ).toHaveBeenCalledWith({
      changeOrderId: "change-order-1",
    });

    expect(
      screen.queryByRole("button", {
        name: "Mock change-order builder",
      })
    ).not.toBeInTheDocument();
  });

  it("renders final-delivery history and the builder for a work-ready agreement", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
      },
      isLoading: false,
      error: null,
    });

    renderPage();
    openForm("Create delivery");

    expect(
      mocks.useListingRequestFinalDeliveries
    ).toHaveBeenCalledWith("request-1");

    expect(
      screen.getByText(
        "Mock final delivery summary: creator / 0 / ready / no error"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Mock final delivery builder",
      })
    ).toBeInTheDocument();
  });

  it("creates a final delivery from the creator request page", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
      },
      isLoading: false,
      error: null,
    });

    renderPage();
    openForm("Create delivery");

    screen
      .getByRole("button", {
        name: "Mock final delivery builder",
      })
      .click();

    expect(
      mocks.createFinalDelivery
    ).toHaveBeenCalledWith({
      agreementId: "agreement-1",
    });
  });

  it.each([
    "draft",
    "submitted",
    "buyer_approved",
  ] as const)(
    "hides the final-delivery builder when the latest delivery is %s",
    (status) => {
      mocks.useCreatorRequest.mockReturnValue({
        data: {
          request: {
            ...request,
            status: "accepted",
          },
          buyer: {
            user_id: "buyer-1",
            handle: "buyeruser",
            display_name: "Buyer User",
            avatar_url: null,
          },
        },
        isLoading: false,
        error: null,
      });

      mocks.useListingRequestAgreement.mockReturnValue({
        data: {
          id: "agreement-1",
          status: "buyer_accepted",
          starting_payment_status: "paid",
        },
        isLoading: false,
        error: null,
      });

      mocks.useListingRequestFinalDeliveries.mockReturnValue(
        {
          data: [
            {
              id: "final-delivery-1",
              status,
            },
          ],
          isLoading: false,
          error: null,
        }
      );

      renderPage();

      expect(
        screen.getByText(
          "Mock final delivery summary: creator / 1 / ready / no error"
        )
      ).toBeInTheDocument();

      expect(
        screen.queryByRole("button", {
          name: "Mock final delivery builder",
        })
      ).not.toBeInTheDocument();
    }
  );

  it("allows a new final delivery after revisions are requested", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestFinalDeliveries.mockReturnValue(
      {
        data: [
          {
            id: "final-delivery-1",
            status: "revision_requested",
          },
        ],
        isLoading: false,
        error: null,
      }
    );

    renderPage();
    openForm("Create delivery");

    expect(
      screen.getByRole("button", {
        name: "Mock final delivery builder",
      })
    ).toBeInTheDocument();
  });

  it("submits a final-delivery draft from the creator request page", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestFinalDeliveries.mockReturnValue(
      {
        data: [
          {
            id: "final-delivery-1",
            status: "draft",
            title: "Final overlay delivery",
          },
        ],
        isLoading: false,
        error: null,
      }
    );

    renderPage();

    screen
      .getByRole("button", {
        name: "Mock submit final-delivery draft",
      })
      .click();

    expect(
      mocks.sendDraftFinalDelivery
    ).toHaveBeenCalledWith({
      finalDeliveryId: "final-delivery-1",
    });

    expect(
      screen.queryByRole("button", {
        name: "Mock final delivery builder",
      })
    ).not.toBeInTheDocument();
  });

  it("makes a completed creator project read-only", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "completed",
          completed_at:
            "2026-06-09T15:00:00.000Z",
          completed_by_user_id: "buyer-1",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
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
      screen.getByText("Conversation is read-only")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Completed projects are read-only because the buyer approved the final delivery."
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Accept request",
      })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Decline request",
      })
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "← Back to creator requests",
      })
    ).toHaveAttribute(
      "href",
      "/creator/requests/completed"
    );

    // The completed date is part of the header meta row.
    expect(
      screen.getByText(/Jun 9, 2026/)
    ).toBeInTheDocument();
  });

  it("hides the final-delivery builder until milestone payments are paid", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "not_required",
        payment_structure: "milestone_payments",
        listing_request_payment_schedule_items: [
          {
            id: "payment-1",
            payment_timing:
              "due_at_milestone_approval",
            status: "paid",
            amount: 100,
          },
          {
            id: "payment-2",
            payment_timing:
              "due_at_milestone_approval",
            status: "payment_required",
            amount: 150,
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.queryByRole("button", {
        name: "Mock final delivery builder",
      })
    ).not.toBeInTheDocument();

    expect(
      screen.getByText(
        "All milestone payments must be confirmed before final delivery can be created."
      )
    ).toBeInTheDocument();
  });

  it("shows the final-delivery builder after all milestone payments are paid", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "not_required",
        payment_structure: "milestone_payments",
        listing_request_payment_schedule_items: [
          {
            id: "payment-1",
            payment_timing:
              "due_at_milestone_approval",
            status: "paid",
            amount: 100,
          },
          {
            id: "payment-2",
            payment_timing:
              "due_at_milestone_approval",
            status: "paid",
            amount: 150,
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    renderPage();
    openForm("Create delivery");

    expect(
      screen.getByRole("button", {
        name: "Mock final delivery builder",
      })
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        /Final delivery is locked until every milestone payment has been confirmed./
      )
    ).not.toBeInTheDocument();
  });

  it("renders milestone history and submission form for milestone agreements", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "not_required",
        payment_structure: "milestone_payments",
        listing_request_payment_schedule_items: [
          {
            id: "payment-1",
            payment_timing:
              "due_at_milestone_approval",
            status: "pending",
            amount: 100,
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestMilestones.mockReturnValue({
      data: [
        {
          id: "milestone-1",
          status: "pending",
          title: "Initial design direction",
          sort_order: 0,
        },
      ],
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestMilestoneSubmissions.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderPage();
    openForm("Submit milestone");

    expect(
      mocks.useListingRequestMilestones
    ).toHaveBeenCalledWith("request-1");

    expect(
      mocks.useListingRequestMilestoneSubmissions
    ).toHaveBeenCalledWith("request-1");

    expect(
      screen.getByText(
        "Mock milestone summary: creator / 1 / 0 / ready / no error"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Mock submit milestone: Initial design direction",
      })
    ).toBeInTheDocument();
  });

  it("submits the active milestone from the creator request page", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "not_required",
        payment_structure: "milestone_payments",
        listing_request_payment_schedule_items: [
          {
            id: "payment-1",
            payment_timing:
              "due_at_milestone_approval",
            status: "pending",
            amount: 100,
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestMilestones.mockReturnValue({
      data: [
        {
          id: "milestone-1",
          status: "pending",
          title: "Initial design direction",
          sort_order: 0,
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();
    openForm("Submit milestone");

    screen
      .getByRole("button", {
        name: "Mock submit milestone: Initial design direction",
      })
      .click();

    expect(mocks.submitMilestone).toHaveBeenCalledWith({
      milestoneId: "milestone-1",
      summary:
        "Milestone work is ready for buyer review.",
      deliveryLinks: [
        "https://example.com/milestone",
      ],
    });
  });

  it("does not query milestones before the buyer accepts the agreement", () => {
    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "sent",
        starting_payment_status: "pending",
        payment_structure: "milestone_payments",
        listing_request_payment_schedule_items: [],
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      mocks.useListingRequestMilestones
    ).toHaveBeenCalledWith(null);

    expect(
      mocks.useListingRequestMilestoneSubmissions
    ).toHaveBeenCalledWith(null);

    expect(
      screen.queryByText(/Mock milestone summary:/)
    ).not.toBeInTheDocument();
  });

  it("explains when the active milestone is waiting for buyer review", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "not_required",
        payment_structure: "milestone_payments",
        listing_request_payment_schedule_items: [
          {
            id: "payment-1",
            payment_timing:
              "due_at_milestone_approval",
            status: "pending",
            amount: 100,
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestMilestones.mockReturnValue({
      data: [
        {
          id: "milestone-1",
          status: "submitted",
          title: "Initial design direction",
          sort_order: 0,
        },
        {
          id: "milestone-2",
          status: "pending",
          title: "Completed project package",
          sort_order: 1,
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText(
        /Milestone 1: Initial design direction is waiting for buyer review./
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Mock submit milestone: Initial design direction",
      })
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Mock submit milestone: Completed project package",
      })
    ).not.toBeInTheDocument();
  });

  it("explains when the active milestone is waiting for payment confirmation", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "not_required",
        payment_structure: "milestone_payments",
        listing_request_payment_schedule_items: [
          {
            id: "payment-1",
            payment_timing:
              "due_at_milestone_approval",
            status: "payment_required",
            amount: 100,
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestMilestones.mockReturnValue({
      data: [
        {
          id: "milestone-1",
          status: "payment_required",
          title: "Initial design direction",
          sort_order: 0,
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText(
        /Milestone 1: Initial design direction has been approved by the buyer and is waiting for admin payment confirmation./
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Mock submit milestone: Initial design direction",
      })
    ).not.toBeInTheDocument();
  });

  it("explains when a previous final delivery is still active", () => {
    mocks.useCreatorRequest.mockReturnValue({
      data: {
        request: {
          ...request,
          status: "accepted",
        },
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
        },
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestAgreement.mockReturnValue({
      data: {
        id: "agreement-1",
        listing_request_id: "request-1",
        status: "buyer_accepted",
        payment_structure: "deposit_balance",
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
          title: "Final package",
          created_at: "2026-06-18T12:00:00.000Z",
          updated_at: "2026-06-18T12:00:00.000Z",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.getByText(
        "A new final delivery can only be created after the previous delivery is revised or cancelled."
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Mock final delivery builder",
      })
    ).not.toBeInTheDocument();
  });
});