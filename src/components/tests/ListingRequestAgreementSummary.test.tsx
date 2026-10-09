import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ListingRequestAgreementSummary from "../listingRequests/agreements/ListingRequestAgreementSummary";
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
  listing_request_agreement_acknowledgements: [
    {
      id: "ack-1",
      agreement_id: "agreement-1",
      buyer_user_id: "buyer-1",
      acknowledgement_key: "agreement:scope_summary",
      acknowledgement_label: "I understand the project scope summary.",
      created_at: "2026-05-24T12:00:00.000Z",
    },
  ],
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
  listing_request_timeline_holds: [
    {
      id: "hold-1",
      listing_request_id: "request-1",
      agreement_id: "agreement-1",
      payment_schedule_item_id: null,
      reason: "agreement_acceptance_pending",
      started_at: "2026-05-24T12:00:00.000Z",
      ended_at: "2026-05-26T13:00:00.000Z",
      rounded_extension_days: 2,
      created_at: "2026-05-24T12:00:00.000Z",
      updated_at: "2026-05-26T13:00:00.000Z",
    },
  ],
};

describe("<ListingRequestAgreementSummary />", () => {
  it("renders an empty state when no agreement exists", () => {
    render(<ListingRequestAgreementSummary agreement={null} />);

    expect(
      screen.getByText("No project agreement has been created for this commission yet.")
    ).toBeInTheDocument();
  });

  it("renders the active project agreement details", () => {
    render(<ListingRequestAgreementSummary agreement={agreement} />);

    expect(screen.getByText("Awaiting buyer review")).toBeInTheDocument();
    expect(screen.getByText("Deposit + balance")).toBeInTheDocument();
    expect(screen.getByText("$250.00")).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(
      screen.getByText("Create a custom overlay package for the buyer.")
    ).toBeInTheDocument();
    expect(screen.getAllByText("Starting soon screen")).toHaveLength(2);
    expect(screen.getByText("BRB screen")).toBeInTheDocument();
    expect(screen.getAllByText("Deposit")).toHaveLength(2);
    expect(
      screen.getByText(
        "Additional animated screens require an accepted change order."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Includes +2 days from buyer-side holds.")
    ).toBeInTheDocument();
    expect(screen.getByText("Agreement acceptance pending")).toBeInTheDocument();
    expect(screen.getByText("Buyer confirmations")).toBeInTheDocument();
    expect(
      screen.getByText("I understand the project scope summary.")
    ).toBeInTheDocument();
    expect(screen.getByText(/Confirmed on/)).toBeInTheDocument();
  });

  it("says who each scope checklist line is for, using the buyer's own name", () => {
    const withBuyerLines = {
      ...agreement,
      listing_request_agreement_items: [
        ...agreement.listing_request_agreement_items,
        {
          ...agreement.listing_request_agreement_items[0],
          id: "item-provides",
          title: "Character reference sheet",
          description: null,
          item_type: "buyer_provides" as const,
          sort_order: 10,
        },
        {
          ...agreement.listing_request_agreement_items[0],
          id: "item-approves",
          title: "Sketches before colouring",
          description: null,
          item_type: "buyer_approves" as const,
          sort_order: 11,
        },
      ],
    };

    const { unmount } = render(
      <ListingRequestAgreementSummary agreement={withBuyerLines} buyerName="ImAllBeans" />
    );

    // A title can also appear as a deliverable chip; the checklist line is the list item.
    const lineFor = (title: string) =>
      screen
        .getAllByText(title)
        .map((node) => node.closest("li"))
        .find(Boolean) as HTMLElement;

    expect(lineFor("Character reference sheet")).toHaveTextContent("ImAllBeans provides");
    expect(lineFor("Sketches before colouring")).toHaveTextContent("ImAllBeans approves");
    expect(lineFor("Starting soon screen")).toHaveTextContent("Included");
    // The old wording said the same thing on every line and is gone.
    expect(screen.queryByText(/no extra charge/)).not.toBeInTheDocument();
    // The payment schedule still says when each payment is due.
    expect(screen.getByText("Due before work starts")).toBeInTheDocument();

    unmount();

    // Without a name to use, the line still says whose it is.
    render(<ListingRequestAgreementSummary agreement={withBuyerLines} />);
    expect(lineFor("Character reference sheet")).toHaveTextContent("The buyer provides");
  });

  it("has no confirmation boxes for anyone but a buyer reviewing it, and states the standing rules", () => {
    render(<ListingRequestAgreementSummary agreement={agreement} />);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.getByText("Time the project spends waiting on the buyer is added to this date.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Final files or deliverables may be held until required payments are complete.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Any change to scope, price, timeline, deliverables or payments needs an accepted change order."
      )
    ).toBeInTheDocument();
  });

  it("renders an active timeline hold warning", () => {
    render(
      <ListingRequestAgreementSummary
        agreement={{
          ...agreement,
          listing_request_timeline_holds: [
            {
              ...agreement.listing_request_timeline_holds[0],
              ended_at: null,
              rounded_extension_days: 0,
            },
          ],
        }}
      />
    );

    expect(
      screen.getByText(
        "This project is currently waiting on buyer action. The estimated completion date may be adjusted after the hold is resolved."
      )
    ).toBeInTheDocument();

    expect(screen.getByText("Currently active.")).toBeInTheDocument();
  });

  it("renders a loading state", () => {
    render(<ListingRequestAgreementSummary agreement={null} isLoading />);

    expect(screen.getByText("Loading project agreement…")).toBeInTheDocument();
  });
});