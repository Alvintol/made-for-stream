import { describe, expect, it } from "vitest";

import {
  canAcceptListingRequest,
  canArchiveListingRequest,
  canCancelListingRequestBeforePayment,
  canDeclineListingRequest,
  getListingRequestStatusesForView,
  getListingRequestStatusLabel,
  getListingRequestStatusSummary,
  getListingRequestStatusTone,
} from "../listings/listingRequests";
import {
  getListingRequestDisplayPreview,
  getListingRequestDisplayTitle,
} from "../listings/listings";

describe("listing commission status helpers", () => {
  it("maps commission list views to their statuses", () => {
    expect(
      getListingRequestStatusesForView("active")
    ).toEqual(["submitted", "accepted"]);

    expect(
      getListingRequestStatusesForView("completed")
    ).toEqual(["completed"]);

    expect(
      getListingRequestStatusesForView("archived")
    ).toEqual(["declined", "archived", "cancelled"]);
  });

  it("maps statuses to the correct labels", () => {
    expect(
      getListingRequestStatusLabel("submitted")
    ).toBe("Under review");

    expect(
      getListingRequestStatusLabel("accepted")
    ).toBe("Accepted");

    expect(
      getListingRequestStatusLabel("completed")
    ).toBe("Completed");

    expect(
      getListingRequestStatusLabel("declined")
    ).toBe("Declined");

    expect(
      getListingRequestStatusLabel("archived")
    ).toBe("Archived");

    expect(
      getListingRequestStatusLabel("cancelled")
    ).toBe("Cancelled");
  });

  it("maps archived labels with archive actor context", () => {
    expect(
      getListingRequestStatusLabel("archived", {
        buyer_user_id: "buyer-1",
        creator_user_id: "creator-1",
        archived_by_user_id: "buyer-1",
      })
    ).toBe("Withdrawn by buyer");

    expect(
      getListingRequestStatusLabel("archived", {
        buyer_user_id: "buyer-1",
        creator_user_id: "creator-1",
        archived_by_user_id: "creator-1",
      })
    ).toBe("Archived by creator");

    expect(
      getListingRequestStatusLabel("archived", {
        buyer_user_id: "buyer-1",
        creator_user_id: "creator-1",
        archived_by_user_id: null,
      })
    ).toBe("Archived");
  });

  it("maps cancelled labels with cancellation actor context", () => {
    expect(
      getListingRequestStatusLabel(
        "cancelled",
        undefined,
        {
          buyer_user_id: "buyer-1",
          creator_user_id: "creator-1",
          cancelled_by_user_id: "buyer-1",
        }
      )
    ).toBe("Cancelled by buyer");

    expect(
      getListingRequestStatusLabel(
        "cancelled",
        undefined,
        {
          buyer_user_id: "buyer-1",
          creator_user_id: "creator-1",
          cancelled_by_user_id: "creator-1",
        }
      )
    ).toBe("Cancelled by creator");

    expect(
      getListingRequestStatusLabel(
        "cancelled",
        undefined,
        {
          buyer_user_id: "buyer-1",
          creator_user_id: "creator-1",
          cancelled_by_user_id: null,
        }
      )
    ).toBe("Cancelled");
  });

  it("maps statuses to the correct tones", () => {
    expect(
      getListingRequestStatusTone("submitted")
    ).toBe("review");

    expect(
      getListingRequestStatusTone("accepted")
    ).toBe("success");

    expect(
      getListingRequestStatusTone("completed")
    ).toBe("success");

    expect(
      getListingRequestStatusTone("declined")
    ).toBe("danger");

    expect(
      getListingRequestStatusTone("archived")
    ).toBe("muted");

    expect(
      getListingRequestStatusTone("cancelled")
    ).toBe("danger");
  });

  it("maps statuses to the correct summaries", () => {
    expect(
      getListingRequestStatusSummary("submitted")
    ).toBe(
      "This commission request is currently under review by the creator."
    );

    expect(
      getListingRequestStatusSummary("accepted")
    ).toBe(
      "The creator has accepted this commission request."
    );

    expect(
      getListingRequestStatusSummary("completed")
    ).toBe(
      "The buyer approved the final delivery and the project is complete."
    );

    expect(
      getListingRequestStatusSummary("declined")
    ).toBe(
      "The creator has declined this commission request."
    );

    expect(
      getListingRequestStatusSummary("archived")
    ).toBe(
      "This commission has been archived."
    );

    expect(
      getListingRequestStatusSummary("cancelled")
    ).toBe(
      "This commission has been cancelled."
    );
  });

  it("maps archived summaries with archive actor context", () => {
    expect(
      getListingRequestStatusSummary("archived", {
        buyer_user_id: "buyer-1",
        creator_user_id: "creator-1",
        archived_by_user_id: "buyer-1",
      })
    ).toBe("The buyer withdrew this commission request.");

    expect(
      getListingRequestStatusSummary("archived", {
        buyer_user_id: "buyer-1",
        creator_user_id: "creator-1",
        archived_by_user_id: "creator-1",
      })
    ).toBe("The creator archived this commission.");

    expect(
      getListingRequestStatusSummary("archived", {
        buyer_user_id: "buyer-1",
        creator_user_id: "creator-1",
        archived_by_user_id: null,
      })
    ).toBe("This commission has been archived.");
  });

  it("includes the cancellation reason in the cancelled summary when present", () => {
    expect(
      getListingRequestStatusSummary(
        "cancelled",
        undefined,
        { cancellation_reason: "Schedule no longer works for either side." }
      )
    ).toBe(
      "This commission was cancelled: Schedule no longer works for either side."
    );
  });

  it("only allows unilateral pre-payment cancellation while accepted", () => {
    expect(
      canCancelListingRequestBeforePayment("accepted")
    ).toBe(true);

    expect(
      canCancelListingRequestBeforePayment("submitted")
    ).toBe(false);

    expect(
      canCancelListingRequestBeforePayment("completed")
    ).toBe(false);

    expect(
      canCancelListingRequestBeforePayment("cancelled")
    ).toBe(false);
  });

  it("only allows accept and decline while the commission is submitted", () => {
    expect(
      canAcceptListingRequest("submitted")
    ).toBe(true);

    expect(
      canDeclineListingRequest("submitted")
    ).toBe(true);

    expect(
      canAcceptListingRequest("accepted")
    ).toBe(false);

    expect(
      canAcceptListingRequest("completed")
    ).toBe(false);

    expect(
      canAcceptListingRequest("declined")
    ).toBe(false);

    expect(
      canAcceptListingRequest("archived")
    ).toBe(false);

    expect(
      canDeclineListingRequest("accepted")
    ).toBe(false);

    expect(
      canDeclineListingRequest("completed")
    ).toBe(false);

    expect(
      canDeclineListingRequest("declined")
    ).toBe(false);

    expect(
      canDeclineListingRequest("archived")
    ).toBe(false);
  });

  it("only allows archive while the commission is submitted", () => {
    expect(
      canArchiveListingRequest("submitted")
    ).toBe(true);

    expect(
      canArchiveListingRequest("accepted")
    ).toBe(false);

    expect(
      canArchiveListingRequest("completed")
    ).toBe(false);

    expect(
      canArchiveListingRequest("declined")
    ).toBe(false);

    expect(
      canArchiveListingRequest("archived")
    ).toBe(false);
  });
});

describe("listing commission display helpers", () => {
  it("uses the structured commission title before the listing snapshot title", () => {
    expect(
      getListingRequestDisplayTitle({
        request_title: " Custom cozy emote pack ",
        listing_snapshot: {
          title: "Custom Emote Pack",
        },
      })
    ).toBe("Custom cozy emote pack");
  });

  it("falls back to the listing snapshot title for legacy commissions", () => {
    expect(
      getListingRequestDisplayTitle({
        request_title: null,
        listing_snapshot: {
          title: "Custom Emote Pack",
        },
      })
    ).toBe("Custom Emote Pack");
  });

  it("falls back to an untitled label when no title context exists", () => {
    expect(
      getListingRequestDisplayTitle({
        request_title: "   ",
        listing_snapshot: null,
      })
    ).toBe("Untitled commission");
  });

  it("uses structured commission details before the legacy message", () => {
    expect(
      getListingRequestDisplayPreview({
        request_details:
          " I need three cozy emotes. ",
        message: "Legacy commission message.",
      })
    ).toBe("I need three cozy emotes.");
  });

  it("falls back to the legacy message for old commissions", () => {
    expect(
      getListingRequestDisplayPreview({
        request_details: null,
        message: " Legacy commission message. ",
      })
    ).toBe("Legacy commission message.");
  });

  it("truncates long previews", () => {
    expect(
      getListingRequestDisplayPreview(
        {
          request_details:
            "This preview is longer than the limit.",
          message: null,
        },
        12
      )
    ).toBe("This preview…");
  });
});