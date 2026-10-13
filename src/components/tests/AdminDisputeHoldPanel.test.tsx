import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retention: vi.fn(),
  mutate: vi.fn(),
  error: null as unknown,
}));

vi.mock("../../hooks/admin/useCommissionDisputeHold", () => ({
  useCommissionImageRetention: () => ({ data: mocks.retention() }),
  useSetCommissionDisputeHold: () => ({
    mutate: mocks.mutate,
    isPending: false,
    error: mocks.error,
  }),
}));

import AdminDisputeHoldPanel from "../listingRequests/core/AdminDisputeHoldPanel";

describe("<AdminDisputeHoldPanel />", () => {
  beforeEach(() => {
    mocks.mutate.mockReset();
    mocks.retention.mockReset().mockReturnValue(null);
    mocks.error = null;
  });

  it("needs a reason before a commission can be marked as in dispute", () => {
    render(<AdminDisputeHoldPanel requestId="request-1" />);

    const button = screen.getByRole("button", { name: "Mark as in dispute" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Why is this commission in dispute?"), {
      target: { value: " Chargeback opened " },
    });
    fireEvent.click(button);

    expect(mocks.mutate).toHaveBeenCalledWith(
      { inDispute: true, reason: "Chargeback opened" },
      expect.anything(),
    );
  });

  it("shows the reason and offers to end a dispute that is on", () => {
    mocks.retention.mockReturnValue({
      on_hold: true,
      hold_reason: "Chargeback opened",
      hold_placed_at: "2027-01-12T12:00:00.000Z",
      delete_after: "2027-04-01T12:00:00.000Z",
      deleted_at: null,
    });

    render(<AdminDisputeHoldPanel requestId="request-1" />);

    expect(screen.getByText(/In dispute since/)).toHaveTextContent("Chargeback opened");

    fireEvent.click(screen.getByRole("button", { name: "End dispute" }));
    expect(mocks.mutate).toHaveBeenCalledWith({ inDispute: false });
  });

  it("offers nothing once the images are already deleted", () => {
    mocks.retention.mockReturnValue({
      on_hold: false,
      hold_reason: null,
      hold_placed_at: null,
      delete_after: "2027-04-01T12:00:00.000Z",
      deleted_at: "2027-04-01T12:45:00.000Z",
    });

    render(<AdminDisputeHoldPanel requestId="request-1" />);

    expect(screen.getByText(/images were deleted on/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the database's reason when the change is refused", () => {
    mocks.error = { message: "Only an administrator can change a dispute hold.", code: "42501" };

    render(<AdminDisputeHoldPanel requestId="request-1" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Only an administrator can change a dispute hold.",
    );
  });
});
