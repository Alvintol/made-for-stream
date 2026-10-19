import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ListingRequestFinalDeliveryBuyerActions from "../listingRequests/finalDeliveries/ListingRequestFinalDeliveryBuyerActions";
import RequestWorkspace from "../listingRequests/workspace/RequestWorkspace";
import {
  FOCUS_MESSAGES_EVENT,
  focusWorkspaceMessages,
  OFF_SITE_RECEIPTS_TARGET,
} from "../listingRequests/workspace/focusMessages";
import { getSectionOrder } from "../listingRequests/workspace/sectionSummaries";

const sentence =
  "Confirm in the chat that you received the work sent outside Made for Stream before approving the final delivery.";

const renderActions = (props: Partial<Parameters<typeof ListingRequestFinalDeliveryBuyerActions>[0]> = {}) => {
  const onApprove = vi.fn();

  render(
    <ListingRequestFinalDeliveryBuyerActions
      canApprove
      finalDelivery={{ id: "delivery-1", status: "submitted", title: "delivery title" }}
      onApprove={onApprove}
      onRequestRevision={vi.fn()}
      {...props}
    />,
  );

  return onApprove;
};

describe("work sent off site, from the buyer's approval panel", () => {
  it("says why and sends the buyer to the confirmation instead of approving", () => {
    const heard = vi.fn();
    window.addEventListener(FOCUS_MESSAGES_EVENT, heard);
    const onApprove = renderActions({ offSiteReceiptPending: true });

    expect(screen.getByText(sentence)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve final delivery" }));

    expect(heard).toHaveBeenCalledTimes(1);
    expect((heard.mock.calls[0][0] as CustomEvent).detail).toBe(OFF_SITE_RECEIPTS_TARGET);
    expect(screen.queryByRole("button", { name: "Confirm final delivery approval" })).not.toBeInTheDocument();
    expect(onApprove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Go to the confirmation" }));
    expect(heard).toHaveBeenCalledTimes(2);

    window.removeEventListener(FOCUS_MESSAGES_EVENT, heard);
  });

  it("does the same when the database refused it, without repeating the sentence", () => {
    renderActions({ error: { message: sentence } });

    expect(screen.getAllByText(sentence)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Go to the confirmation" })).toBeInTheDocument();
  });

  it("approves as before when nothing is waiting", () => {
    const onApprove = renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Approve final delivery" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm final delivery approval" }));

    expect(onApprove).toHaveBeenCalledWith("delivery-1");
    expect(screen.queryByText(sentence)).not.toBeInTheDocument();
  });
});

describe("the workspace", () => {
  it("switches to the Messages tab and brings the confirmation into view", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });

    render(
      <RequestWorkspace
        header={null}
        nextStep={null}
        conversation={
          <div id={OFF_SITE_RECEIPTS_TARGET} tabIndex={-1}>
            Did the work arrive?
          </div>
        }
        sections={<p>Project sections</p>}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Project" }));
    expect(screen.getByRole("tab", { name: "Project" })).toHaveAttribute("aria-selected", "true");

    act(() => focusWorkspaceMessages(OFF_SITE_RECEIPTS_TARGET));

    expect(screen.getByRole("tab", { name: "Messages" })).toHaveAttribute("aria-selected", "true");
    expect(document.activeElement).toBe(screen.getByText("Did the work arrive?"));

    raf.mockRestore();
  });

  it("lists the final delivery first once the project is complete", () => {
    expect(getSectionOrder("completed")[0]).toBe("delivery");
    expect(getSectionOrder("accepted")[0]).toBe("milestones");
  });
});
