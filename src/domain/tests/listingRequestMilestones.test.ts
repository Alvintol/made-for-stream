import {
  describe,
  expect,
  it,
} from "vitest";

import {
  canSubmitListingRequestMilestone,
  getActiveListingRequestMilestone,
  getListingRequestMilestonePlanTotal,
  getListingRequestMilestonesAreComplete,
  getListingRequestMilestoneStatusLabel,
  getListingRequestMilestoneStatusSummary,
  getListingRequestMilestoneStatusTone,
  getOrderedListingRequestMilestones,
  isListingRequestMilestoneTerminal,
  validateListingRequestMilestonePlan,
} from "../listings/listingRequestMilestones";

const validMilestones = [
  {
    title: "Initial design direction",
    description:
      "Deliver initial concepts for buyer review.",
    amount: 150,
    sortOrder: 0,
  },
  {
    title: "Completed project package",
    description:
      "Deliver the completed files and source assets.",
    amount: 350,
    sortOrder: 1,
  },
];

describe("listing commission milestones", () => {
  it("maps milestone statuses to display labels", () => {
    expect(
      getListingRequestMilestoneStatusLabel(
        "pending"
      )
    ).toBe("Not started");

    expect(
      getListingRequestMilestoneStatusLabel(
        "submitted"
      )
    ).toBe("Awaiting buyer review");

    expect(
      getListingRequestMilestoneStatusLabel(
        "revision_requested"
      )
    ).toBe("Revision requested");

    expect(
      getListingRequestMilestoneStatusLabel(
        "buyer_approved"
      )
    ).toBe("Approved by buyer");

    expect(
      getListingRequestMilestoneStatusLabel(
        "payment_required"
      )
    ).toBe("Payment required");

    expect(
      getListingRequestMilestoneStatusLabel("paid")
    ).toBe("Paid");
  });

  it("returns useful summaries and tones", () => {
    expect(
      getListingRequestMilestoneStatusSummary(
        "submitted"
      )
    ).toContain("buyer review");

    expect(
      getListingRequestMilestoneStatusTone(
        "submitted"
      )
    ).toBe("review");

    expect(
      getListingRequestMilestoneStatusTone(
        "revision_requested"
      )
    ).toBe("danger");

    expect(
      getListingRequestMilestoneStatusTone("paid")
    ).toBe("success");
  });

  it("controls milestone lifecycle actions", () => {
    expect(
      canSubmitListingRequestMilestone("pending")
    ).toBe(true);

    expect(
      canSubmitListingRequestMilestone(
        "revision_requested"
      )
    ).toBe(true);

    expect(
      canSubmitListingRequestMilestone("submitted")
    ).toBe(false);
  });

  it("calculates the milestone plan total", () => {
    expect(
      getListingRequestMilestonePlanTotal([
        {
          title: "First",
          amount: 100.1,
          sortOrder: 0,
        },
        {
          title: "Second",
          amount: 200.2,
          sortOrder: 1,
        },
      ])
    ).toBe(300.3);
  });

  it("accepts a valid milestone plan", () => {
    const result =
      validateListingRequestMilestonePlan({
        estimatedWorkDays: 21,
        agreementTotal: 500,
        milestones: validMilestones,
      });

    expect(result).toEqual({
      isValid: true,
      errors: [],
      milestoneTotal: 500,
    });
  });

  it("requires a project longer than 14 days", () => {
    const result =
      validateListingRequestMilestonePlan({
        estimatedWorkDays: 14,
        agreementTotal: 500,
        milestones: validMilestones,
      });

    expect(result.isValid).toBe(false);

    expect(result.errors).toContain(
      "Milestone payments require an estimated project length greater than 14 days."
    );
  });

  it("requires at least two milestones", () => {
    const result =
      validateListingRequestMilestonePlan({
        estimatedWorkDays: 21,
        agreementTotal: 500,
        milestones: [
          {
            title: "Only milestone",
            amount: 500,
            sortOrder: 0,
          },
        ],
      });

    expect(result.errors).toContain(
      "Add at least two milestones to use milestone payments."
    );
  });

  it("requires milestone amounts to equal the agreement total", () => {
    const result =
      validateListingRequestMilestonePlan({
        estimatedWorkDays: 21,
        agreementTotal: 600,
        milestones: validMilestones,
      });

    expect(result.milestoneTotal).toBe(500);

    expect(result.errors).toContain(
      "Milestone amounts must equal the total agreement amount."
    );
  });

  it("validates milestone fields and ordering", () => {
    const result =
      validateListingRequestMilestonePlan({
        estimatedWorkDays: 21,
        agreementTotal: 200,
        milestones: [
          {
            title: "A",
            description: "Valid description.",
            amount: 0,
            sortOrder: 0,
          },
          {
            title: "Second milestone",
            description: "x".repeat(2001),
            amount: 200,
            sortOrder: 0,
          },
        ],
      });

    expect(result.isValid).toBe(false);

    expect(result.errors).toContain(
      "Milestone 1 title must be between 3 and 160 characters."
    );

    expect(result.errors).toContain(
      "Milestone 1 amount must be greater than 0."
    );

    expect(result.errors).toContain(
      "Milestone 2 description cannot exceed 2000 characters."
    );

    expect(result.errors).toContain(
      "Milestone order values must be unique."
    );
  });

  it("orders milestones by sort order", () => {
    const milestones = [
      {
        id: "milestone-2",
        status: "pending" as const,
        sort_order: 1,
      },
      {
        id: "milestone-1",
        status: "paid" as const,
        sort_order: 0,
      },
    ];

    expect(
      getOrderedListingRequestMilestones(milestones).map(
        (milestone) => milestone.id
      )
    ).toEqual(["milestone-1", "milestone-2"]);
  });

  it("returns the first unpaid active milestone", () => {
    const milestones = [
      {
        id: "milestone-3",
        status: "pending" as const,
        sort_order: 2,
      },
      {
        id: "milestone-1",
        status: "paid" as const,
        sort_order: 0,
      },
      {
        id: "milestone-2",
        status: "payment_required" as const,
        sort_order: 1,
      },
    ];

    expect(
      getActiveListingRequestMilestone(milestones)
    ).toEqual({
      id: "milestone-2",
      status: "payment_required",
      sort_order: 1,
    });
  });

  it("returns null when no milestone is active", () => {
    expect(
      getActiveListingRequestMilestone([
        {
          id: "milestone-1",
          status: "paid" as const,
          sort_order: 0,
        },
        {
          id: "milestone-2",
          status: "cancelled" as const,
          sort_order: 1,
        },
      ])
    ).toBeNull();
  });

  it("does not treat an empty milestone list as complete", () => {
    expect(
      getListingRequestMilestonesAreComplete([])
    ).toBe(false);
  });

  it("treats paid and cancelled milestones as complete", () => {
    expect(
      getListingRequestMilestonesAreComplete([
        {
          status: "paid",
        },
        {
          status: "cancelled",
        },
      ])
    ).toBe(true);
  });

  it("does not treat pending milestone work as complete", () => {
    expect(
      getListingRequestMilestonesAreComplete([
        {
          status: "paid",
        },
        {
          status: "payment_required",
        },
      ])
    ).toBe(false);
  });

  it("identifies terminal milestone statuses", () => {
    expect(
      isListingRequestMilestoneTerminal("paid")
    ).toBe(true);

    expect(
      isListingRequestMilestoneTerminal("cancelled")
    ).toBe(true);

    expect(
      isListingRequestMilestoneTerminal("pending")
    ).toBe(false);

    expect(
      isListingRequestMilestoneTerminal(
        "payment_required"
      )
    ).toBe(false);
  });
});