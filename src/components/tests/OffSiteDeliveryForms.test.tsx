import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ListingRequestFinalDeliveryBuilder from "../listingRequests/finalDeliveries/ListingRequestFinalDeliveryBuilder";
import ListingRequestMilestoneSubmissionForm from "../listingRequests/milestones/ListingRequestMilestoneSubmissionForm";

const summary = "The completed overlay package is ready for buyer review.";

const renderFinalDelivery = (onCreateFinalDelivery = vi.fn()) => {
  render(
    <ListingRequestFinalDeliveryBuilder
      requestStatus="accepted"
      agreement={{
        id: "agreement-1",
        status: "buyer_accepted",
        starting_payment_status: "not_required",
      }}
      onCreateFinalDelivery={onCreateFinalDelivery}
    />,
  );

  fireEvent.change(screen.getByLabelText("Delivery title"), {
    target: { value: "Final overlay delivery" },
  });
  fireEvent.change(screen.getByLabelText("Delivery summary"), {
    target: { value: summary },
  });

  return onCreateFinalDelivery;
};

describe("Provided off site, on the delivery forms", () => {
  it("warns before the box is ticked and hides the ways until it is", () => {
    renderFinalDelivery();

    expect(
      screen.getByText(/are not protected by Made for Stream/),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Provided off site" })).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Discord" })).not.toBeInTheDocument();
  });

  it("sends nothing about off-site delivery when the box is left alone", async () => {
    const onCreateFinalDelivery = renderFinalDelivery();

    fireEvent.click(screen.getByRole("button", { name: "Create and submit final delivery" }));

    await waitFor(() => expect(onCreateFinalDelivery).toHaveBeenCalledTimes(1));
    expect(onCreateFinalDelivery.mock.calls[0][0]).not.toHaveProperty("offSiteDelivery");
  });

  it("will not submit a ticked box without saying how the work was sent", () => {
    const onCreateFinalDelivery = renderFinalDelivery();

    fireEvent.click(screen.getByRole("checkbox", { name: "Provided off site" }));
    fireEvent.click(screen.getByRole("button", { name: "Create and submit final delivery" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose at least one way the work was sent off site.",
    );
    expect(onCreateFinalDelivery).not.toHaveBeenCalled();
  });

  it("sends the chosen ways with a final delivery", async () => {
    const onCreateFinalDelivery = renderFinalDelivery();

    fireEvent.click(screen.getByRole("checkbox", { name: "Provided off site" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Another way" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Discord" }));
    fireEvent.change(screen.getByLabelText("Which way?"), {
      target: { value: " WeTransfer " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create and submit final delivery" }));

    await waitFor(() =>
      expect(onCreateFinalDelivery).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "submitted",
          offSiteDelivery: { methods: ["discord", "other"], other: "WeTransfer" },
        }),
      ),
    );
  });

  it("sends the chosen ways with a milestone", async () => {
    const onSubmitMilestone = vi.fn();

    render(
      <ListingRequestMilestoneSubmissionForm
        milestone={{ id: "milestone-1", status: "pending", title: "Sketches", sort_order: 0 }}
        onSubmitMilestone={onSubmitMilestone}
      />,
    );

    fireEvent.change(screen.getByLabelText("Milestone submission summary"), {
      target: { value: summary },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Provided off site" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Email" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit milestone for review" }));

    await waitFor(() =>
      expect(onSubmitMilestone).toHaveBeenCalledWith(
        expect.objectContaining({
          milestoneId: "milestone-1",
          offSiteDelivery: { methods: ["email"], other: null },
        }),
      ),
    );
  });
});
