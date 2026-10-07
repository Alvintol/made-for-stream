import { describe, expect, it } from "vitest";

import {
  getRequestNextStep,
  getRequestStages,
  type RequestWorkspaceInput,
} from "../listings/requestWorkspace";

type Agreement = NonNullable<RequestWorkspaceInput["agreement"]>;

const acceptedAgreement = (overrides: Partial<Agreement> = {}): Agreement => ({
  status: "buyer_accepted",
  payment_structure: "deposit_balance",
  starting_payment_status: "paid",
  listing_request_payment_schedule_items: [],
  ...overrides,
});

const accepted = (overrides: Partial<RequestWorkspaceInput> = {}): RequestWorkspaceInput => ({
  requestStatus: "accepted",
  agreement: acceptedAgreement(),
  milestones: [],
  changeOrders: [],
  finalDeliveries: [],
  ...overrides,
});

const stateOf = (input: RequestWorkspaceInput) =>
  Object.fromEntries(getRequestStages(input).map((stage) => [stage.key, stage.state]));

describe("getRequestStages", () => {
  it("has no tracker for closed commissions", () => {
    expect(getRequestStages({ requestStatus: "declined", agreement: null })).toEqual([]);
    expect(getRequestStages({ requestStatus: "archived", agreement: null })).toEqual([]);
  });

  it("marks the review stage current for submitted commissions", () => {
    expect(stateOf({ requestStatus: "submitted", agreement: null })).toMatchObject({
      submitted: "current",
      agreement: "upcoming",
      complete: "upcoming",
    });
  });

  it("marks the deposit current until the starting payment is resolved", () => {
    const stages = stateOf(
      accepted({ agreement: acceptedAgreement({ starting_payment_status: "payment_required" }) })
    );

    expect(stages).toMatchObject({ agreement: "done", payment: "current", work: "upcoming" });
  });

  it("drops the payment stage when no starting payment is required", () => {
    const stages = getRequestStages(
      accepted({ agreement: acceptedAgreement({ starting_payment_status: "not_required" }) })
    );

    expect(stages.map((stage) => stage.key)).not.toContain("payment");
  });

  it("shows milestone progress in the work stage", () => {
    const stages = getRequestStages(
      accepted({
        agreement: acceptedAgreement({ payment_structure: "milestone_payments" }),
        milestones: [
          { status: "paid", sort_order: 0, title: "Sketch" },
          { status: "submitted", sort_order: 1, title: "Line art" },
          { status: "pending", sort_order: 2, title: "Colour" },
        ],
      })
    );

    expect(stages.find((stage) => stage.key === "work")).toMatchObject({
      label: "Milestones 1/3",
      state: "current",
    });
  });

  it("moves to delivery while the final delivery is in review", () => {
    expect(
      stateOf(accepted({ finalDeliveries: [{ status: "submitted", version_number: 1 }] }))
    ).toMatchObject({ work: "done", delivery: "current" });
  });

  it("marks every stage done once completed", () => {
    const stages = getRequestStages({
      requestStatus: "completed",
      agreement: acceptedAgreement(),
    });

    expect(stages.every((stage) => stage.state === "done")).toBe(true);
  });
});

describe("getRequestNextStep", () => {
  it("asks the creator to review a submitted commission", () => {
    expect(getRequestNextStep({ requestStatus: "submitted", agreement: null })).toMatchObject({
      key: "review-request",
      owner: "creator",
      sectionId: "request",
    });
  });

  it("reports closed and completed commissions without an owner", () => {
    expect(getRequestNextStep({ requestStatus: "declined", agreement: null })).toMatchObject({
      owner: null,
      tone: "closed",
    });
    expect(getRequestNextStep({ requestStatus: "completed", agreement: null })).toMatchObject({
      owner: null,
      tone: "done",
    });
    expect(getRequestNextStep({ requestStatus: "cancelled", agreement: null })).toMatchObject({
      key: "cancelled",
      owner: null,
      tone: "closed",
    });
  });

  it("has no tracker for a cancelled commission", () => {
    expect(getRequestStages({ requestStatus: "cancelled", agreement: null })).toEqual([]);
  });

  it("prioritises an open cancellation proposal over the ordinary workflow", () => {
    expect(
      getRequestNextStep(
        accepted({
          cancellationProposal: { status: "pending_creator_statement", statement_due_at: null },
        })
      )
    ).toMatchObject({
      key: "submit-cancellation-statement",
      owner: "creator",
      tone: "action",
      sectionId: "request",
    });

    expect(
      getRequestNextStep(
        accepted({
          cancellationProposal: { status: "pending_buyer_response", statement_due_at: null },
        })
      )
    ).toMatchObject({
      key: "respond-cancellation-statement",
      owner: "buyer",
      tone: "action",
      sectionId: "request",
    });

    expect(
      getRequestNextStep(
        accepted({
          cancellationProposal: { status: "disputed", statement_due_at: null },
        })
      )
    ).toMatchObject({
      key: "cancellation-disputed",
      owner: null,
      tone: "closed",
    });
  });

  it("walks the agreement lifecycle", () => {
    expect(getRequestNextStep(accepted({ agreement: null })).key).toBe("create-agreement");
    expect(
      getRequestNextStep(accepted({ agreement: acceptedAgreement({ status: "draft" }) }))
    ).toMatchObject({ key: "send-agreement", owner: "creator" });
    expect(
      getRequestNextStep(accepted({ agreement: acceptedAgreement({ status: "sent" }) }))
    ).toMatchObject({ key: "accept-agreement", owner: "buyer" });
    expect(
      getRequestNextStep(accepted({ agreement: acceptedAgreement({ status: "buyer_declined" }) }))
    ).toMatchObject({ key: "revise-agreement", owner: "creator" });
  });

  it("asks the buyer for the deposit before anything else", () => {
    expect(
      getRequestNextStep(
        accepted({
          agreement: acceptedAgreement({ starting_payment_status: "payment_required" }),
          changeOrders: [{ status: "sent" }],
        })
      )
    ).toMatchObject({ key: "pay-starting", owner: "buyer", sectionId: "payments" });
  });

  it("prioritises a sent change order over work in progress", () => {
    expect(getRequestNextStep(accepted({ changeOrders: [{ status: "sent" }] }))).toMatchObject({
      key: "respond-change-order",
      owner: "buyer",
    });
  });

  it("asks the buyer to review the latest submitted final delivery", () => {
    expect(
      getRequestNextStep(
        accepted({
          finalDeliveries: [
            { status: "revision_requested", version_number: 1 },
            { status: "submitted", version_number: 2 },
          ],
        })
      )
    ).toMatchObject({ key: "review-delivery", owner: "buyer" });
  });

  it("asks the buyer to pay the final balance", () => {
    expect(
      getRequestNextStep(
        accepted({
          agreement: acceptedAgreement({
            listing_request_payment_schedule_items: [
              { status: "payment_required", payment_timing: "due_before_final_release" },
            ],
          }),
        })
      )
    ).toMatchObject({ key: "pay-final-balance", owner: "buyer" });
  });

  it("follows the active milestone", () => {
    const milestoneAgreement = acceptedAgreement({ payment_structure: "milestone_payments" });
    const withActive = (status: "pending" | "submitted" | "payment_required" | "revision_requested") =>
      getRequestNextStep(
        accepted({
          agreement: milestoneAgreement,
          milestones: [
            { status: "paid", sort_order: 0, title: "Sketch" },
            { status, sort_order: 1, title: "Line art" },
          ],
        })
      );

    expect(withActive("pending")).toMatchObject({
      key: "submit-milestone",
      owner: "creator",
      actionTitle: "Submit milestone 2: Line art",
    });
    expect(withActive("revision_requested").actionTitle).toBe("Revise milestone 2: Line art");
    expect(withActive("submitted")).toMatchObject({ key: "review-milestone", owner: "buyer" });
    expect(withActive("payment_required")).toMatchObject({ key: "pay-milestone", owner: "buyer" });
  });

  it("falls back to the creator working on the project", () => {
    expect(getRequestNextStep(accepted())).toMatchObject({
      key: "work-in-progress",
      owner: "creator",
      waitingTitle: "The creator is working on your project",
    });
  });
});
