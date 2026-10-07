import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ListingRequestCancelBeforePaymentAction from "../listingRequests/core/ListingRequestCancelBeforePaymentAction";

describe("ListingRequestCancelBeforePaymentAction", () => {
  it("asks for a reason before confirming cancellation", () => {
    const onCancel = vi.fn();

    render(
      <ListingRequestCancelBeforePaymentAction
        isPending={false}
        error={null}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel commission" }));

    const confirmButton = screen.getByRole("button", {
      name: "Confirm cancellation",
    });

    expect(confirmButton).toBeDisabled();

    fireEvent.change(
      screen.getByLabelText(/Reason \(10-1000 characters/i),
      { target: { value: "Short" } }
    );

    expect(confirmButton).toBeDisabled();

    fireEvent.change(
      screen.getByLabelText(/Reason \(10-1000 characters/i),
      { target: { value: "The buyer no longer needs this commission." } }
    );

    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);

    expect(onCancel).toHaveBeenCalledWith(
      "The buyer no longer needs this commission."
    );
  });

  it("lets the user back out of confirming", () => {
    render(
      <ListingRequestCancelBeforePaymentAction
        isPending={false}
        error={null}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel commission" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep commission" }));

    expect(
      screen.queryByRole("button", { name: "Confirm cancellation" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel commission" })
    ).toBeInTheDocument();
  });

  it("shows the error from a failed cancellation", () => {
    render(
      <ListingRequestCancelBeforePaymentAction
        isPending={false}
        error={new Error("A payment has already been collected.")}
        onCancel={vi.fn()}
      />
    );

    expect(
      screen.getByText("A payment has already been collected.")
    ).toBeInTheDocument();
  });
});
