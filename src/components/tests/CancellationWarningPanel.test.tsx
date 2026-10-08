import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  warnings: [] as Array<Record<string, unknown>>,
  send: vi.fn(),
  withdraw: vi.fn(),
}));

vi.mock("../../hooks/creatorRequests/useListingRequestCancellationWarnings", () => ({
  CANCELLATION_WARNING_DAYS: [7, 10, 14],
  useListingRequestCancellationWarnings: () => ({ data: mocks.warnings, isLoading: false }),
  useSendListingRequestCancellationWarning: () => ({
    mutateAsync: mocks.send,
    isPending: false,
    error: null,
  }),
  useWithdrawListingRequestCancellationWarning: () => ({
    mutate: mocks.withdraw,
    isPending: false,
    error: null,
  }),
}));

import CancellationWarningPanel from "../listingRequests/core/CancellationWarningPanel";

const openWarning = {
  id: "w1",
  sender_user_id: "creator",
  recipient_user_id: "buyer",
  requested_action: "Please pay milestone 1",
  response_days: 10,
  status: "open",
  sent_at: "2026-10-07T12:00:00Z",
  expires_at: "2026-10-17T12:00:00Z",
};

describe("<CancellationWarningPanel />", () => {
  beforeEach(() => {
    mocks.warnings = [];
    mocks.send.mockReset().mockResolvedValue(undefined);
    mocks.withdraw.mockReset();
  });

  it("sends a warning with the chosen number of days", async () => {
    render(<CancellationWarningPanel requestId="r1" currentUserId="creator" currentUserRole="creator" />);

    fireEvent.click(screen.getByRole("button", { name: "Send cancellation warning" }));

    // Too short to send yet.
    expect(screen.getByRole("button", { name: "Start the 7-day timer" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/What do you need from them/), {
      target: { value: "Please pay milestone 1" },
    });
    fireEvent.change(screen.getByLabelText(/How long do they have/), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: "Start the 14-day timer" }));

    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith({
        requestId: "r1",
        requestedAction: "Please pay milestone 1",
        responseDays: 14,
      }),
    );
  });

  it("tells each side what happens to money already paid", () => {
    const { unmount } = render(
      <CancellationWarningPanel requestId="r1" currentUserId="creator" currentUserRole="creator" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Send cancellation warning" }));
    expect(screen.getByText(/stay with you, including a deposit/)).toBeInTheDocument();
    unmount();

    render(<CancellationWarningPanel requestId="r1" currentUserId="buyer" currentUserRole="buyer" />);
    fireEvent.click(screen.getByRole("button", { name: "Send cancellation warning" }));
    expect(screen.getByText(/are refunded for the work not reached/)).toBeInTheDocument();
  });

  it("lets the sender withdraw a running warning, and nobody send a second", () => {
    mocks.warnings = [openWarning];

    render(<CancellationWarningPanel requestId="r1" currentUserId="creator" currentUserRole="creator" />);

    expect(screen.queryByRole("button", { name: "Send cancellation warning" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw warning" }));
    expect(mocks.withdraw).toHaveBeenCalledWith("w1");
  });

  it("tells the recipient to reply, and offers them no withdraw button", () => {
    mocks.warnings = [openWarning];

    render(<CancellationWarningPanel requestId="r1" currentUserId="buyer" currentUserRole="buyer" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Doing what is asked");
    expect(screen.getByRole("alert")).toHaveTextContent("You do not need to do both");
    expect(screen.getByRole("alert")).toHaveTextContent("Please pay milestone 1");
    expect(screen.queryByRole("button", { name: "Withdraw warning" })).toBeNull();
  });
});
