import { describe, expect, it } from "vitest";
import {
  DECISION_EMAIL_STATUSES,
  getApplicantVisibleNote,
  shouldSendApplicationDecisionEmail,
} from "../creatorApplicationEmail.js";
import { renderCreatorApplicationDecisionEmail } from "../emailTemplates.js";

const application = (overrides = {}) => ({
  id: "app-1",
  status: "approved",
  submitted_at: "2026-10-01T10:00:00.000Z",
  reviewer_notes: null,
  rejection_reason: null,
  ...overrides,
});

describe("shouldSendApplicationDecisionEmail", () => {
  it.each(DECISION_EMAIL_STATUSES)("emails a first %s decision", (status) => {
    expect(
      shouldSendApplicationDecisionEmail({
        application: application({ status }),
        lastSent: null,
      }),
    ).toEqual({ send: true, reason: "new_decision" });
  });

  it.each(["draft", "submitted", "under_review", "suspended"])(
    "does not email %s: it is not a decision made here",
    (status) => {
      expect(
        shouldSendApplicationDecisionEmail({
          application: application({ status }),
          lastSent: null,
        }).send,
      ).toBe(false);
    },
  );

  it("does not repeat the same decision when the admin saves again", () => {
    expect(
      shouldSendApplicationDecisionEmail({
        application: application({ status: "needs_changes" }),
        lastSent: { status: "needs_changes", attempted_at: "2026-10-02T09:00:00.000Z" },
      }),
    ).toEqual({ send: false, reason: "already_sent" });
  });

  it("emails again when the decision changes", () => {
    expect(
      shouldSendApplicationDecisionEmail({
        application: application({ status: "approved" }),
        lastSent: { status: "needs_changes", attempted_at: "2026-10-02T09:00:00.000Z" },
      }).send,
    ).toBe(true);
  });

  it("emails a second 'needs changes' after the applicant resubmitted", () => {
    expect(
      shouldSendApplicationDecisionEmail({
        application: application({
          status: "needs_changes",
          submitted_at: "2026-10-03T12:00:00.000Z",
        }),
        lastSent: { status: "needs_changes", attempted_at: "2026-10-02T09:00:00.000Z" },
      }),
    ).toEqual({ send: true, reason: "resubmitted_since_last_email" });
  });

  it("handles a missing application", () => {
    expect(
      shouldSendApplicationDecisionEmail({ application: null, lastSent: null }).send,
    ).toBe(false);
  });
});

describe("getApplicantVisibleNote", () => {
  it("prefers the rejection reason, as the application page does", () => {
    expect(
      getApplicantVisibleNote({ rejection_reason: " Not original work ", reviewer_notes: "x" }),
    ).toBe("Not original work");
    expect(getApplicantVisibleNote({ reviewer_notes: "Add a recent upload" })).toBe(
      "Add a recent upload",
    );
    expect(getApplicantVisibleNote({})).toBe("");
  });
});

describe("renderCreatorApplicationDecisionEmail", () => {
  it("approved: says what to do next and links to payout setup", () => {
    const { subject, html, text } = renderCreatorApplicationDecisionEmail({
      status: "approved",
    });

    expect(subject).toBe("You're approved as a creator on Made for Stream");
    expect(html).toContain("Set up payouts");
    expect(html).toContain("/settings");
    expect(text).toContain("Publish your first listing");
    expect(html).not.toContain("A note from the reviewer");
  });

  it("needs changes: quotes the reviewer's note and links back to the application", () => {
    const { subject, html, text } = renderCreatorApplicationDecisionEmail({
      status: "needs_changes",
      note: "Please add a sample from the last 90 days.",
    });

    expect(subject).toBe("Your Made for Stream creator application needs changes");
    expect(html).toContain("Please add a sample from the last 90 days.");
    expect(html).toContain("/apply/creator");
    expect(text).toContain("What to change:\nPlease add a sample from the last 90 days.");
  });

  it("rejected: gives the reason and a way to question it", () => {
    const { subject, html } = renderCreatorApplicationDecisionEmail({
      status: "rejected",
      note: "Samples could not be verified as your own work.",
    });

    expect(subject).toBe("An update on your Made for Stream creator application");
    expect(html).toContain("Samples could not be verified as your own work.");
    expect(html).toContain("mailto:support@madeforstream.com");
  });

  it("escapes whatever the reviewer typed", () => {
    const { html } = renderCreatorApplicationDecisionEmail({
      status: "needs_changes",
      note: '<img src=x onerror="alert(1)"> & more',
    });

    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; more");
  });

  it("refuses a status that has no email", () => {
    expect(() =>
      renderCreatorApplicationDecisionEmail({ status: "suspended" }),
    ).toThrow(/No creator application email/);
  });

  it("uses the shared branded layout with a dark version", () => {
    const { html } = renderCreatorApplicationDecisionEmail({ status: "approved" });

    expect(html).toContain("linear-gradient(120deg,#6b34e0");
    expect(html).toContain("prefers-color-scheme: dark");
  });
});
