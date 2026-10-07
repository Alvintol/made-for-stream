import { describe, expect, it } from "vitest";

import {
  canBuyerRespondToListingRequestChangeOrder,
  canCreateListingRequestChangeOrder,
  canSendListingRequestChangeOrder,
  getDraftListingRequestChangeOrder,
  getHasPendingListingRequestChangeOrder,
  getLatestListingRequestChangeOrder,
  getListingRequestChangeOrderImpactLabels,
  getListingRequestChangeOrderStatusLabel,
  getListingRequestChangeOrderStatusSummary,
  getListingRequestChangeOrderStatusTone,
  getSentListingRequestChangeOrder,
  hasListingRequestChangeOrderImpact,
  isListingRequestChangeOrderBuyerVisible,
} from "../listings/listingRequestChangeOrders";

describe("listing commission change orders", () => {
  it("maps change-order statuses to display labels", () => {
    expect(
      getListingRequestChangeOrderStatusLabel("draft")
    ).toBe("Draft");

    expect(
      getListingRequestChangeOrderStatusLabel("sent")
    ).toBe("Awaiting buyer review");

    expect(
      getListingRequestChangeOrderStatusLabel("buyer_accepted")
    ).toBe("Accepted by buyer");

    expect(
      getListingRequestChangeOrderStatusLabel("buyer_declined")
    ).toBe("Declined by buyer");

    expect(
      getListingRequestChangeOrderStatusLabel("cancelled")
    ).toBe("Cancelled");

    expect(
      getListingRequestChangeOrderStatusLabel("superseded")
    ).toBe("Superseded");
  });

  it("returns useful summaries and tones", () => {
    expect(
      getListingRequestChangeOrderStatusSummary("sent")
    ).toContain("buyer must review");

    expect(
      getListingRequestChangeOrderStatusTone("sent")
    ).toBe("review");

    expect(
      getListingRequestChangeOrderStatusTone("buyer_accepted")
    ).toBe("success");

    expect(
      getListingRequestChangeOrderStatusTone("buyer_declined")
    ).toBe("danger");

    expect(
      getListingRequestChangeOrderStatusTone("draft")
    ).toBe("muted");
  });

  it("only allows draft change orders to be sent", () => {
    expect(
      canSendListingRequestChangeOrder("draft")
    ).toBe(true);

    expect(
      canSendListingRequestChangeOrder("sent")
    ).toBe(false);

    expect(
      canSendListingRequestChangeOrder("buyer_accepted")
    ).toBe(false);
  });

  it("only allows buyers to respond to sent change orders", () => {
    expect(
      canBuyerRespondToListingRequestChangeOrder("sent")
    ).toBe(true);

    expect(
      canBuyerRespondToListingRequestChangeOrder("draft")
    ).toBe(false);

    expect(
      canBuyerRespondToListingRequestChangeOrder(
        "buyer_accepted"
      )
    ).toBe(false);
  });

  it("keeps unsent drafts hidden from buyers", () => {
    expect(
      isListingRequestChangeOrderBuyerVisible({
        status: "draft",
        sentAt: null,
      })
    ).toBe(false);

    expect(
      isListingRequestChangeOrderBuyerVisible({
        status: "cancelled",
        sentAt: null,
      })
    ).toBe(false);

    expect(
      isListingRequestChangeOrderBuyerVisible({
        status: "sent",
        sentAt: "2026-06-08T12:00:00.000Z",
      })
    ).toBe(true);

    expect(
      isListingRequestChangeOrderBuyerVisible({
        status: "buyer_declined",
        sentAt: "2026-06-08T12:00:00.000Z",
      })
    ).toBe(true);
  });

  it("requires at least one material project impact", () => {
    expect(
      hasListingRequestChangeOrderImpact({})
    ).toBe(false);

    expect(
      hasListingRequestChangeOrderImpact({
        changesTimeline: true,
      })
    ).toBe(true);

    expect(
      hasListingRequestChangeOrderImpact({
        changesMilestones: true,
      })
    ).toBe(true);
  });

  it("returns the selected impact labels in a stable order", () => {
    expect(
      getListingRequestChangeOrderImpactLabels({
        changesScope: true,
        changesTimeline: true,
        changesPaymentSchedule: true,
        changesMilestones: true,
      })
    ).toEqual([
      "Scope",
      "Timeline",
      "Payment schedule",
      "Milestones",
    ]);
  });

  it("returns the latest change order by created date", () => {
    const olderChangeOrder = {
      id: "change-order-1",
      status: "draft",
      created_at: "2026-06-09T12:00:00.000Z",
    };

    const newerChangeOrder = {
      id: "change-order-2",
      status: "sent",
      created_at: "2026-06-10T12:00:00.000Z",
    };

    expect(
      getLatestListingRequestChangeOrder([
        olderChangeOrder,
        newerChangeOrder,
      ])
    ).toEqual(newerChangeOrder);
  });

  it("uses the id as a stable latest change-order tie-breaker", () => {
    const firstChangeOrder = {
      id: "change-order-1",
      status: "draft",
      created_at: "2026-06-10T12:00:00.000Z",
    };

    const secondChangeOrder = {
      id: "change-order-2",
      status: "draft",
      created_at: "2026-06-10T12:00:00.000Z",
    };

    expect(
      getLatestListingRequestChangeOrder([
        firstChangeOrder,
        secondChangeOrder,
      ])
    ).toEqual(secondChangeOrder);
  });

  it("returns the latest draft change order", () => {
    const olderDraft = {
      id: "change-order-1",
      status: "draft",
      created_at: "2026-06-09T12:00:00.000Z",
    };

    const sentChangeOrder = {
      id: "change-order-2",
      status: "sent",
      created_at: "2026-06-10T12:00:00.000Z",
    };

    const newerDraft = {
      id: "change-order-3",
      status: "draft",
      created_at: "2026-06-11T12:00:00.000Z",
    };

    expect(
      getDraftListingRequestChangeOrder([
        olderDraft,
        sentChangeOrder,
        newerDraft,
      ])
    ).toEqual(newerDraft);
  });

  it("returns the latest sent change order", () => {
    const olderSent = {
      id: "change-order-1",
      status: "sent",
      created_at: "2026-06-09T12:00:00.000Z",
    };

    const draftChangeOrder = {
      id: "change-order-2",
      status: "draft",
      created_at: "2026-06-10T12:00:00.000Z",
    };

    const newerSent = {
      id: "change-order-3",
      status: "sent",
      created_at: "2026-06-11T12:00:00.000Z",
    };

    expect(
      getSentListingRequestChangeOrder([
        olderSent,
        draftChangeOrder,
        newerSent,
      ])
    ).toEqual(newerSent);
  });

  it("detects pending change orders", () => {
    expect(
      getHasPendingListingRequestChangeOrder([
        {
          id: "change-order-1",
          status: "buyer_accepted",
        },
      ])
    ).toBe(false);

    expect(
      getHasPendingListingRequestChangeOrder([
        {
          id: "change-order-1",
          status: "draft",
        },
      ])
    ).toBe(true);

    expect(
      getHasPendingListingRequestChangeOrder([
        {
          id: "change-order-1",
          status: "sent",
        },
      ])
    ).toBe(true);
  });

  it("allows change-order creation for accepted commissions with buyer-accepted agreements and no pending change order", () => {
    expect(
      canCreateListingRequestChangeOrder(
        "accepted",
        {
          status: "buyer_accepted",
        },
        [
          {
            id: "change-order-1",
            status: "buyer_accepted",
          },
        ]
      )
    ).toBe(true);
  });

  it("blocks change-order creation when the commission or agreement is not ready", () => {
    expect(
      canCreateListingRequestChangeOrder(
        "submitted",
        {
          status: "buyer_accepted",
        },
        []
      )
    ).toBe(false);

    expect(
      canCreateListingRequestChangeOrder(
        "accepted",
        {
          status: "sent",
        },
        []
      )
    ).toBe(false);

    expect(
      canCreateListingRequestChangeOrder(
        "accepted",
        null,
        []
      )
    ).toBe(false);
  });

  it("blocks change-order creation while a draft or sent change order is pending", () => {
    expect(
      canCreateListingRequestChangeOrder(
        "accepted",
        {
          status: "buyer_accepted",
        },
        [
          {
            id: "change-order-1",
            status: "draft",
          },
        ]
      )
    ).toBe(false);

    expect(
      canCreateListingRequestChangeOrder(
        "accepted",
        {
          status: "buyer_accepted",
        },
        [
          {
            id: "change-order-1",
            status: "sent",
          },
        ]
      )
    ).toBe(false);
  });

  it("only allows buyers to respond to sent change orders", () => {
    expect(
      canBuyerRespondToListingRequestChangeOrder("sent")
    ).toBe(true);

    expect(
      canBuyerRespondToListingRequestChangeOrder("draft")
    ).toBe(false);

    expect(
      canBuyerRespondToListingRequestChangeOrder(
        "buyer_accepted"
      )
    ).toBe(false);

    expect(
      canBuyerRespondToListingRequestChangeOrder(
        "buyer_declined"
      )
    ).toBe(false);
  });
});