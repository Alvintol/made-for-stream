import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import userEvent from "@testing-library/user-event";

import ListingRequestMilestoneBuyerActions from "../listingRequests/milestones/ListingRequestMilestoneBuyerActions";
import type { ListingRequestMilestoneRow } from "../../hooks/creatorRequests/useListingRequestMilestones";

const createMilestone = (
  overrides: Partial<ListingRequestMilestoneRow> = {}
): ListingRequestMilestoneRow =>
  ({
    id: "milestone-1",
    listing_request_id: "request-1",
    agreement_id: "agreement-1",
    agreement_item_id: "agreement-item-1",
    payment_schedule_item_id: "payment-1",
    creator_user_id: "creator-1",
    buyer_user_id: "buyer-1",
    status: "submitted",
    title: "Initial design direction",
    description:
      "First pass at the core design direction.",
    amount: 125,
    currency: "cad",
    sort_order: 0,
    submission_version: 1,
    latest_submitted_at:
      "2026-06-18T12:00:00.000Z",
    latest_revision_requested_at: null,
    buyer_approved_at: null,
    payment_required_at: null,
    paid_at: null,
    cancelled_at: null,
    created_at: "2026-06-18T12:00:00.000Z",
    updated_at: "2026-06-18T12:00:00.000Z",
    ...overrides,
  }) as ListingRequestMilestoneRow;

describe(
  "<ListingRequestMilestoneBuyerActions />",
  () => {
    const onRespondMilestone = vi.fn();

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("renders an empty review state when no milestone is available", () => {
      render(
        <ListingRequestMilestoneBuyerActions
          milestone={null}
          onRespondMilestone={
            onRespondMilestone
          }
        />
      );

      expect(
        screen.getByText(
          "No milestone is ready for review."
        )
      ).toBeInTheDocument();

      expect(
        screen.queryByRole("button", {
          name: "Approve milestone",
        })
      ).not.toBeInTheDocument();
    });

    it("renders no-response-needed state for non-submitted milestones", () => {
      render(
        <ListingRequestMilestoneBuyerActions
          milestone={createMilestone({
            status: "payment_required",
          })}
          onRespondMilestone={
            onRespondMilestone
          }
        />
      );

      expect(
        screen.getByText(
          "Milestone 1 has been approved. Payment is now awaiting admin confirmation before the creator can continue."
        )
      ).toBeInTheDocument();
    });

    it("approves a submitted milestone", () => {
      render(
        <ListingRequestMilestoneBuyerActions
          milestone={createMilestone()}
          onRespondMilestone={
            onRespondMilestone
          }
        />
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Approve milestone",
        })
      );

      expect(
        onRespondMilestone
      ).toHaveBeenCalledWith({
        milestoneId: "milestone-1",
        response: "buyer_approved",
      });
    });

    it("commissions revisions with trimmed notes", async () => {
      const user = userEvent.setup();

      render(
        <ListingRequestMilestoneBuyerActions
          milestone={createMilestone()}
          onRespondMilestone={onRespondMilestone}
        />
      );

      await user.click(
        screen.getByRole("button", {
          name: "Request revisions",
        })
      );

      await user.type(
        screen.getByLabelText("Revision notes"),
        "   Please revise the thumbnail layout.   "
      );

      await user.click(
        screen.getByRole("button", {
          name: "Send revision request",
        })
      );

      expect(onRespondMilestone).toHaveBeenCalledWith({
        milestoneId: "milestone-1",
        response: "revision_requested",
        revisionRequestReason:
          "Please revise the thumbnail layout.",
      });
    });

    it("blocks revision requests with short notes", () => {
      render(
        <ListingRequestMilestoneBuyerActions
          milestone={createMilestone()}
          onRespondMilestone={
            onRespondMilestone
          }
        />
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Request revisions",
        })
      );

      fireEvent.change(
        screen.getByLabelText("Revision notes"),
        {
          target: {
            value: "Too short",
          },
        }
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Send revision request",
        })
      );

      expect(
        screen.getByText(
          "Revision notes must be between 10 and 2000 characters."
        )
      ).toBeInTheDocument();

      expect(
        onRespondMilestone
      ).not.toHaveBeenCalled();
    });

    it("cancels a revision request", () => {
      render(
        <ListingRequestMilestoneBuyerActions
          milestone={createMilestone()}
          onRespondMilestone={
            onRespondMilestone
          }
        />
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Request revisions",
        })
      );

      expect(
        screen.getByLabelText(
          "Revision notes"
        )
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", {
          name: "Cancel revision request",
        })
      );

      expect(
        screen.queryByLabelText(
          "Revision notes"
        )
      ).not.toBeInTheDocument();
    });

    it("disables actions while a response is pending", () => {
      render(
        <ListingRequestMilestoneBuyerActions
          milestone={createMilestone()}
          isPending
          onRespondMilestone={
            onRespondMilestone
          }
        />
      );

      expect(
        screen.getByRole("button", {
          name: "Approve milestone",
        })
      ).toBeDisabled();

      expect(
        screen.getByRole("button", {
          name: "Request revisions",
        })
      ).toBeDisabled();
    });

    it("shows mutation errors", () => {
      render(
        <ListingRequestMilestoneBuyerActions
          milestone={createMilestone()}
          error={
            new Error(
              "This milestone is not awaiting your response."
            )
          }
          onRespondMilestone={
            onRespondMilestone
          }
        />
      );

      expect(
        screen.getByText(
          "This milestone is not awaiting your response."
        )
      ).toBeInTheDocument();
    });

    it("explains when the buyer is waiting for creator milestone submission", () => {
      render(
        <ListingRequestMilestoneBuyerActions
          milestone={createMilestone({
            status: "pending",
          })}
          onRespondMilestone={onRespondMilestone}
        />
      );

      expect(
        screen.getByText(
          "Milestone 1 is waiting for the creator to submit work for buyer review."
        )
      ).toBeInTheDocument();

      expect(
        screen.queryByRole("button", {
          name: "Approve milestone",
        })
      ).not.toBeInTheDocument();
    });

    it("explains when the buyer is waiting for revised milestone work", () => {
      render(
        <ListingRequestMilestoneBuyerActions
          milestone={createMilestone({
            status: "revision_requested",
          })}
          onRespondMilestone={onRespondMilestone}
        />
      );

      expect(
        screen.getByText(
          "Milestone 1 has revisions requested. The creator needs to submit an updated version before you can review it again."
        )
      ).toBeInTheDocument();
    });
  }
);