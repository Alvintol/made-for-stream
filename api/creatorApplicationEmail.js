// Emails an applicant when an administrator decides their creator
// application: approved, sent back for changes, or rejected. The admin page
// writes the decision to seller_applications, then calls
// POST /api/creator-applications/:id/send-decision-email. The route reads
// the decision from the database (never from the request), and
// seller_application_decision_emails (20261005_142) records each attempt.
// Playbook: docs/support/creators/applications.md (APP-006).

// "under_review" is internal progress, not a decision. "suspended" is an
// account sanction with its own appeal route (appeals@), and is deliberately
// not emailed from here.
export const DECISION_EMAIL_STATUSES = ["approved", "needs_changes", "rejected"];

// Send once per decision. `lastSent` is the newest *sent* row for this
// application (or null). A second round -- the applicant resubmitted after
// "needs changes" and got the same outcome again -- is a new decision, so it
// is emailed again; re-saving notes on the same decision is not.
export const shouldSendApplicationDecisionEmail = ({ application, lastSent }) => {
  if (!application || !DECISION_EMAIL_STATUSES.includes(application.status)) {
    return { send: false, reason: "not_a_decision" };
  }

  if (!lastSent || lastSent.status !== application.status) {
    return { send: true, reason: "new_decision" };
  }

  const submittedAt = Date.parse(application.submitted_at || "");
  const sentAt = Date.parse(lastSent.attempted_at || "");

  if (!Number.isNaN(submittedAt) && !Number.isNaN(sentAt) && submittedAt > sentAt) {
    return { send: true, reason: "resubmitted_since_last_email" };
  }

  return { send: false, reason: "already_sent" };
};

// The note the applicant is shown on their application page, in the same
// order that page uses (src/pages/creator/ApplyCreator.tsx).
export const getApplicantVisibleNote = (application) =>
  String(application?.rejection_reason || application?.reviewer_notes || "").trim();
