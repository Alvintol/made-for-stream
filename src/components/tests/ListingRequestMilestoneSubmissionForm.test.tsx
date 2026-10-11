import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
}));

vi.mock("../../lib/listings/listingPreviewImage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/listings/listingPreviewImage")>()),
  renderListingPreviewImage: mocks.render,
}));

vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }));

import ListingRequestMilestoneSubmissionForm from "../listingRequests/milestones/ListingRequestMilestoneSubmissionForm";

const prepared = new Blob(["prepared"], { type: "image/webp" });

const png = (name = "sketch.png") =>
  new File(["x"], name, { type: "image/png" });

const choosePreviewFiles = (files: File[]) =>
  fireEvent.change(screen.getByLabelText("Preview images"), {
    target: { files },
  });

const pendingMilestone = {
  id: "milestone-1",
  status: "pending" as const,
  title: "Initial design direction",
  sort_order: 0,
};

const fillValidSubmission = () => {
  fireEvent.change(
    screen.getByLabelText(
      "Milestone submission summary"
    ),
    {
      target: {
        value:
          " The initial design concepts are ready for buyer review. ",
      },
    }
  );

  fireEvent.change(
    screen.getByLabelText(
      "Milestone delivery links"
    ),
    {
      target: {
        value:
          " https://example.com/concepts \n\nhttps://example.com/source-files ",
      },
    }
  );
};

describe(
  "ListingRequestMilestoneSubmissionForm",
  () => {
    beforeEach(() => {
      mocks.render.mockReset().mockResolvedValue(prepared);
      URL.createObjectURL = vi.fn(() => "blob:prepared");
      URL.revokeObjectURL = vi.fn();
    });

    it("does not render without a milestone", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={null}
          onSubmitMilestone={vi.fn()}
        />
      );

      expect(
        screen.queryByText(
          "Submit milestone"
        )
      ).not.toBeInTheDocument();
    });

    it("does not render for a milestone awaiting buyer review", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={{
            ...pendingMilestone,
            status: "submitted",
          }}
          onSubmitMilestone={vi.fn()}
        />
      );

      expect(
        screen.queryByRole("button", {
          name: "Submit milestone for review",
        })
      ).not.toBeInTheDocument();
    });

    it("renders the pending milestone", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          onSubmitMilestone={vi.fn()}
        />
      );

      expect(
        screen.getByRole("heading", {
          name: "Submit milestone",
        })
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "Initial design direction"
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText("Milestone 1")
      ).toBeInTheDocument();
    });

    it("shows validation errors for a missing summary", () => {
      const onSubmitMilestone = vi.fn();

      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          onSubmitMilestone={
            onSubmitMilestone
          }
        />
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit milestone for review",
        })
      );

      expect(
        screen.getByText(
          "Milestone submission summary must be between 10 and 4000 characters."
        )
      ).toBeInTheDocument();

      expect(
        onSubmitMilestone
      ).not.toHaveBeenCalled();
    });

    it("submits normalized milestone details", async () => {
      const onSubmitMilestone = vi.fn();

      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          onSubmitMilestone={
            onSubmitMilestone
          }
        />
      );

      fillValidSubmission();

      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit milestone for review",
        })
      );

      await waitFor(() => {
        expect(
          onSubmitMilestone
        ).toHaveBeenCalledWith({
          milestoneId: "milestone-1",
          summary:
            "The initial design concepts are ready for buyer review.",
          deliveryLinks: [
            "https://example.com/concepts",
            "https://example.com/source-files",
          ],
          previewImages: [],
        });
      });
    });

    it("prepares a watermarked copy of a preview image and submits the copy", async () => {
      const onSubmitMilestone = vi.fn();

      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          watermarkHandle="meowington"
          onSubmitMilestone={onSubmitMilestone}
        />
      );

      fillValidSubmission();
      choosePreviewFiles([png()]);

      expect(
        await screen.findByAltText(
          "Preview image 1 as the buyer will see it"
        )
      ).toHaveAttribute("src", "blob:prepared");

      expect(mocks.render).toHaveBeenCalledWith(
        expect.any(File),
        { watermarkText: "Made for Stream · @meowington" }
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit milestone for review",
        })
      );

      await waitFor(() => {
        expect(onSubmitMilestone).toHaveBeenCalledWith(
          expect.objectContaining({
            previewImages: [prepared],
          })
        );
      });
    });

    it("leaves out a preview image that was removed", async () => {
      const onSubmitMilestone = vi.fn();

      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          onSubmitMilestone={onSubmitMilestone}
        />
      );

      fillValidSubmission();
      choosePreviewFiles([png()]);

      fireEvent.click(
        await screen.findByRole("button", {
          name: "Remove image 1",
        })
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit milestone for review",
        })
      );

      await waitFor(() => {
        expect(onSubmitMilestone).toHaveBeenCalledWith(
          expect.objectContaining({ previewImages: [] })
        );
      });
    });

    it("refuses a preview file that is not an image, without preparing anything", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          onSubmitMilestone={vi.fn()}
        />
      );

      choosePreviewFiles([
        new File(["x"], "source.psd", {
          type: "image/vnd.adobe.photoshop",
        }),
      ]);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Choose a JPEG, PNG or WebP image."
      );
      expect(mocks.render).not.toHaveBeenCalled();
    });

    it("refuses more than 6 preview images", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          onSubmitMilestone={vi.fn()}
        />
      );

      choosePreviewFiles(
        Array.from({ length: 7 }, (_, index) =>
          png(`sketch-${index}.png`)
        )
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "A milestone submission can contain no more than 6 preview images."
      );
      expect(mocks.render).not.toHaveBeenCalled();
    });

    it("renders revision resubmission state", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={{
            ...pendingMilestone,
            status: "revision_requested",
          }}
          onSubmitMilestone={vi.fn()}
        />
      );

      expect(
        screen.getByRole("heading", {
          name: "Resubmit milestone",
        })
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          /The buyer requested revisions/
        )
      ).toBeInTheDocument();

      expect(
        screen.getByRole("button", {
          name: "Resubmit milestone for review",
        })
      ).toBeInTheDocument();
    });

    it("rejects more than 20 delivery links", () => {
      const onSubmitMilestone = vi.fn();

      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          onSubmitMilestone={
            onSubmitMilestone
          }
        />
      );

      fireEvent.change(
        screen.getByLabelText(
          "Milestone submission summary"
        ),
        {
          target: {
            value:
              "The initial design concepts are ready.",
          },
        }
      );

      fireEvent.change(
        screen.getByLabelText(
          "Milestone delivery links"
        ),
        {
          target: {
            value: Array.from(
              {
                length: 21,
              },
              (_, index) =>
                `https://example.com/file-${index + 1}`
            ).join("\n"),
          },
        }
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Submit milestone for review",
        })
      );

      expect(
        screen.getByText(
          "A milestone submission can contain no more than 20 delivery links."
        )
      ).toBeInTheDocument();

      expect(
        onSubmitMilestone
      ).not.toHaveBeenCalled();
    });

    it("renders submission errors", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          error={
            new Error(
              "Earlier milestones must be completed first."
            )
          }
          onSubmitMilestone={vi.fn()}
        />
      );

      expect(
        screen.getByText(
          "Earlier milestones must be completed first."
        )
      ).toBeInTheDocument();
    });

    it("disables the form while submitting", () => {
      render(
        <ListingRequestMilestoneSubmissionForm
          milestone={pendingMilestone}
          isPending
          onSubmitMilestone={vi.fn()}
        />
      );

      expect(
        screen.getByRole("button", {
          name: "Submitting milestone…",
        })
      ).toBeDisabled();

      expect(
        screen.getByLabelText(
          "Milestone submission summary"
        )
      ).toBeDisabled();

      expect(
        screen.getByLabelText(
          "Milestone delivery links"
        )
      ).toBeDisabled();
    });
  }
);