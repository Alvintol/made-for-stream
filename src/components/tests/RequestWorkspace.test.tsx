import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { RequestNextStep } from "../../domain/listings/requestWorkspace";
import ExpandingFormPanel from "../listingRequests/workspace/ExpandingFormPanel";
import ActionMenu from "../ui/ActionMenu";
import RequestNextStepCard from "../listingRequests/workspace/RequestNextStepCard";
import RequestWorkspace from "../listingRequests/workspace/RequestWorkspace";
import WorkspaceSectionList from "../listingRequests/workspace/WorkspaceSectionList";
import {
  orderSections,
  summarizeProgress,
  summarizeSchedule,
  type WorkspaceSectionSpec,
} from "../listingRequests/workspace/sectionSummaries";

const step: RequestNextStep = {
  key: "pay-deposit",
  owner: "buyer",
  tone: "action",
  actionTitle: "Pay the deposit",
  actionDescription: "Work starts once the deposit is confirmed.",
  actionLabel: "View payment",
  waitingTitle: "Waiting for the buyer's deposit",
  waitingDescription: "You can start once the deposit is confirmed.",
  sectionId: "payments",
};

const sections: WorkspaceSectionSpec[] = [
  {
    id: "snapshot",
    title: "Listing snapshot",
    summary: "Frozen copy",
    content: <p>Snapshot body</p>,
  },
  {
    id: "payments",
    title: "Payments",
    summary: "$0 of $300 paid",
    attention: true,
    content: <button type="button">Pay now</button>,
  },
  {
    id: "progress",
    title: "Progress updates",
    summary: "No updates yet",
    visible: false,
    content: <p>Hidden progress</p>,
  },
];

const renderWorkspace = (viewer: "buyer" | "creator" | "admin") =>
  render(
    <MemoryRouter>
      <RequestWorkspace
        header={<h1>Header</h1>}
        nextStep={
          <RequestNextStepCard step={step} viewer={viewer} buyerLabel="@buyer" creatorLabel="@creator" />
        }
        conversation={<p>Chat</p>}
        sections={<WorkspaceSectionList requestStatus="accepted" sections={sections} />}
      />
    </MemoryRouter>
  );

describe("RequestNextStepCard", () => {
  it("tells the owner what to do and links to the section", () => {
    renderWorkspace("buyer");

    const card = screen.getByRole("region", { name: "Next step" });

    expect(within(card).getByText("Next step for you")).toBeInTheDocument();
    expect(within(card).getByText("Pay the deposit")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "View payment" })).toBeInTheDocument();
  });

  it("tells the other party who they are waiting on, without an action button", () => {
    renderWorkspace("creator");

    const card = screen.getByRole("region", { name: "Next step" });

    expect(within(card).getByText("Waiting on @buyer")).toBeInTheDocument();
    expect(within(card).getByText("Waiting for the buyer's deposit")).toBeInTheDocument();
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });

  it("names the responsible party for admins", () => {
    renderWorkspace("admin");

    expect(screen.getByText("Buyer: Pay the deposit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument();
  });
});

describe("workspace sections", () => {
  it("floats attention sections first, hides invisible ones, and opens them", () => {
    renderWorkspace("buyer");

    const aside = screen.getByRole("complementary", { name: "Project details" });
    const toggles = within(aside).getAllByRole("button", { expanded: undefined });

    expect(toggles[0]).toHaveAccessibleName(/Payments/);
    expect(toggles[0]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.queryByText("Hidden progress")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Listing snapshot/ })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("toggles a section open and closed", () => {
    renderWorkspace("buyer");

    const toggle = screen.getByRole("button", { name: /Listing snapshot/ });

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("jumps from the next-step card to its section and the project tab", () => {
    renderWorkspace("buyer");

    const messagesTab = screen.getByRole("tab", { name: "Messages" });
    const projectTab = screen.getByRole("tab", { name: "Project" });

    expect(messagesTab).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "View payment" }));

    expect(projectTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: /Payments/ })).toHaveAttribute("aria-expanded", "true");
  });
});

describe("ExpandingFormPanel", () => {
  const renderPanel = () =>
    render(
      <ExpandingFormPanel title="Post a progress update" description="Keep the buyer posted." launchLabel="Post update">
        {(close) => (
          <button type="button" onClick={close}>
            Save update
          </button>
        )}
      </ExpandingFormPanel>
    );

  it("keeps the form out of the column until launched, then shows it as a page-covering dialog", () => {
    renderPanel();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Post update" }));

    const dialog = screen.getByRole("dialog", { name: "Post a progress update" });

    expect(within(dialog).getByRole("button", { name: "Save update" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes from the Close button, Escape, or the form itself", () => {
    renderPanel();
    const launcher = screen.getByRole("button", { name: "Post update" });

    fireEvent.click(launcher);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(launcher).toHaveFocus();

    fireEvent.click(launcher);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(launcher);
    fireEvent.click(screen.getByRole("button", { name: "Save update" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("ActionMenu", () => {
  it("opens on click and closes on Escape", () => {
    render(
      <ActionMenu>
        <button type="button">Archive commission</button>
      </ActionMenu>
    );

    expect(screen.queryByRole("button", { name: "Archive commission" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Manage/ }));
    expect(screen.getByRole("button", { name: "Archive commission" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Archive commission" })).not.toBeInTheDocument();
  });
});

describe("section summaries", () => {
  it("orders by attention, then lifecycle order", () => {
    const ordered = orderSections(
      [
        { id: "snapshot", title: "", summary: "", content: null },
        { id: "milestones", title: "", summary: "", content: null },
        { id: "delivery", title: "", summary: "", content: null, attention: true },
      ],
      ["milestones", "delivery", "snapshot"]
    );

    expect(ordered.map((section) => section.id)).toEqual(["delivery", "milestones", "snapshot"]);
  });

  it("summarises the payment schedule and flags due payments", () => {
    expect(
      summarizeSchedule({
        currency: "cad",
        listing_request_payment_schedule_items: [
          { amount: 100, status: "paid" },
          { amount: 200, status: "payment_required" },
          { amount: 50, status: "cancelled" },
        ],
      })
    ).toBe("$100 of $300 paid · payment due");
    expect(summarizeSchedule(null)).toBe("No payments scheduled");
  });

  it("tolerates progress updates without timestamps", () => {
    expect(summarizeProgress([{ created_at: undefined }])).toBe("1 update");
    expect(summarizeProgress([])).toBe("No updates yet");
  });
});
