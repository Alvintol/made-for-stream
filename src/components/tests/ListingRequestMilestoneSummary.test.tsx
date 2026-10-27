import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
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

const mocks = vi.hoisted(() => ({
  getUrls: vi.fn(),
}));

vi.mock("../../lib/listings/milestonePreviewImage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/listings/milestonePreviewImage")>()),
  getMilestonePreviewImageUrls: mocks.getUrls,
}));

import ListingRequestMilestoneSummary from "../listingRequests/milestones/ListingRequestMilestoneSummary";
import type { ListingRequestMilestoneRow } from "../../hooks/creatorRequests/useListingRequestMilestones";
import type { ListingRequestMilestoneSubmissionRow } from "../../hooks/creatorRequests/useListingRequestMilestoneSubmissions";

const createMilestone = (
  overrides?: Partial<ListingRequestMilestoneRow>
): ListingRequestMilestoneRow => ({
  id: "milestone-1",
  listing_request_id: "request-1",
  agreement_id: "agreement-1",
  agreement_item_id: "item-1",
  payment_schedule_item_id: "payment-1",
  creator_user_id: "creator-1",
  buyer_user_id: "buyer-1",
  status: "pending",
  title: "Initial design direction",
  description:
    "Deliver initial concepts for buyer review.",
  amount: 100,
  currency: "cad",
  sort_order: 0,
  submission_version: 0,
  latest_submitted_at: null,
  latest_revision_requested_at: null,
  buyer_approved_at: null,
  payment_required_at: null,
  paid_at: null,
  cancelled_at: null,
  created_at: "2026-06-16T12:00:00.000Z",
  updated_at: "2026-06-16T12:00:00.000Z",
  ...overrides,
});

const createSubmission = (
  overrides?: Partial<ListingRequestMilestoneSubmissionRow>
): ListingRequestMilestoneSubmissionRow => ({
  id: "milestone-submission-1",
  milestone_id: "milestone-1",
  listing_request_id: "request-1",
  agreement_id: "agreement-1",
  creator_user_id: "creator-1",
  buyer_user_id: "buyer-1",
  version_number: 1,
  status: "submitted",
  summary:
    "The initial design concepts are ready for review.",
  delivery_links: [
    "https://example.com/concepts",
  ],
  preview_image_paths: [],
  revision_request_reason: null,
  submitted_at: "2026-06-16T12:00:00.000Z",
  revision_requested_at: null,
  buyer_approved_at: null,
  superseded_at: null,
  created_at: "2026-06-16T12:00:00.000Z",
  updated_at: "2026-06-16T12:00:00.000Z",
  ...overrides,
});

describe("ListingRequestMilestoneSummary", () => {
  it("renders the loading state", () => {
    render(
      <ListingRequestMilestoneSummary
        milestones={[]}
        submissions={[]}
        viewer="creator"
        isLoading
      />
    );

    expect(
      screen.getByText("Loading milestones…")
    ).toBeInTheDocument();
  });

  it("renders the empty state", () => {
    render(
      <ListingRequestMilestoneSummary
        milestones={[]}
        submissions={[]}
        viewer="creator"
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "No milestones yet",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "No milestones are available yet. They will appear here once the buyer accepts a milestone-based agreement."
      )
    ).toBeInTheDocument();
  });

  it("renders query errors", () => {
    render(
      <ListingRequestMilestoneSummary
        milestones={[]}
        submissions={[]}
        viewer="creator"
        error={
          new Error(
            "Milestones are unavailable."
          )
        }
      />
    );

    expect(
      screen.getByText(
        "Milestones are unavailable."
      )
    ).toBeInTheDocument();
  });

  it("renders milestone status and amount", () => {
    render(
      <ListingRequestMilestoneSummary
        milestones={[
          createMilestone({
            status: "pending",
          }),
        ]}
        submissions={[]}
        viewer="buyer"
      />
    );

    expect(
      screen.getByText(
        "Initial design direction"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("Not started")
    ).toBeInTheDocument();

    expect(
      screen.getByText("$100.00")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "No submission has been made for this milestone yet."
      )
    ).toBeInTheDocument();
  });

  it("renders latest submission details", () => {
    render(
      <ListingRequestMilestoneSummary
        milestones={[
          createMilestone({
            status: "submitted",
            latest_submitted_at:
              "2026-06-17T12:00:00.000Z",
          }),
        ]}
        submissions={[
          createSubmission({
            id: "old-submission",
            version_number: 1,
            summary: "Old concept draft.",
          }),
          createSubmission({
            id: "new-submission",
            version_number: 2,
            summary:
              "The revised concepts are ready.",
            delivery_links: [
              "https://example.com/revised",
            ],
          }),
        ]}
        viewer="creator"
      />
    );

    expect(
      screen.getByText(
        "Awaiting buyer review"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "The revised concepts are ready."
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Old concept draft.")
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Milestone delivery link 1",
      })
    ).toHaveAttribute(
      "href",
      "https://example.com/revised"
    );

    expect(
      screen.getByText("Jun 17, 2026")
    ).toBeInTheDocument();
  });

  it("shows the latest submission's preview images through temporary addresses", async () => {
    mocks.getUrls.mockResolvedValue([
      "https://example.com/signed/sketch",
      "https://example.com/signed/turnaround.webm?token=abc",
    ]);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ListingRequestMilestoneSummary
          milestones={[
            createMilestone({ status: "submitted" }),
          ]}
          submissions={[
            createSubmission({
              preview_image_paths: [
                "milestone-1/sketch.webp",
                "milestone-1/turnaround.webm",
              ],
            }),
          ]}
          viewer="buyer"
        />
      </QueryClientProvider>
    );

    // A recorded preview plays as a video, on a loop, without sound.
    const video = await screen.findByLabelText("Milestone preview video 2");
    expect(video.tagName).toBe("VIDEO");
    expect(video).toHaveAttribute("src", "https://example.com/signed/turnaround.webm?token=abc");

    expect(
      await screen.findByAltText(
        "Milestone preview image 1"
      )
    ).toHaveAttribute(
      "src",
      "https://example.com/signed/sketch"
    );

    expect(mocks.getUrls).toHaveBeenCalledWith([
      "milestone-1/sketch.webp",
      "milestone-1/turnaround.webm",
    ]);
  });

  it("says so when the preview images were deleted after the commission closed", () => {
    render(
      <ListingRequestMilestoneSummary
        milestones={[createMilestone({ status: "paid" })]}
        submissions={[
          createSubmission({
            status: "buyer_approved",
            preview_image_paths: [],
            preview_images_deleted_at: "2027-04-20T00:45:00.000Z",
          }),
        ]}
        viewer="buyer"
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Initial design direction/ })
    );

    expect(
      screen.getByText(/were deleted 180 days after the commission closed/)
    ).toBeInTheDocument();
  });

  it("renders revision request details", () => {
    render(
      <ListingRequestMilestoneSummary
        milestones={[
          createMilestone({
            status: "revision_requested",
          }),
        ]}
        submissions={[
          createSubmission({
            status: "revision_requested",
            revision_request_reason:
              "Please adjust the colour direction.",
          }),
        ]}
        viewer="creator"
      />
    );

    expect(
      screen.getByText("Revision requested")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Please adjust the colour direction/
      )
    ).toBeInTheDocument();
  });

  it("sorts milestones by agreement order", () => {
    render(
      <ListingRequestMilestoneSummary
        milestones={[
          createMilestone({
            id: "milestone-2",
            title: "Second milestone",
            sort_order: 1,
          }),
          createMilestone({
            id: "milestone-1",
            title: "First milestone",
            sort_order: 0,
          }),
        ]}
        submissions={[]}
        viewer="admin"
      />
    );

    const headings = screen.getAllByRole(
      "heading",
      {
        level: 3,
      }
    );

    expect(headings[0]).toHaveTextContent(
      "First milestone"
    );

    expect(headings[1]).toHaveTextContent(
      "Second milestone"
    );
  });

  it("explains when all milestones are complete", () => {
    render(
      <ListingRequestMilestoneSummary
        milestones={[
          createMilestone({
            id: "milestone-1",
            status: "paid",
            title: "Initial design direction",
            sort_order: 0,
          }),
          createMilestone({
            id: "milestone-2",
            status: "paid",
            title: "Completed project package",
            sort_order: 1,
          }),
        ]}
        submissions={[]}
        viewer="buyer"
      />
    );

    expect(
      screen.getByText(
        "All milestones are complete or closed. The creator can now prepare the final delivery."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("Initial design direction")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Completed project package")
    ).toBeInTheDocument();
  });

  it("uses admin completed milestone copy", () => {
    render(
      <ListingRequestMilestoneSummary
        milestones={[
          createMilestone({
            status: "paid",
          }),
        ]}
        submissions={[]}
        viewer="admin"
      />
    );

    expect(
      screen.getByText(
        "All milestones are complete or closed for this commission."
      )
    ).toBeInTheDocument();
  });

  it("treats cancelled milestones as terminal in the completed state", () => {
    render(
      <ListingRequestMilestoneSummary
        milestones={[
          createMilestone({
            id: "milestone-1",
            status: "paid",
            title: "Initial design direction",
            sort_order: 0,
          }),
          createMilestone({
            id: "milestone-2",
            status: "cancelled",
            title: "Optional polish pass",
            sort_order: 1,
          }),
        ]}
        submissions={[]}
        viewer="admin"
      />
    );

    expect(
      screen.getByText(
        "All milestones are complete or closed for this commission."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("Optional polish pass")
    ).toBeInTheDocument();
  });
});