import {
  render,
  screen,
} from "@testing-library/react";
import {
  describe,
  expect,
  it,
} from "vitest";

import ListingRequestChangeOrderSummary from "../listingRequests/changeOrders/ListingRequestChangeOrderSummary";
import type {
  ListingRequestChangeOrderRow,
} from "../../hooks/creatorRequests/useListingRequestChangeOrders";

const createChangeOrder = (
  overrides?: Partial<ListingRequestChangeOrderRow>
): ListingRequestChangeOrderRow => ({
  id: "change-order-1",
  listing_request_id: "request-1",
  agreement_id: "agreement-1",
  creator_user_id: "creator-1",
  buyer_user_id: "buyer-1",
  version_number: 1,
  status: "sent",
  title: "Additional animated overlay",
  summary:
    "Add one animated overlay and extend delivery by five days.",
  changes_scope: true,
  changes_price: true,
  changes_timeline: true,
  changes_deliverables: true,
  changes_payment_schedule: false,
  changes_milestones: false,
  price_delta: 150,
  revised_total_amount: 450,
  timeline_delta_days: 5,
  revised_completion_at:
    "2026-06-25T12:00:00.000Z",
  before_snapshot: {
    currency: "cad",
  },
  proposed_snapshot: {
    currency: "cad",
  },
  buyer_response_reason: null,
  sent_at: "2026-06-08T12:00:00.000Z",
  buyer_accepted_at: null,
  buyer_declined_at: null,
  cancelled_at: null,
  superseded_at: null,
  applied_at: null,
  created_at: "2026-06-08T12:00:00.000Z",
  updated_at: "2026-06-08T12:00:00.000Z",
  ...overrides,
});

describe("ListingRequestChangeOrderSummary", () => {
  it("renders the loading state", () => {
    render(
      <ListingRequestChangeOrderSummary
        changeOrders={[]}
        viewer="creator"
        isLoading
      />
    );

    expect(
      screen.getByText(
        "Loading project change orders…"
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        "No project change orders have been created for this commission yet."
      )
    ).not.toBeInTheDocument();
  });

  it("renders the empty state", () => {
    render(
      <ListingRequestChangeOrderSummary
        changeOrders={[]}
        viewer="creator"
      />
    );

    expect(
      screen.getByText(
        "No project change orders have been created for this commission yet."
      )
    ).toBeInTheDocument();
  });

  it("renders query errors", () => {
    render(
      <ListingRequestChangeOrderSummary
        changeOrders={[]}
        viewer="creator"
        error={
          new Error(
            "Project change orders are unavailable."
          )
        }
      />
    );

    expect(
      screen.getByText(
        "Project change orders are unavailable."
      )
    ).toBeInTheDocument();
  });

  it("renders change-order impacts and revised values", () => {
    render(
      <ListingRequestChangeOrderSummary
        changeOrders={[createChangeOrder()]}
        viewer="buyer"
      />
    );

    expect(
      screen.getByText("Additional animated overlay")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Add one animated overlay and extend delivery by five days."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("Awaiting buyer review")
    ).toBeInTheDocument();

    expect(screen.getByText("Scope")).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
    expect(screen.getByText("Timeline")).toBeInTheDocument();

    expect(screen.getByText("+$150.00")).toBeInTheDocument();
    expect(screen.getByText("$450.00")).toBeInTheDocument();
    expect(
      screen.getByText("+5 calendar days")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Jun 25, 2026")
    ).toBeInTheDocument();
  });

  it("renders newest versions first", () => {
    render(
      <ListingRequestChangeOrderSummary
        changeOrders={[
          createChangeOrder({
            id: "older-change-order",
            version_number: 1,
            title: "Older change order",
          }),
          createChangeOrder({
            id: "newer-change-order",
            version_number: 2,
            title: "Newer change order",
          }),
        ]}
        viewer="creator"
      />
    );

    const headings = screen.getAllByRole("heading", {
      level: 3,
    });

    expect(headings[0]).toHaveTextContent(
      "Newer change order"
    );

    expect(headings[1]).toHaveTextContent(
      "Older change order"
    );
  });

  it("hides unsent drafts from buyers", () => {
    render(
      <ListingRequestChangeOrderSummary
        changeOrders={[
          createChangeOrder({
            status: "draft",
            sent_at: null,
            title: "Private creator draft",
          }),
        ]}
        viewer="buyer"
      />
    );

    expect(
      screen.queryByText("Private creator draft")
    ).not.toBeInTheDocument();

    expect(
      screen.getByText(
        "No project change orders have been created for this commission yet."
      )
    ).toBeInTheDocument();
  });

  it("shows drafts to creators", () => {
    render(
      <ListingRequestChangeOrderSummary
        changeOrders={[
          createChangeOrder({
            status: "draft",
            sent_at: null,
            title: "Private creator draft",
          }),
        ]}
        viewer="creator"
      />
    );

    expect(
      screen.getByText("Private creator draft")
    ).toBeInTheDocument();

    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders the buyer response reason", () => {
    render(
      <ListingRequestChangeOrderSummary
        changeOrders={[
          createChangeOrder({
            status: "buyer_declined",
            buyer_response_reason:
              "The additional animation is outside my budget.",
            buyer_declined_at:
              "2026-06-09T12:00:00.000Z",
          }),
        ]}
        viewer="creator"
      />
    );

    expect(
      screen.getByText(
        /The additional animation is outside my budget/
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("Declined by buyer")
    ).toBeInTheDocument();
  });
});