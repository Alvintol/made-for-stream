import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ListingRequestAgreementBuyerActions from "../listingRequests/agreements/ListingRequestAgreementBuyerActions";
import type { ListingRequestAgreementRow } from "../../hooks/creatorRequests/useListingRequestAgreement";

const agreement: ListingRequestAgreementRow = {
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
  last_progress_update_at: null,
  next_progress_update_due_at: null,
  progress_update_requirement_satisfied_at: null,
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
    {
      id: "item-2",
      agreement_id: "agreement-1",
      title: "Optional animated version",
      description: "Optional animated add-on.",
      item_type: "optional_addon",
      price_amount: 45,
      timeline_impact_days: 2,
      payment_timing: "optional_not_selected",
      is_required: false,
      is_selected: false,
      sort_order: 1,
      created_at: "2026-05-24T12:00:00.000Z",
      updated_at: "2026-05-24T12:00:00.000Z",
    },
  ],
  listing_request_payment_schedule_items: [
    {
      id: "payment-1",
      agreement_id: "agreement-1",
      agreement_item_id: null,
      change_order_id: null,
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
};

describe("<ListingRequestAgreementBuyerActions />", () => {
  const onAccept = vi.fn();
  const onDecline = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onAccept.mockResolvedValue(undefined);
    onDecline.mockResolvedValue(undefined);
  });

  it("does not render when no sent agreement exists", () => {
    const { container } = render(
      <ListingRequestAgreementBuyerActions
        agreement={null}
        isPending={false}
        error={null}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("disables accepting until every required acknowledgement is checked", async () => {
    render(
      <ListingRequestAgreementBuyerActions
        agreement={agreement}
        isPending={false}
        error={null}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    );

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
      expect(onAccept).toHaveBeenCalledWith([
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
      ], true);
    });
  });

  it("keeps accepting disabled until the buyer separately asks for an early start", () => {
    render(
      <ListingRequestAgreementBuyerActions
        agreement={agreement}
        isPending={false}
        error={null}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    );

    const earlyStart = screen.getByRole("checkbox", {
      name: /I expressly request that the creator begin work now/,
    });

    screen
      .getAllByRole("checkbox")
      .filter((checkbox) => checkbox !== earlyStart)
      .forEach((checkbox) => {
        fireEvent.click(checkbox);
      });

    const acceptButton = screen.getByRole("button", {
      name: "Accept project agreement",
    });

    expect(earlyStart).not.toBeChecked();
    expect(acceptButton).toBeDisabled();

    fireEvent.click(earlyStart);

    expect(acceptButton).toBeEnabled();
  });

  it("shows the agreement with one \"I understand\" box under each section, and no separate list", () => {
    render(
      <ListingRequestAgreementBuyerActions
        agreement={agreement}
        isPending={false}
        error={null}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    );

    const sectionBoxes = [
      "I understand the terms above.",
      "I understand the scope above.",
      "I understand the scope checklist above.",
      "I understand the payment schedule above.",
      "I understand the policies above.",
    ];

    sectionBoxes.forEach((label) => {
      expect(screen.getByRole("checkbox", { name: label })).not.toBeChecked();
    });
    // The five sections and the separate early-start request, nothing else.
    expect(screen.getAllByRole("checkbox")).toHaveLength(6);
    expect(screen.queryByText(/I understand this payment item/)).not.toBeInTheDocument();

    // The rules a section's box stands for are written out in that section.
    expect(
      screen.getByText("Final files or deliverables may be held until required payments are complete.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Any change to scope, price, timeline, deliverables or payments needs an accepted change order."
      )
    ).toBeInTheDocument();

    expect(screen.getByRole("status")).toHaveTextContent("0 of 5 confirmed");

    fireEvent.click(screen.getByRole("checkbox", { name: sectionBoxes[3] }));
    expect(screen.getByRole("status")).toHaveTextContent("1 of 5 confirmed");

    // Unticking a section takes back everything it stood for.
    fireEvent.click(screen.getByRole("checkbox", { name: sectionBoxes[3] }));
    expect(screen.getByRole("status")).toHaveTextContent("0 of 5 confirmed");

    sectionBoxes.forEach((label) => fireEvent.click(screen.getByRole("checkbox", { name: label })));
    expect(screen.getByRole("status")).toHaveTextContent(
      "You have confirmed every section of the agreement above."
    );
    // Still not enough without the early-start request.
    expect(screen.getByRole("button", { name: "Accept project agreement" })).toBeDisabled();
  });

  it("lets the buyer decline without checking acknowledgements", async () => {
    render(
      <ListingRequestAgreementBuyerActions
        agreement={agreement}
        isPending={false}
        error={null}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Decline agreement" }));

    await waitFor(() => {
      expect(onDecline).toHaveBeenCalled();
    });

    expect(onAccept).not.toHaveBeenCalled();
  });

  it("renders response errors", () => {
    render(
      <ListingRequestAgreementBuyerActions
        agreement={agreement}
        isPending={false}
        error={new Error("You must acknowledge every required agreement item.")}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    );

    expect(
      screen.getByText("You must acknowledge every required agreement item.")
    ).toBeInTheDocument();
  });
});