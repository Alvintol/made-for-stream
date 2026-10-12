import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import ListingRequestChangeOrderBuilder from "../listingRequests/changeOrders/ListingRequestChangeOrderBuilder";

const agreement = {
  id: "agreement-1",
  status: "buyer_accepted" as const,
  currency: "cad",
  total_amount: 300,
  adjusted_estimated_completion_at:
    "2099-06-20T12:00:00.000Z",
};

const fillRequiredFields = () => {
  fireEvent.change(
    screen.getByLabelText("Change order title"),
    {
      target: {
        value: " Additional animated overlay ",
      },
    }
  );

  fireEvent.change(
    screen.getByLabelText("Proposed change details"),
    {
      target: {
        value:
          " Add one animated overlay and extend delivery by five days. ",
      },
    }
  );

  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "Scope",
    })
  );
};

describe("ListingRequestChangeOrderBuilder", () => {
  it("does not render unless the commission and agreement are active", () => {
    const { rerender } = render(
      <ListingRequestChangeOrderBuilder
        requestStatus="submitted"
        agreement={agreement}
        onCreateChangeOrder={vi.fn()}
      />
    );

    expect(
      screen.queryByText(
        "Create project change order"
      )
    ).not.toBeInTheDocument();

    rerender(
      <ListingRequestChangeOrderBuilder
        requestStatus="accepted"
        agreement={{
          ...agreement,
          status: "sent",
        }}
        onCreateChangeOrder={vi.fn()}
      />
    );

    expect(
      screen.queryByText(
        "Create project change order"
      )
    ).not.toBeInTheDocument();
  });

  it("shows validation errors for missing required values", () => {
    const onCreateChangeOrder = vi.fn();

    render(
      <ListingRequestChangeOrderBuilder
        requestStatus="accepted"
        agreement={agreement}
        onCreateChangeOrder={onCreateChangeOrder}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Create and send change order",
      })
    );

    expect(
      screen.getByText(
        "Change order title must be between 3 and 160 characters."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Change order summary must be between 10 and 4000 characters."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Select at least one project term being changed."
      )
    ).toBeInTheDocument();

    expect(
      onCreateChangeOrder
    ).not.toHaveBeenCalled();
  });

  it("requires revised values for price and timeline changes", () => {
    render(
      <ListingRequestChangeOrderBuilder
        requestStatus="accepted"
        agreement={agreement}
        onCreateChangeOrder={vi.fn()}
      />
    );

    fillRequiredFields();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Price",
      })
    );

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Timeline",
      })
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Create and send change order",
      })
    );

    expect(
      screen.getByText(
        "Enter a revised total amount of 0 or more."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Choose a revised completion date."
      )
    ).toBeInTheDocument();
  });

  it("creates and sends a valid change order", () => {
    const onCreateChangeOrder = vi.fn();

    render(
      <ListingRequestChangeOrderBuilder
        requestStatus="accepted"
        agreement={agreement}
        onCreateChangeOrder={onCreateChangeOrder}
      />
    );

    fillRequiredFields();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Price",
      })
    );

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Timeline",
      })
    );

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Deliverables",
      })
    );

    fireEvent.change(
      screen.getByLabelText(
        "Revised project total"
      ),
      {
        target: {
          value: "450",
        },
      }
    );

    fireEvent.change(
      screen.getByLabelText(
        "Revised completion date"
      ),
      {
        target: {
          value: "2099-06-25",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Create and send change order",
      })
    );

    expect(
      onCreateChangeOrder
    ).toHaveBeenCalledWith({
      agreementId: "agreement-1",
      status: "sent",
      title: "Additional animated overlay",
      summary:
        "Add one animated overlay and extend delivery by five days.",
      changesScope: true,
      changesPrice: true,
      changesTimeline: true,
      changesDeliverables: true,
      changesPaymentSchedule: false,
      changesMilestones: false,
      revisedTotalAmount: 450,
      revisedCompletionAt:
        "2099-06-25T12:00:00.000Z",
      proposedSnapshot: {
        summary:
          "Add one animated overlay and extend delivery by five days.",
        impacts: {
          changesScope: true,
          changesPrice: true,
          changesTimeline: true,
          changesDeliverables: true,
          changesPaymentSchedule: false,
          changesMilestones: false,
        },
        revised_total_amount: 450,
        revised_completion_at:
          "2099-06-25T12:00:00.000Z",
      },
    });
  });

  it("saves a private draft", () => {
    const onCreateChangeOrder = vi.fn();

    render(
      <ListingRequestChangeOrderBuilder
        requestStatus="accepted"
        agreement={agreement}
        onCreateChangeOrder={onCreateChangeOrder}
      />
    );

    fillRequiredFields();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Send to the buyer now/,
      })
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Save change order draft",
      })
    );

    expect(
      onCreateChangeOrder
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        revisedTotalAmount: null,
        revisedCompletionAt: null,
      })
    );
  });

  it("renders creation errors", () => {
    render(
      <ListingRequestChangeOrderBuilder
        requestStatus="accepted"
        agreement={agreement}
        error={
          new Error(
            "This agreement already has a pending change order."
          )
        }
        onCreateChangeOrder={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        "This agreement already has a pending change order."
      )
    ).toBeInTheDocument();
  });

  it("disables submission while pending", () => {
    render(
      <ListingRequestChangeOrderBuilder
        requestStatus="accepted"
        agreement={agreement}
        isPending
        onCreateChangeOrder={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Saving change order…",
      })
    ).toBeDisabled();
  });

  it("shows the database's own reason when a change order is refused", () => {
    render(
      <ListingRequestChangeOrderBuilder
        requestStatus="accepted"
        agreement={agreement}
        // What Supabase hands back: a plain object, not an Error.
        error={{
          message:
            "Each payment in a project must be at least 10.00 CAD, and this one is 5.00 CAD. Combine it with another payment or raise its amount.",
          code: "P0001",
        }}
        onCreateChangeOrder={vi.fn()}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Each payment in a project must be at least 10.00 CAD, and this one is 5.00 CAD."
    );
  });

  it("refuses a revised completion date that has already passed", () => {
    const onCreateChangeOrder = vi.fn();

    render(
      <ListingRequestChangeOrderBuilder
        requestStatus="accepted"
        agreement={agreement}
        onCreateChangeOrder={onCreateChangeOrder}
      />
    );

    fillRequiredFields();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Timeline" })
    );

    fireEvent.change(
      screen.getByLabelText("Revised completion date"),
      { target: { value: "2020-01-01" } }
    );

    // The date box also carries a "min", which stops a browser submitting
    // at all. Submitting the form directly checks the page still refuses
    // where a browser does not enforce it.
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Create and send change order" })
        .closest("form") as HTMLFormElement
    );

    expect(
      screen.getByText(
        "The revised completion date must be in the future."
      )
    ).toBeInTheDocument();
    expect(onCreateChangeOrder).not.toHaveBeenCalled();
  });

  it("starts from a withdrawn change order, so it can be corrected and sent again", () => {
    render(
      <ListingRequestChangeOrderBuilder
        requestStatus="accepted"
        agreement={agreement}
        startFrom={{
          title: "Additional animated overlay",
          summary: "Add one animated overlay to the project.",
          changes_scope: true,
          changes_price: true,
          changes_timeline: true,
          changes_deliverables: false,
          changes_payment_schedule: false,
          changes_milestones: false,
          revised_total_amount: 450,
          revised_completion_at: "2099-06-25T12:00:00.000Z",
        }}
        onCreateChangeOrder={vi.fn()}
      />
    );

    expect(
      screen.getByLabelText("Change order title")
    ).toHaveValue("Additional animated overlay");
    expect(
      screen.getByLabelText("Revised project total")
    ).toHaveValue(450);
    expect(
      screen.getByLabelText("Revised completion date")
    ).toHaveValue("2099-06-25");
    expect(
      screen.getByText(/starts from the change order you withdrew/)
    ).toBeInTheDocument();
  });
});
