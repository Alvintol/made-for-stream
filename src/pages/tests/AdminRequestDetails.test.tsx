import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminRequestDetails from "../admin/AdminRequestDetails";

const mocks = vi.hoisted(() => ({
  useAdminRequest: vi.fn(),
  useListingRequestAgreement: vi.fn(),
  confirmStartingPayment: vi.fn(),
  useListingRequestProgressUpdates: vi.fn(),
  useListingRequestChangeOrders: vi.fn(),
  confirmChangeOrderPayment: vi.fn(),
  useListingRequestFinalDeliveries: vi.fn(),
  confirmFinalBalancePayment: vi.fn(),
  useListingRequestMilestones: vi.fn(),
  useListingRequestMilestoneSubmissions: vi.fn(),
  confirmMilestonePayment: vi.fn(),
  useListingRequestCancellationProposal: vi.fn(),
}));

vi.mock("../../hooks/admin/useAdminRequest", () => ({
  useAdminRequest: mocks.useAdminRequest,
}));

// Sprint 5 additions to this page's "payments" section -- neither refund
// panel is under test here, so both are given inert defaults matching the
// common case (nothing refundable, no outstanding recovery balance).
vi.mock("../../hooks/payments/useListingRequestPayments", () => ({
  useListingRequestPayments: () => ({ data: [], isLoading: false }),
}));

vi.mock("../../hooks/admin/useAdminIssueListingRequestPaymentRefund", () => ({
  useAdminIssueListingRequestPaymentRefund: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("../../hooks/payments/useCreatorRecoveryBalance", () => ({
  useCreatorRecoveryBalance: () => ({ data: null }),
  useCreatorRecoveryEntries: () => ({ data: [] }),
}));

vi.mock("../../hooks/admin/useAdminWriteOffCreatorRecoveryBalance", () => ({
  useAdminWriteOffCreatorRecoveryBalance: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("../../hooks/creatorRequests/useListingRequestNotices", () => ({
  useListingRequestNotices: () => ({ data: [], isLoading: false }),
}));

vi.mock("../../hooks/creatorRequests/useListingRequestEarlyReviewFlags", () => ({
  useListingRequestEarlyReviewFlags: () => ({ data: [] }),
}));

vi.mock("../../hooks/admin/useAdminDecideListingRequestEarlyReview", () => ({
  useAdminDecideListingRequestEarlyReview: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../hooks/admin/useAdminCloseListingRequestForNonResponse", () => ({
  useAdminCloseListingRequestForNonResponse: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock(
  "../../hooks/creatorRequests/useListingRequestCancellationProposal",
  () => ({
    useListingRequestCancellationProposal:
      mocks.useListingRequestCancellationProposal,
  })
);

vi.mock(
  "../../components/listingRequests/conversations/RequestConversationThread",
  () => ({
    default: () => (
      <div>Conversation thread loaded</div>
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
  "../../hooks/admin/useAdminConfirmListingRequestStartingPayment",
  () => ({
    useAdminConfirmListingRequestStartingPayment:
      () => ({
        mutateAsync:
          mocks.confirmStartingPayment,
        isPending: false,
        error: null,
      }),
  })
);

vi.mock(
  "../../components/listingRequests/agreements/ListingRequestAgreementSummary",
  () => ({
    default: () => (
      <div>Mock agreement summary</div>
    ),
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
  "../../components/listingRequests/payments/ListingRequestAgreementAdminPaymentActions",
  () => ({
    default: ({
      agreement,
      onConfirmPayment,
    }: {
      agreement: {
        id: string;
      } | null;
      onConfirmPayment: (
        agreementId: string
      ) => void;
    }) =>
      agreement ? (
        <button
          type="button"
          onClick={() =>
            onConfirmPayment(agreement.id)
          }
        >
          Mock confirm starting payment
        </button>
      ) : null,
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
    }) => {
      const hasError =
        error !== null &&
        error !== undefined;

      return (
        <div>
          Mock progress timeline:{" "}
          {updates.length} /{" "}
          {isLoading
            ? "loading"
            : "ready"}{" "}
          /{" "}
          {hasError
            ? "error"
            : "no error"}
        </div>
      );
    },
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
      agreement?.status ===
        "buyer_accepted" ? (
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
  "../../hooks/admin/useAdminConfirmListingRequestChangeOrderPayment",
  () => ({
    useAdminConfirmListingRequestChangeOrderPayment:
      () => ({
        mutateAsync:
          mocks.confirmChangeOrderPayment,
        isPending: false,
        error: null,
      }),
  })
);

vi.mock(
  "../../components/listingRequests/payments/ListingRequestChangeOrderPaymentAdminActions",
  () => ({
    default: ({
      agreement,
      onConfirmPayment,
    }: {
      agreement: {
        listing_request_payment_schedule_items?: Array<{
          id: string;
          change_order_id:
          | string
          | null;
          payment_timing: string;
          status: string;
        }>;
      } | null;
      onConfirmPayment: (
        paymentScheduleItemId: string
      ) => void;
    }) => {
      const paymentItem =
        agreement?.listing_request_payment_schedule_items?.find(
          (item) =>
            item.change_order_id &&
            item.payment_timing ===
            "due_on_change_order_acceptance" &&
            item.status ===
            "payment_required"
        ) ?? null;

      return paymentItem ? (
        <button
          type="button"
          onClick={() =>
            onConfirmPayment(
              paymentItem.id
            )
          }
        >
          Mock confirm change-order
          payment
        </button>
      ) : null;
    },
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
  "../../hooks/admin/useAdminConfirmListingRequestFinalBalancePayment",
  () => ({
    useAdminConfirmListingRequestFinalBalancePayment:
      () => ({
        mutateAsync:
          mocks.confirmFinalBalancePayment,
        isPending: false,
        error: null,
      }),
  })
);

vi.mock(
  "../../components/listingRequests/payments/ListingRequestFinalBalancePaymentAdminActions",
  () => ({
    default: ({
      agreement,
      onConfirmPayment,
    }: {
      agreement: {
        listing_request_payment_schedule_items?: Array<{
          id: string;
          amount: number;
          payment_timing: string;
          status: string;
        }>;
      } | null;
      onConfirmPayment: (
        paymentScheduleItemId: string
      ) => void;
    }) => {
      const paymentItem =
        agreement?.listing_request_payment_schedule_items?.find(
          (item) =>
            item.payment_timing ===
            "due_before_final_release" &&
            item.status ===
            "payment_required" &&
            item.amount > 0
        ) ?? null;

      return paymentItem ? (
        <button
          type="button"
          onClick={() =>
            onConfirmPayment(
              paymentItem.id
            )
          }
        >
          Mock confirm final-balance
          payment
        </button>
      ) : null;
    },
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
  "../../hooks/admin/useAdminConfirmListingRequestMilestonePayment",
  () => ({
    useAdminConfirmListingRequestMilestonePayment:
      () => ({
        mutateAsync:
          mocks.confirmMilestonePayment,
        isPending: false,
        error: null,
      }),
  })
);

vi.mock(
  "../../components/listingRequests/payments/ListingRequestMilestonePaymentAdminActions",
  () => ({
    default: ({
      milestones,
      onConfirmPayment,
    }: {
      milestones: Array<{
        id: string;
        status: string;
        payment_schedule_item_id: string;
      }>;
      onConfirmPayment: (
        paymentScheduleItemId: string
      ) => void;
    }) => {
      const milestone =
        milestones.find(
          (item) =>
            item.status ===
            "payment_required"
        ) ?? null;

      return milestone ? (
        <button
          type="button"
          onClick={() =>
            onConfirmPayment(
              milestone.payment_schedule_item_id
            )
          }
        >
          Mock confirm milestone payment
        </button>
      ) : null;
    },
  })
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

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/requests/request-1"]}>
      <Routes>
        <Route path="/admin/requests/:id" element={<AdminRequestDetails />} />
      </Routes>
    </MemoryRouter>
  );

describe("<AdminRequestDetails />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAdminRequest.mockReturnValue({
      data: {
        request,
        buyer: {
          user_id: "buyer-1",
          handle: "buyeruser",
          display_name: "Buyer User",
          avatar_url: null,
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

    mocks.confirmChangeOrderPayment.mockResolvedValue(
      undefined
    );

    mocks.useListingRequestFinalDeliveries.mockReturnValue(
      {
        data: [],
        isLoading: false,
        error: null,
      }
    );

    mocks.confirmFinalBalancePayment.mockResolvedValue(
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

    mocks.confirmMilestonePayment.mockResolvedValue(
      undefined
    );

    mocks.useListingRequestCancellationProposal.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
  });

  it("renders structured commission details for admin review", () => {
    renderPage();

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
    expect(screen.getByText("@creatoruser")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Custom Emote Pack" })).toBeInTheDocument();
    expect(screen.getAllByText("Custom Emote Pack")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "View listing revisions" })).toHaveAttribute(
      "href",
      "/admin/listing-revisions/listing-1"
    );
    expect(screen.getByText("Conversation thread loaded")).toBeInTheDocument();
  });

  it("confirms the starting payment from the admin commission detail page", () => {
    mocks.useAdminRequest.mockReturnValue({
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
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "payment_required",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    screen
      .getByRole("button", {
        name: "Mock confirm starting payment",
      })
      .click();

    expect(mocks.confirmStartingPayment).toHaveBeenCalledWith({
      agreementId: "agreement-1",
    });

    expect(
      screen.getByText(
        "Mock work readiness card: accepted / buyer_accepted"
      )
    ).toBeInTheDocument();
  });

  it("renders progress updates after the buyer accepts the agreement", () => {
    mocks.useAdminRequest.mockReturnValue({
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
    mocks.useAdminRequest.mockReturnValue({
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
        id: "agreement-1",
        status: "sent",
        starting_payment_status: "payment_required",
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

  it("passes the agreement and progress updates into the admin schedule card", () => {
    mocks.useAdminRequest.mockReturnValue({
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

  it("shows the admin schedule while starting payment is pending", () => {
    mocks.useAdminRequest.mockReturnValue({
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
      mocks.useListingRequestProgressUpdates
    ).toHaveBeenCalledWith("request-1");
  });

  it("does not show the admin schedule before buyer agreement acceptance", () => {
    mocks.useAdminRequest.mockReturnValue({
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
        id: "agreement-1",
        status: "sent",
        starting_payment_status: "payment_required",
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      screen.queryByText(/Mock progress schedule:/)
    ).not.toBeInTheDocument();

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

  it("renders change orders for admin review", () => {
    mocks.useAdminRequest.mockReturnValue({
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
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
      },
      isLoading: false,
      error: null,
    });

    mocks.useListingRequestChangeOrders.mockReturnValue({
      data: [
        {
          id: "change-order-1",
        },
        {
          id: "change-order-2",
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
        "Mock change-order summary: admin / 2 / ready / no error"
      )
    ).toBeInTheDocument();
  });

  it("confirms a pending change-order payment from the admin commission detail page", () => {
    mocks.useAdminRequest.mockReturnValue({
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
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
        listing_request_payment_schedule_items: [
          {
            id: "payment-2",
            change_order_id: "change-order-1",
            payment_timing: "due_on_change_order_acceptance",
            status: "payment_required",
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    screen
      .getByRole("button", {
        name: "Mock confirm change-order payment",
      })
      .click();

    expect(
      mocks.confirmChangeOrderPayment
    ).toHaveBeenCalledWith({
      paymentScheduleItemId: "payment-2",
    });
  });

  it("renders final deliveries for admin review", () => {
    mocks.useAdminRequest.mockReturnValue({
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
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
        listing_request_payment_schedule_items:
          [],
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
          {
            id: "final-delivery-2",
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
        "Mock final delivery summary: admin / 2 / ready / no error"
      )
    ).toBeInTheDocument();
  });

  it("confirms a pending final-balance payment from the admin commission page", () => {
    mocks.useAdminRequest.mockReturnValue({
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
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "paid",
        listing_request_payment_schedule_items: [
          {
            id: "payment-3",
            amount: 150,
            payment_timing:
              "due_before_final_release",
            status: "payment_required",
          },
        ],
      },
      isLoading: false,
      error: null,
    });

    renderPage();

    screen
      .getByRole("button", {
        name: "Mock confirm final-balance payment",
      })
      .click();

    expect(
      mocks.confirmFinalBalancePayment
    ).toHaveBeenCalledWith({
      paymentScheduleItemId: "payment-3",
    });
  });

  it("renders milestone history for admin review", () => {
    mocks.useAdminRequest.mockReturnValue({
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
        id: "agreement-1",
        status: "buyer_accepted",
        payment_structure: "milestone_payments",
        starting_payment_status: "not_required",
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

    mocks.useListingRequestMilestoneSubmissions.mockReturnValue({
      data: [
        {
          id: "submission-1",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(
      mocks.useListingRequestMilestones
    ).toHaveBeenCalledWith("request-1");

    expect(
      mocks.useListingRequestMilestoneSubmissions
    ).toHaveBeenCalledWith("request-1");

    expect(
      screen.getByText(
        "Mock milestone summary: admin / 2 / 1 / ready / no error"
      )
    ).toBeInTheDocument();
  });

  it("confirms a pending milestone payment from the admin commission page", () => {
    mocks.useAdminRequest.mockReturnValue({
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
        id: "agreement-1",
        status: "buyer_accepted",
        payment_structure: "milestone_payments",
        starting_payment_status: "not_required",
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
          payment_schedule_item_id:
            "payment-1",
        },
      ],
      isLoading: false,
      error: null,
    });

    renderPage();

    screen
      .getByRole("button", {
        name: "Mock confirm milestone payment",
      })
      .click();

    expect(
      mocks.confirmMilestonePayment
    ).toHaveBeenCalledWith({
      paymentScheduleItemId: "payment-1",
    });
  });
});