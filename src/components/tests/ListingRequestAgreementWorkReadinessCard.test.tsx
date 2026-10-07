import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ListingRequestAgreementWorkReadinessCard from "../listingRequests/agreements/ListingRequestAgreementWorkReadinessCard";
import type { ListingRequestAgreementRow } from "../../hooks/creatorRequests/useListingRequestAgreement";

const createAgreement = (
  overrides?: Partial<ListingRequestAgreementRow>
): ListingRequestAgreementRow =>
  ({
    id: "agreement-1",
    listing_request_id: "request-1",
    creator_user_id: "creator-1",
    buyer_user_id: "buyer-1",
    version_number: 1,
    status: "buyer_accepted",
    payment_structure: "deposit_balance",
    starting_payment_status: "payment_required",
    currency: "cad",
    base_amount: 300,
    total_amount: 300,
    deposit_amount: 100,
    estimated_start_at: null,
    estimated_completion_at: "2026-06-15T12:00:00.000Z",
    adjusted_estimated_completion_at: "2026-06-15T12:00:00.000Z",
    late_delivery_grace_days: 3,
    included_revision_count: 2,
    minimum_update_rule: "weekly_updates",
    first_update_due_days: 5,
    update_frequency_days: 7,
    scope_summary: "Create three custom emotes.",
    included_deliverables: ["Three PNG emotes"],
    additional_cost_policy: "Changes require an accepted change order.",
    revision_policy: "Two included revisions.",
    update_schedule_summary: "Weekly updates required.",
    sent_at: "2026-05-25T12:00:00.000Z",
    buyer_accepted_at: "2026-05-25T13:00:00.000Z",
    buyer_declined_at: null,
    superseded_at: null,
    cancelled_at: null,
    created_at: "2026-05-25T12:00:00.000Z",
    updated_at: "2026-05-25T13:00:00.000Z",
    listing_request_agreement_items: [],
    listing_request_payment_schedule_items: [],
    listing_request_timeline_holds: [],
    listing_request_agreement_acknowledgements: [],
    ...overrides,
  }) as ListingRequestAgreementRow;

describe("ListingRequestAgreementWorkReadinessCard", () => {
  it("does not render without an agreement", () => {
    render(
      <ListingRequestAgreementWorkReadinessCard
        requestStatus="accepted"
        agreement={null}
      />
    );

    expect(screen.queryByText("Work may begin")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Payment required before work starts")
    ).not.toBeInTheDocument();
  });

  it("does not render before the buyer accepts the agreement", () => {
    render(
      <ListingRequestAgreementWorkReadinessCard
        requestStatus="accepted"
        agreement={createAgreement({ status: "sent" })}
      />
    );

    expect(screen.queryByText("Work may begin")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Payment required before work starts")
    ).not.toBeInTheDocument();
  });

  it("shows that payment is required before work starts", () => {
    render(
      <ListingRequestAgreementWorkReadinessCard
        requestStatus="accepted"
        agreement={createAgreement()}
      />
    );

    expect(
      screen.getByText("Payment required before work starts")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "The buyer accepted the project agreement, but work should not begin until the required starting payment or deposit is marked paid."
      )
    ).toBeInTheDocument();

    expect(screen.getByText("Deposit + balance")).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
  });

  it("shows that work may begin when the starting payment is paid", () => {
    render(
      <ListingRequestAgreementWorkReadinessCard
        requestStatus="accepted"
        agreement={createAgreement({
          starting_payment_status: "paid",
          estimated_start_at: "2026-06-06T12:00:00.000Z",
        })}
      />
    );

    expect(screen.getByText("Work may begin")).toBeInTheDocument();
    expect(screen.getByText("Work start")).toBeInTheDocument();
    expect(screen.getByText("Jun 6, 2026")).toBeInTheDocument();

    expect(
      screen.getByText(
        "The buyer accepted the project agreement and the starting payment requirement is cleared."
      )
    ).toBeInTheDocument();

    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("shows that work may begin when no starting payment is required", () => {
    render(
      <ListingRequestAgreementWorkReadinessCard
        requestStatus="accepted"
        agreement={createAgreement({ starting_payment_status: "not_required" })}
      />
    );

    expect(screen.getByText("Work may begin")).toBeInTheDocument();
    expect(screen.getByText("Not required")).toBeInTheDocument();
    expect(screen.getByText("Available immediately")).toBeInTheDocument();
  });

  it("does not mark work ready when the commission is no longer accepted", () => {
    render(
      <ListingRequestAgreementWorkReadinessCard
        requestStatus="archived"
        agreement={createAgreement({ starting_payment_status: "paid" })}
      />
    );

    expect(
      screen.getByText("Payment required before work starts")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "This agreement was accepted, but the commission is no longer in an active accepted state."
      )
    ).toBeInTheDocument();
  });
});