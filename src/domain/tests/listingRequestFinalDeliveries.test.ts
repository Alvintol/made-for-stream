import { describe, expect, it } from "vitest";

import {
  canApproveListingRequestFinalDelivery,
  canApproveSubmittedListingRequestFinalDelivery,
  canBuyerRespondToListingRequestFinalDelivery,
  canCreateNextListingRequestFinalDelivery,
  canSubmitListingRequestFinalDelivery,
  getDraftListingRequestFinalDelivery,
  getHasAllMilestonePaymentsPaid,
  getLatestListingRequestFinalDelivery,
  getListingRequestFinalDeliveryApprovalBlockedReason,
  getListingRequestFinalDeliveryCreationBlockedReason,
  getListingRequestFinalDeliveryStatusLabel,
  getListingRequestFinalDeliveryStatusSummary,
  getListingRequestFinalDeliveryStatusTone,
  getSubmittedListingRequestFinalDelivery,
  isListingRequestFinalDeliveryBuyerVisible,
} from "../listings/listingRequestFinalDeliveries";

type FinalDeliveryAgreement = NonNullable<
  Parameters<typeof canCreateNextListingRequestFinalDelivery>[0]
>;

type FinalDeliveryRow =
  Parameters<typeof canCreateNextListingRequestFinalDelivery>[1][number];

const createAgreement = (
  overrides: Partial<FinalDeliveryAgreement> = {}
): FinalDeliveryAgreement =>
  ({
    status: "buyer_accepted",
    starting_payment_status: "paid",
    payment_structure: "deposit_balance",
    listing_request_payment_schedule_items: [],
    ...overrides,
  }) as FinalDeliveryAgreement;

const createFinalDelivery = (
  overrides: Partial<FinalDeliveryRow> = {}
): FinalDeliveryRow =>
  ({
    id: "final-delivery-1",
    listing_request_id: "request-1",
    agreement_id: "agreement-1",
    creator_user_id: "creator-1",
    buyer_user_id: "buyer-1",
    status: "submitted",
    title: "Final delivery",
    summary: "Final delivery is ready.",
    delivery_links: [],
    revision_request_reason: null,
    submitted_at: "2026-06-09T12:00:00.000Z",
    buyer_approved_at: null,
    superseded_at: null,
    cancelled_at: null,
    created_at: "2026-06-09T12:00:00.000Z",
    updated_at: "2026-06-09T12:00:00.000Z",
    ...overrides,
  }) as FinalDeliveryRow;

describe("listing commission final deliveries", () => {
  it("maps delivery statuses to display labels", () => {
    expect(
      getListingRequestFinalDeliveryStatusLabel("draft")
    ).toBe("Draft");

    expect(
      getListingRequestFinalDeliveryStatusLabel("submitted")
    ).toBe("Awaiting buyer review");

    expect(
      getListingRequestFinalDeliveryStatusLabel(
        "revision_requested"
      )
    ).toBe("Revision requested");

    expect(
      getListingRequestFinalDeliveryStatusLabel(
        "buyer_approved"
      )
    ).toBe("Approved by buyer");

    expect(
      getListingRequestFinalDeliveryStatusLabel("cancelled")
    ).toBe("Cancelled");

    expect(
      getListingRequestFinalDeliveryStatusLabel("superseded")
    ).toBe("Superseded");
  });

  it("returns useful delivery summaries and tones", () => {
    expect(
      getListingRequestFinalDeliveryStatusSummary("submitted")
    ).toContain("buyer review");

    expect(
      getListingRequestFinalDeliveryStatusTone("submitted")
    ).toBe("review");

    expect(
      getListingRequestFinalDeliveryStatusTone(
        "buyer_approved"
      )
    ).toBe("success");

    expect(
      getListingRequestFinalDeliveryStatusTone(
        "revision_requested"
      )
    ).toBe("danger");

    expect(
      getListingRequestFinalDeliveryStatusTone("draft")
    ).toBe("muted");
  });

  it("only allows draft deliveries to be submitted", () => {
    expect(
      canSubmitListingRequestFinalDelivery("draft")
    ).toBe(true);

    expect(
      canSubmitListingRequestFinalDelivery("submitted")
    ).toBe(false);

    expect(
      canSubmitListingRequestFinalDelivery(
        "revision_requested"
      )
    ).toBe(false);
  });

  it("only allows buyers to respond to submitted deliveries", () => {
    expect(
      canBuyerRespondToListingRequestFinalDelivery(
        "submitted"
      )
    ).toBe(true);

    expect(
      canBuyerRespondToListingRequestFinalDelivery("draft")
    ).toBe(false);

    expect(
      canBuyerRespondToListingRequestFinalDelivery(
        "buyer_approved"
      )
    ).toBe(false);
  });

  it("requires an accepted agreement with resolved starting payment before creating a delivery", () => {
    expect(
      canCreateNextListingRequestFinalDelivery(null, [])
    ).toBe(false);

    expect(
      canCreateNextListingRequestFinalDelivery(
        createAgreement({
          status: "sent",
        }),
        []
      )
    ).toBe(false);

    expect(
      canCreateNextListingRequestFinalDelivery(
        createAgreement({
          starting_payment_status: "payment_required",
        }),
        []
      )
    ).toBe(false);

    expect(
      canCreateNextListingRequestFinalDelivery(
        createAgreement(),
        []
      )
    ).toBe(true);
  });

  it("allows a new delivery after revision or cancellation", () => {
    const agreement = createAgreement();

    expect(
      canCreateNextListingRequestFinalDelivery(
        agreement,
        [
          createFinalDelivery({
            status: "revision_requested",
          }),
        ]
      )
    ).toBe(true);

    expect(
      canCreateNextListingRequestFinalDelivery(
        agreement,
        [
          createFinalDelivery({
            status: "cancelled",
          }),
        ]
      )
    ).toBe(true);

    expect(
      canCreateNextListingRequestFinalDelivery(
        agreement,
        [
          createFinalDelivery({
            status: "submitted",
          }),
        ]
      )
    ).toBe(false);

    expect(
      canCreateNextListingRequestFinalDelivery(
        agreement,
        [
          createFinalDelivery({
            status: "buyer_approved",
          }),
        ]
      )
    ).toBe(false);
  });

  it("uses the latest final delivery when deciding whether another can be created", () => {
    const agreement = createAgreement();

    expect(
      canCreateNextListingRequestFinalDelivery(
        agreement,
        [
          createFinalDelivery({
            id: "final-delivery-1",
            status: "revision_requested",
            created_at:
              "2026-06-09T12:00:00.000Z",
          }),
          createFinalDelivery({
            id: "final-delivery-2",
            status: "submitted",
            created_at:
              "2026-06-10T12:00:00.000Z",
          }),
        ]
      )
    ).toBe(false);

    expect(
      canCreateNextListingRequestFinalDelivery(
        agreement,
        [
          createFinalDelivery({
            id: "final-delivery-1",
            status: "submitted",
            created_at:
              "2026-06-09T12:00:00.000Z",
          }),
          createFinalDelivery({
            id: "final-delivery-2",
            status: "revision_requested",
            created_at:
              "2026-06-10T12:00:00.000Z",
          }),
        ]
      )
    ).toBe(true);
  });

  it("keeps unsent drafts hidden from buyers", () => {
    expect(
      isListingRequestFinalDeliveryBuyerVisible({
        status: "draft",
        submittedAt: null,
      })
    ).toBe(false);

    expect(
      isListingRequestFinalDeliveryBuyerVisible({
        status: "submitted",
        submittedAt: "2026-06-09T12:00:00.000Z",
      })
    ).toBe(true);

    expect(
      isListingRequestFinalDeliveryBuyerVisible({
        status: "revision_requested",
        submittedAt: "2026-06-09T12:00:00.000Z",
      })
    ).toBe(true);
  });

  it("treats non-milestone agreements as milestone-payment ready", () => {
    expect(
      getHasAllMilestonePaymentsPaid(
        createAgreement({
          payment_structure: "deposit_balance",
          listing_request_payment_schedule_items: [],
        })
      )
    ).toBe(true);
  });

  it("requires at least one paid milestone payment for milestone agreements", () => {
    expect(
      getHasAllMilestonePaymentsPaid(
        createAgreement({
          starting_payment_status: "not_required",
          payment_structure: "milestone_payments",
          listing_request_payment_schedule_items: [],
        })
      )
    ).toBe(false);

    expect(
      getHasAllMilestonePaymentsPaid(
        createAgreement({
          starting_payment_status: "not_required",
          payment_structure: "milestone_payments",
          listing_request_payment_schedule_items: [
            {
              payment_timing:
                "due_at_milestone_approval",
              status: "pending",
              amount: 100,
            },
          ],
        })
      )
    ).toBe(false);

    expect(
      getHasAllMilestonePaymentsPaid(
        createAgreement({
          starting_payment_status: "not_required",
          payment_structure: "milestone_payments",
          listing_request_payment_schedule_items: [
            {
              payment_timing:
                "due_at_milestone_approval",
              status: "paid",
              amount: 100,
            },
            {
              payment_timing:
                "due_at_milestone_approval",
              status: "paid",
              amount: 150,
            },
          ],
        })
      )
    ).toBe(true);
  });

  it("blocks final delivery for milestone agreements until all milestone payments are paid", () => {
    expect(
      canCreateNextListingRequestFinalDelivery(
        createAgreement({
          starting_payment_status: "not_required",
          payment_structure: "milestone_payments",
          listing_request_payment_schedule_items: [
            {
              payment_timing:
                "due_at_milestone_approval",
              status: "paid",
              amount: 100,
            },
            {
              payment_timing:
                "due_at_milestone_approval",
              status: "payment_required",
              amount: 150,
            },
          ],
        }),
        []
      )
    ).toBe(false);

    expect(
      canCreateNextListingRequestFinalDelivery(
        createAgreement({
          starting_payment_status: "not_required",
          payment_structure: "milestone_payments",
          listing_request_payment_schedule_items: [
            {
              payment_timing:
                "due_at_milestone_approval",
              status: "paid",
              amount: 100,
            },
            {
              payment_timing:
                "due_at_milestone_approval",
              status: "paid",
              amount: 150,
            },
          ],
        }),
        []
      )
    ).toBe(true);
  });

  it("blocks final delivery approval while milestone payments are unconfirmed", () => {
    const agreement = createAgreement({
      starting_payment_status: "not_required",
      payment_structure: "milestone_payments",
      listing_request_payment_schedule_items: [
        {
          payment_timing: "due_at_milestone_approval",
          status: "paid",
          amount: 100,
        },
        {
          payment_timing: "due_at_milestone_approval",
          status: "payment_required",
          amount: 150,
        },
      ],
    });

    expect(
      canApproveListingRequestFinalDelivery(agreement)
    ).toBe(false);

    expect(
      getListingRequestFinalDeliveryApprovalBlockedReason(
        agreement
      )
    ).toBe(
      "All milestone payments must be confirmed before you can approve the final delivery."
    );
  });

  it("blocks final delivery approval while final balance payment is outstanding", () => {
    const agreement = createAgreement({
      listing_request_payment_schedule_items: [
        {
          payment_timing: "due_before_final_release",
          status: "payment_required",
          amount: 200,
        },
      ],
    });

    expect(
      canApproveListingRequestFinalDelivery(agreement)
    ).toBe(false);

    expect(
      getListingRequestFinalDeliveryApprovalBlockedReason(
        agreement
      )
    ).toBe(
      "The final balance must be confirmed as paid before you can approve this delivery."
    );
  });

  it("blocks final delivery approval while final balance hold is active", () => {
    const agreement = createAgreement({
      listing_request_payment_schedule_items: [
        {
          payment_timing: "due_before_final_release",
          status: "paid",
          amount: 200,
        },
      ],
      listing_request_timeline_holds: [
        {
          reason: "balance_payment_pending",
          ended_at: null,
        },
      ],
    });

    expect(
      canApproveListingRequestFinalDelivery(agreement)
    ).toBe(false);

    expect(
      getListingRequestFinalDeliveryApprovalBlockedReason(
        agreement
      )
    ).toBe(
      "The final balance payment is still awaiting confirmation."
    );
  });

  it("allows final delivery approval when payment blockers are resolved", () => {
    const agreement = createAgreement({
      listing_request_payment_schedule_items: [
        {
          payment_timing: "due_before_final_release",
          status: "paid",
          amount: 200,
        },
      ],
      listing_request_timeline_holds: [
        {
          reason: "balance_payment_pending",
          ended_at: "2026-06-18T12:00:00.000Z",
        },
      ],
    });

    expect(
      canApproveListingRequestFinalDelivery(agreement)
    ).toBe(true);

    expect(
      getListingRequestFinalDeliveryApprovalBlockedReason(
        agreement
      )
    ).toBeNull();
  });

  it("does not allow final delivery approval without a buyer-accepted agreement", () => {
    expect(
      canApproveListingRequestFinalDelivery(null)
    ).toBe(false);

    expect(
      canApproveListingRequestFinalDelivery(
        createAgreement({
          status: "sent",
        })
      )
    ).toBe(false);
  });

  it("only allows submitted final deliveries to be approved when payment blockers are clear", () => {
    const agreement = createAgreement({
      status: "buyer_accepted",
      listing_request_payment_schedule_items: [],
      listing_request_timeline_holds: [],
    });

    expect(
      canApproveSubmittedListingRequestFinalDelivery(
        "submitted",
        agreement
      )
    ).toBe(true);

    expect(
      canApproveSubmittedListingRequestFinalDelivery(
        "draft",
        agreement
      )
    ).toBe(false);

    expect(
      canApproveSubmittedListingRequestFinalDelivery(
        "revision_requested",
        agreement
      )
    ).toBe(false);

    expect(
      canApproveSubmittedListingRequestFinalDelivery(
        "buyer_approved",
        agreement
      )
    ).toBe(false);
  });

  it("blocks submitted final delivery approval when payment blockers remain", () => {
    const agreement = createAgreement({
      status: "buyer_accepted",
      listing_request_payment_schedule_items: [
        {
          payment_timing: "due_before_final_release",
          status: "payment_required",
          amount: 200,
        },
      ],
    });

    expect(
      canApproveSubmittedListingRequestFinalDelivery(
        "submitted",
        agreement
      )
    ).toBe(false);
  });

  it("returns a creation blocked reason when the agreement is not ready", () => {
    expect(
      getListingRequestFinalDeliveryCreationBlockedReason(
        null,
        []
      )
    ).toBe(
      "A buyer-accepted project agreement is required before final delivery can be created."
    );

    expect(
      getListingRequestFinalDeliveryCreationBlockedReason(
        createAgreement({
          status: "sent",
        }),
        []
      )
    ).toBe(
      "A buyer-accepted project agreement is required before final delivery can be created."
    );

    expect(
      getListingRequestFinalDeliveryCreationBlockedReason(
        createAgreement({
          starting_payment_status: "payment_required",
        }),
        []
      )
    ).toBe(
      "Starting payment must be resolved before final delivery can be created."
    );
  });

  it("returns a creation blocked reason when milestone payments are incomplete", () => {
    expect(
      getListingRequestFinalDeliveryCreationBlockedReason(
        createAgreement({
          starting_payment_status: "not_required",
          payment_structure: "milestone_payments",
          listing_request_payment_schedule_items: [
            {
              payment_timing: "due_at_milestone_approval",
              status: "payment_required",
              amount: 150,
            },
          ],
        }),
        []
      )
    ).toBe(
      "All milestone payments must be confirmed before final delivery can be created."
    );
  });

  it("returns a creation blocked reason when a final delivery is already active", () => {
    expect(
      getListingRequestFinalDeliveryCreationBlockedReason(
        createAgreement(),
        [
          createFinalDelivery({
            status: "submitted",
          }),
        ]
      )
    ).toBe(
      "A new final delivery can only be created after the previous delivery is revised or cancelled."
    );
  });

  it("returns null when there is no latest final delivery", () => {
    expect(
      getLatestListingRequestFinalDelivery([])
    ).toBeNull();
  });

  it("returns the latest final delivery by created date", () => {
    const olderDelivery = createFinalDelivery({
      id: "final-delivery-1",
      status: "revision_requested",
      created_at: "2026-06-09T12:00:00.000Z",
    });

    const newerDelivery = createFinalDelivery({
      id: "final-delivery-2",
      status: "submitted",
      created_at: "2026-06-10T12:00:00.000Z",
    });

    expect(
      getLatestListingRequestFinalDelivery([
        olderDelivery,
        newerDelivery,
      ])
    ).toEqual(newerDelivery);
  });

  it("uses the id as a stable latest final delivery tie-breaker", () => {
    const firstDelivery = createFinalDelivery({
      id: "final-delivery-1",
      created_at: "2026-06-10T12:00:00.000Z",
    });

    const secondDelivery = createFinalDelivery({
      id: "final-delivery-2",
      created_at: "2026-06-10T12:00:00.000Z",
    });

    expect(
      getLatestListingRequestFinalDelivery([
        firstDelivery,
        secondDelivery,
      ])
    ).toEqual(secondDelivery);
  });

  it("returns the latest draft final delivery", () => {
    const olderDraft = createFinalDelivery({
      id: "final-delivery-1",
      status: "draft",
      created_at: "2026-06-09T12:00:00.000Z",
    });

    const submittedDelivery = createFinalDelivery({
      id: "final-delivery-2",
      status: "submitted",
      created_at: "2026-06-10T12:00:00.000Z",
    });

    const newerDraft = createFinalDelivery({
      id: "final-delivery-3",
      status: "draft",
      created_at: "2026-06-11T12:00:00.000Z",
    });

    expect(
      getDraftListingRequestFinalDelivery([
        olderDraft,
        submittedDelivery,
        newerDraft,
      ])
    ).toEqual(newerDraft);
  });

  it("returns the latest submitted final delivery", () => {
    const olderSubmittedDelivery = createFinalDelivery({
      id: "final-delivery-1",
      status: "submitted",
      created_at: "2026-06-09T12:00:00.000Z",
    });

    const draftDelivery = createFinalDelivery({
      id: "final-delivery-2",
      status: "draft",
      created_at: "2026-06-10T12:00:00.000Z",
    });

    const newerSubmittedDelivery = createFinalDelivery({
      id: "final-delivery-3",
      status: "submitted",
      created_at: "2026-06-11T12:00:00.000Z",
    });

    expect(
      getSubmittedListingRequestFinalDelivery([
        olderSubmittedDelivery,
        draftDelivery,
        newerSubmittedDelivery,
      ])
    ).toEqual(newerSubmittedDelivery);
  });

  it("returns null when there is no submitted final delivery", () => {
    expect(
      getSubmittedListingRequestFinalDelivery([
        createFinalDelivery({
          status: "draft",
        }),
        createFinalDelivery({
          status: "revision_requested",
        }),
      ])
    ).toBeNull();
  });
});