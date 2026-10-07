import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ListingRequestSubmissionDetails from "../listingRequests/core/ListingRequestSubmissionDetails";

describe("<ListingRequestSubmissionDetails />", () => {
  it("renders structured commission details", () => {
    render(
      <ListingRequestSubmissionDetails
        requestTitle="Custom cozy emote pack"
        requestDetails="I need three cozy emotes for my Twitch channel launch."
        fallbackMessage="Legacy fallback message."
        requestedTimeline="Flexible, ideally before June 10."
        budgetAmount={75}
        referenceLinks={["https://example.com/reference"]}
      />
    );

    expect(screen.getByText("Custom cozy emote pack")).toBeInTheDocument();
    expect(
      screen.getByText("I need three cozy emotes for my Twitch channel launch.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Flexible, ideally before June 10.")
    ).toBeInTheDocument();
    expect(screen.getByText("$75")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/reference")).toHaveAttribute(
      "href",
      "https://example.com/reference"
    );
  });

  it("falls back to the legacy message when structured details are missing", () => {
    render(
      <ListingRequestSubmissionDetails
        requestTitle={null}
        requestDetails={null}
        fallbackMessage="Legacy commission message."
        requestedTimeline={null}
        budgetAmount={null}
        referenceLinks={[]}
      />
    );

    expect(screen.getByText("No commission summary provided.")).toBeInTheDocument();
    expect(screen.getByText("Legacy commission message.")).toBeInTheDocument();
    expect(screen.getAllByText("Not provided")).toHaveLength(2);
    expect(screen.getByText("No Reference Links Provided.")).toBeInTheDocument();
  });
});