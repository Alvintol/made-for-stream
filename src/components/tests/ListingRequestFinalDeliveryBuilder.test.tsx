import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import ListingRequestFinalDeliveryBuilder from "../listingRequests/finalDeliveries/ListingRequestFinalDeliveryBuilder";

const agreement = {
  id: "agreement-1",
  status: "buyer_accepted" as const,
  starting_payment_status: "paid" as const,
};

const fillValidForm = () => {
  fireEvent.change(
    screen.getByLabelText("Delivery title"),
    {
      target: {
        value: " Final overlay delivery ",
      },
    }
  );

  fireEvent.change(
    screen.getByLabelText("Delivery summary"),
    {
      target: {
        value:
          " The completed overlay package is ready for buyer review. ",
      },
    }
  );

  fireEvent.change(
    screen.getByLabelText("Delivery links"),
    {
      target: {
        value:
          " https://example.com/final-overlay \n\nhttps://example.com/source-files ",
      },
    }
  );
};

describe("ListingRequestFinalDeliveryBuilder", () => {
  it("does not render unless the commission is accepted", () => {
    render(
      <ListingRequestFinalDeliveryBuilder
        requestStatus="submitted"
        agreement={agreement}
        onCreateFinalDelivery={vi.fn()}
      />
    );

    expect(
      screen.queryByText(
        "Create final project delivery"
      )
    ).not.toBeInTheDocument();
  });

  it("does not render before buyer agreement acceptance", () => {
    render(
      <ListingRequestFinalDeliveryBuilder
        requestStatus="accepted"
        agreement={{
          ...agreement,
          status: "sent",
        }}
        onCreateFinalDelivery={vi.fn()}
      />
    );

    expect(
      screen.queryByText(
        "Create final project delivery"
      )
    ).not.toBeInTheDocument();
  });

  it("does not render while starting payment is pending", () => {
    render(
      <ListingRequestFinalDeliveryBuilder
        requestStatus="accepted"
        agreement={{
          ...agreement,
          starting_payment_status:
            "payment_required",
        }}
        onCreateFinalDelivery={vi.fn()}
      />
    );

    expect(
      screen.queryByText(
        "Create final project delivery"
      )
    ).not.toBeInTheDocument();
  });

  it("renders when no starting payment was required", () => {
    render(
      <ListingRequestFinalDeliveryBuilder
        requestStatus="accepted"
        agreement={{
          ...agreement,
          starting_payment_status: "not_required",
        }}
        onCreateFinalDelivery={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        "Create final project delivery"
      )
    ).toBeInTheDocument();
  });

  it("shows validation errors for missing required fields", () => {
    const onCreateFinalDelivery = vi.fn();

    render(
      <ListingRequestFinalDeliveryBuilder
        requestStatus="accepted"
        agreement={agreement}
        onCreateFinalDelivery={
          onCreateFinalDelivery
        }
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Create and submit final delivery",
      })
    );

    expect(
      screen.getByText(
        "Final delivery title must be between 3 and 160 characters."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Final delivery summary must be between 10 and 4000 characters."
      )
    ).toBeInTheDocument();

    expect(
      onCreateFinalDelivery
    ).not.toHaveBeenCalled();
  });

  it("creates and submits a final delivery", async () => {
    const onCreateFinalDelivery = vi.fn();

    render(
      <ListingRequestFinalDeliveryBuilder
        requestStatus="accepted"
        agreement={agreement}
        onCreateFinalDelivery={
          onCreateFinalDelivery
        }
      />
    );

    fillValidForm();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Create and submit final delivery",
      })
    );

    await waitFor(() => {
      expect(
        onCreateFinalDelivery
      ).toHaveBeenCalledWith({
        agreementId: "agreement-1",
        status: "submitted",
        title: "Final overlay delivery",
        summary:
          "The completed overlay package is ready for buyer review.",
        deliveryLinks: [
          "https://example.com/final-overlay",
          "https://example.com/source-files",
        ],
      });
    });
  });

  it("saves a private final-delivery draft", async () => {
    const onCreateFinalDelivery = vi.fn();

    render(
      <ListingRequestFinalDeliveryBuilder
        requestStatus="accepted"
        agreement={agreement}
        onCreateFinalDelivery={
          onCreateFinalDelivery
        }
      />
    );

    fillValidForm();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Submit to the buyer now/,
      })
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Save final delivery draft",
      })
    );

    await waitFor(() => {
      expect(
        onCreateFinalDelivery
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          agreementId: "agreement-1",
          status: "draft",
        })
      );
    });
  });

  it("rejects more than 20 delivery links", () => {
    render(
      <ListingRequestFinalDeliveryBuilder
        requestStatus="accepted"
        agreement={agreement}
        onCreateFinalDelivery={vi.fn()}
      />
    );

    fillValidForm();

    fireEvent.change(
      screen.getByLabelText("Delivery links"),
      {
        target: {
          value: Array.from(
            { length: 21 },
            (_, index) =>
              `https://example.com/file-${index + 1}`
          ).join("\n"),
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Create and submit final delivery",
      })
    );

    expect(
      screen.getByText(
        "A final delivery can contain no more than 20 delivery links."
      )
    ).toBeInTheDocument();
  });

  it("renders creation errors", () => {
    render(
      <ListingRequestFinalDeliveryBuilder
        requestStatus="accepted"
        agreement={agreement}
        error={
          new Error(
            "The project has an unresolved hold."
          )
        }
        onCreateFinalDelivery={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        "The project has an unresolved hold."
      )
    ).toBeInTheDocument();
  });

  it("disables submission while pending", () => {
    render(
      <ListingRequestFinalDeliveryBuilder
        requestStatus="accepted"
        agreement={agreement}
        isPending
        onCreateFinalDelivery={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Saving final delivery…",
      })
    ).toBeDisabled();
  });
});