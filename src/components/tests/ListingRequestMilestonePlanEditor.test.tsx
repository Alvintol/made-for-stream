import { useState } from "react";
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

import ListingRequestMilestonePlanEditor from "../listingRequests/milestones/ListingRequestMilestonePlanEditor";
import type { ListingRequestMilestonePlanItem } from "../../domain/listings/listingRequestMilestones";

const initialMilestones: ListingRequestMilestonePlanItem[] =
  [
    {
      title: "Initial design direction",
      description:
        "Deliver initial concepts for buyer review.",
      amount: 150,
      sortOrder: 0,
    },
    {
      title: "Completed project package",
      description:
        "Deliver completed files and source assets.",
      amount: 350,
      sortOrder: 1,
    },
  ];

type HarnessProps = {
  initialValue?: ListingRequestMilestonePlanItem[];
  agreementTotal?: number;
  estimatedWorkDays?: number;
  validationErrors?: string[];
  disabled?: boolean;
  onChangeSpy?: (
    milestones: ListingRequestMilestonePlanItem[]
  ) => void;
};

const MilestoneEditorHarness = ({
  initialValue = initialMilestones,
  agreementTotal = 500,
  estimatedWorkDays = 21,
  validationErrors = [],
  disabled = false,
  onChangeSpy,
}: HarnessProps) => {
  const [milestones, setMilestones] =
    useState(initialValue);

  const handleChange = (
    nextMilestones:
      ListingRequestMilestonePlanItem[]
  ) => {
    setMilestones(nextMilestones);
    onChangeSpy?.(nextMilestones);
  };

  return (
    <ListingRequestMilestonePlanEditor
      agreementTotal={agreementTotal}
      currency="cad"
      disabled={disabled}
      estimatedWorkDays={estimatedWorkDays}
      milestones={milestones}
      validationErrors={validationErrors}
      onChange={handleChange}
    />
  );
};

describe(
  "ListingRequestMilestonePlanEditor",
  () => {
    it("renders the milestone plan and matching total", () => {
      render(<MilestoneEditorHarness />);

      expect(
        screen.getByDisplayValue(
          "Initial design direction"
        )
      ).toBeInTheDocument();

      expect(
        screen.getByDisplayValue(
          "Completed project package"
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "Milestone amounts match the agreement total."
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          /eligible for milestone payments/
        )
      ).toBeInTheDocument();
    });

    it("shows when a project is not eligible", () => {
      render(
        <MilestoneEditorHarness
          estimatedWorkDays={6}
        />
      );

      expect(
        screen.getByText(
          /Milestone payments need an estimated project length\s+of at least 7 days\./
        )
      ).toBeInTheDocument();

      // Shown, but locked until the project is long enough.
      expect(
        screen.getByRole("button", { name: "Add milestone" })
      ).toBeDisabled();
    });

    it("adds a new milestone", () => {
      render(<MilestoneEditorHarness />);

      fireEvent.click(
        screen.getByRole("button", {
          name: "Add milestone",
        })
      );

      expect(
        screen.getByLabelText(
          "Milestone 3 title"
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText("3", {
          selector: "div",
        })
      ).toBeInTheDocument();
    });

    it("updates milestone details and totals", () => {
      render(<MilestoneEditorHarness />);

      fireEvent.change(
        screen.getByLabelText(
          "Milestone 1 title"
        ),
        {
          target: {
            value: "Approved visual direction",
          },
        }
      );

      fireEvent.change(
        screen.getByLabelText(
          "Milestone 1 description"
        ),
        {
          target: {
            value:
              "Deliver the approved visual direction.",
          },
        }
      );

      fireEvent.change(
        screen.getByLabelText(
          "Milestone 1 amount"
        ),
        {
          target: {
            value: "200",
          },
        }
      );

      expect(
        screen.getByDisplayValue(
          "Approved visual direction"
        )
      ).toBeInTheDocument();

      expect(
        screen.getByDisplayValue(
          "Deliver the approved visual direction."
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "The milestone plan exceeds the agreement total by $50.00."
        )
      ).toBeInTheDocument();
    });

    it("removes a milestone and normalizes ordering", () => {
      const onChangeSpy = vi.fn();

      render(
        <MilestoneEditorHarness
          onChangeSpy={onChangeSpy}
        />
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Remove milestone 1",
        })
      );

      expect(
        screen.getByLabelText(
          "Milestone 1 title"
        )
      ).toHaveValue(
        "Completed project package"
      );

      expect(
        onChangeSpy
      ).toHaveBeenLastCalledWith([
        {
          title: "Completed project package",
          description:
            "Deliver completed files and source assets.",
          amount: 350,
          sortOrder: 0,
        },
      ]);

      expect(
        screen.getByText(
          "$150.00 remains unallocated."
        )
      ).toBeInTheDocument();
    });

    it("moves milestones and normalizes ordering", () => {
      const onChangeSpy = vi.fn();

      render(
        <MilestoneEditorHarness
          onChangeSpy={onChangeSpy}
        />
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Move milestone 2 up",
        })
      );

      expect(
        screen.getByLabelText(
          "Milestone 1 title"
        )
      ).toHaveValue(
        "Completed project package"
      );

      expect(
        onChangeSpy
      ).toHaveBeenLastCalledWith([
        {
          title: "Completed project package",
          description:
            "Deliver completed files and source assets.",
          amount: 350,
          sortOrder: 0,
        },
        {
          title: "Initial design direction",
          description:
            "Deliver initial concepts for buyer review.",
          amount: 150,
          sortOrder: 1,
        },
      ]);
    });

    it("renders validation errors", () => {
      render(
        <MilestoneEditorHarness
          validationErrors={[
            "Add at least two milestones to use milestone payments.",
            "Milestone amounts must equal the total agreement amount.",
          ]}
        />
      );

      expect(
        screen.getByText(
          "Add at least two milestones to use milestone payments."
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "Milestone amounts must equal the total agreement amount."
        )
      ).toBeInTheDocument();
    });

    it("disables milestone editing", () => {
      render(
        <MilestoneEditorHarness disabled />
      );

      expect(
        screen.getByRole("button", {
          name: "Add milestone",
        })
      ).toBeDisabled();

      expect(
        screen.getByLabelText(
          "Milestone 1 title"
        )
      ).toBeDisabled();

      expect(
        screen.getByRole("button", {
          name: "Remove milestone 1",
        })
      ).toBeDisabled();
    });
  }
);