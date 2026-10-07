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

import ListingRequestProgressUpdateForm from "../listingRequests/progressUpdates/ListingRequestProgressUpdateForm";
import type { ListingRequestAgreementRow } from "../../hooks/creatorRequests/useListingRequestAgreement";

type ProgressUpdateAgreement = Pick<
  ListingRequestAgreementRow,
  "id" | "status" | "starting_payment_status"
>;

const createAgreement = (
  overrides?: Partial<ProgressUpdateAgreement>
): ProgressUpdateAgreement => ({
  id: "agreement-1",
  status: "buyer_accepted",
  starting_payment_status: "paid",
  ...overrides,
});

const fillRequiredFields = () => {
  fireEvent.change(
    screen.getByLabelText("Update title"),
    {
      target: {
        value: " Initial concepts completed ",
      },
    }
  );

  fireEvent.change(
    screen.getByLabelText("Update details"),
    {
      target: {
        value:
          " The first concept sketches are ready for review. ",
      },
    }
  );
};

describe("ListingRequestProgressUpdateForm", () => {
  it("does not render before starting payment is cleared", () => {
    render(
      <ListingRequestProgressUpdateForm
        requestStatus="accepted"
        agreement={createAgreement({
          starting_payment_status:
            "payment_required",
        })}
        onCreateProgressUpdate={vi.fn()}
      />
    );

    expect(
      screen.queryByText(
        "Post project progress update"
      )
    ).not.toBeInTheDocument();
  });

  it("does not render when the commission is no longer accepted", () => {
    render(
      <ListingRequestProgressUpdateForm
        requestStatus="archived"
        agreement={createAgreement()}
        onCreateProgressUpdate={vi.fn()}
      />
    );

    expect(
      screen.queryByText(
        "Post project progress update"
      )
    ).not.toBeInTheDocument();
  });

  it("renders after the project is ready for work", () => {
    render(
      <ListingRequestProgressUpdateForm
        requestStatus="accepted"
        agreement={createAgreement()}
        onCreateProgressUpdate={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        "Post project progress update"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Post progress update",
      })
    ).toBeInTheDocument();
  });

  it("posts a progress update with trimmed values", async () => {
    const onCreateProgressUpdate = vi
      .fn()
      .mockResolvedValue(undefined);

    render(
      <ListingRequestProgressUpdateForm
        requestStatus="accepted"
        agreement={createAgreement()}
        onCreateProgressUpdate={
          onCreateProgressUpdate
        }
      />
    );

    fillRequiredFields();

    fireEvent.change(
      screen.getByLabelText("Progress percentage"),
      {
        target: {
          value: "35",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Post progress update",
      })
    );

    await waitFor(() => {
      expect(
        onCreateProgressUpdate
      ).toHaveBeenCalledWith({
        agreementId: "agreement-1",
        updateKind: "progress",
        title: "Initial concepts completed",
        body:
          "The first concept sketches are ready for review.",
        progressPercent: 35,
      });
    });

    expect(
      screen.getByLabelText("Update title")
    ).toHaveValue("");

    expect(
      screen.getByLabelText("Update details")
    ).toHaveValue("");

    expect(
      screen.getByLabelText(
        "Progress percentage"
      )
    ).toHaveValue(null);
  });

  it("posts an update without a progress percentage", async () => {
    const onCreateProgressUpdate = vi
      .fn()
      .mockResolvedValue(undefined);

    render(
      <ListingRequestProgressUpdateForm
        requestStatus="accepted"
        agreement={createAgreement()}
        onCreateProgressUpdate={
          onCreateProgressUpdate
        }
      />
    );

    fillRequiredFields();

    fireEvent.change(
      screen.getByLabelText("Update type"),
      {
        target: {
          value: "delay",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Post progress update",
      })
    );

    await waitFor(() => {
      expect(
        onCreateProgressUpdate
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          updateKind: "delay",
          progressPercent: null,
        })
      );
    });
  });

  it("shows validation errors for invalid fields", () => {
    const onCreateProgressUpdate = vi.fn();

    render(
      <ListingRequestProgressUpdateForm
        requestStatus="accepted"
        agreement={createAgreement()}
        onCreateProgressUpdate={
          onCreateProgressUpdate
        }
      />
    );

    fireEvent.change(
      screen.getByLabelText("Progress percentage"),
      {
        target: {
          value: "101",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Post progress update",
      })
    );

    expect(
      screen.getByText(
        "Update title must be between 3 and 160 characters."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Update details must be between 10 and 4000 characters."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Progress percentage must be a whole number between 0 and 100."
      )
    ).toBeInTheDocument();

    expect(
      onCreateProgressUpdate
    ).not.toHaveBeenCalled();
  });

  it("disables the submit action while pending", () => {
    render(
      <ListingRequestProgressUpdateForm
        requestStatus="accepted"
        agreement={createAgreement()}
        isPending
        onCreateProgressUpdate={vi.fn()}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Posting progress update…",
      })
    ).toBeDisabled();
  });

  it("renders progress update creation errors", () => {
    render(
      <ListingRequestProgressUpdateForm
        requestStatus="accepted"
        agreement={createAgreement()}
        error={
          new Error(
            "Progress update could not be saved."
          )
        }
        onCreateProgressUpdate={vi.fn()}
      />
    );

    expect(
      screen.getByText(
        "Progress update could not be saved."
      )
    ).toBeInTheDocument();
  });
});