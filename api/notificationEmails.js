// Commission notification emails: one entry per `kind` written to
// public.listing_request_notifications by the triggers in
// supabase/migrations/20261007_148_add_listing_request_notifications.sql.
// The database decides what is sent and to whom; this file only says what
// each email reads like. notificationEmails.test.js fails if the migration
// uses a kind that has no entry here.
//
// Playbook: docs/support/messaging/commission-notifications.md.
import { renderActionEmail } from "./emailTemplates.js";

// Where a commission lives on the site for each side. The buyer's page has
// no prefix: "/buyer/requests/..." does not exist.
export const getListingRequestUrl = (appOrigin, listingRequestId, viewer) =>
  viewer === "creator"
    ? `${appOrigin}/creator/requests/${listingRequestId}`
    : `${appOrigin}/requests/${listingRequestId}`;

const formatCents = (cents, currency) =>
  typeof cents === "number" && currency
    ? `${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
        currencyDisplay: "narrowSymbol",
      }).format(cents / 100)} ${currency.toUpperCase()}`
    : null;

const amountOf = (payload) => formatCents(payload.amount_cents, payload.currency);
const named = (payload, fallback) => (payload.title ? `"${payload.title}"` : fallback);
const waited = (payload) =>
  payload.waiting_days ? `for ${payload.waiting_days} days` : "for a while";

// Each entry: subject and title (short), lines (plain sentences), an
// optional quoted note (the other person's own words), and the button.
// `t` is the commission's title, `p` the row's payload.
export const NOTIFICATION_EMAILS = {
  request_received: (t) => ({
    subject: `New commission request: "${t}"`,
    title: "You have a new commission request",
    lines: [
      `A buyer sent you a commission request, "${t}".`,
      "Open it to read the details, ask questions in the chat, and accept or decline.",
    ],
    cta: "Review commission request",
  }),
  request_reminder: (t, p) => ({
    subject: `Still waiting on you: "${t}"`,
    title: "A commission request is waiting for your answer",
    lines: [
      `"${t}" has been waiting ${waited(p)}. The buyer cannot move forward until you accept or decline it.`,
    ],
    cta: "Review commission request",
  }),
  request_accepted: (t) => ({
    subject: `Accepted: "${t}"`,
    title: "The creator accepted your commission request",
    lines: [
      `Good news: the creator accepted "${t}".`,
      "Next, the creator will send you a project agreement with the scope, price, timeline and payment schedule. You will get another email when it is ready. Nothing starts and nothing is charged until you review and accept that agreement.",
    ],
    cta: "Open commission",
  }),
  request_declined: (t, p) => ({
    subject: `Declined: "${t}"`,
    title: "The creator declined your commission request",
    lines: [`The creator is not able to take on "${t}". You have not been charged.`],
    noteLabel: "The creator's reason",
    note: p.reason,
    cta: "View commission",
  }),
  request_withdrawn: (t) => ({
    subject: `No longer waiting: "${t}"`,
    title: "A commission request was archived",
    lines: [
      `The commission request "${t}" was archived by the other person before it was accepted. Nothing more is needed from you.`,
    ],
    cta: "View commission",
  }),
  agreement_sent: (t) => ({
    subject: `Action needed: review the agreement for "${t}"`,
    title: "Your project agreement is ready to review",
    lines: [
      `The creator sent the project agreement for "${t}".`,
      "Please read the scope, price, timeline and payment schedule, tick each item to confirm you understand it, and accept or decline. Work cannot start until you accept.",
    ],
    cta: "Review agreement",
  }),
  agreement_reminder: (t, p) => ({
    subject: `Reminder: the agreement for "${t}" needs your answer`,
    title: "Your project agreement is still waiting",
    lines: [
      `The agreement for "${t}" has been waiting ${waited(p)}. The creator cannot start until you accept or decline it.`,
    ],
    cta: "Review agreement",
  }),
  agreement_accepted: (t) => ({
    subject: `Agreement accepted: "${t}"`,
    title: "The buyer accepted your project agreement",
    lines: [
      `The buyer read, acknowledged and accepted the agreement for "${t}".`,
      "If the agreement has a payment due before work starts, wait for the payment email before you begin. Otherwise you can start now.",
    ],
    cta: "Open commission",
  }),
  agreement_declined: (t) => ({
    subject: `Agreement declined: "${t}"`,
    title: "The buyer declined your project agreement",
    lines: [
      `The buyer declined the agreement for "${t}". You can talk it through in the chat and send a revised agreement.`,
    ],
    cta: "Open commission",
  }),
  change_order_sent: (t, p) => ({
    subject: `Action needed: a change to "${t}"`,
    title: "The creator proposed a change",
    lines: [
      `The creator proposed a change order, ${named(p, "a change")}, on "${t}". It may change the scope, price, timeline or deliverables.`,
      "Nothing changes until you accept it. Please review and accept or decline.",
    ],
    cta: "Review change",
  }),
  change_order_accepted: (t, p) => ({
    subject: `Change accepted: "${t}"`,
    title: "The buyer accepted your change order",
    lines: [
      `The buyer accepted ${named(p, "your change order")} on "${t}". If it added to the price, the buyer has been asked to pay the difference.`,
    ],
    cta: "Open commission",
  }),
  change_order_declined: (t, p) => ({
    subject: `Change declined: "${t}"`,
    title: "The buyer declined your change order",
    lines: [
      `The buyer declined ${named(p, "your change order")} on "${t}". The original agreement still applies.`,
    ],
    cta: "Open commission",
  }),
  payment_required: (t, p) => ({
    subject: `Payment due for "${t}"`,
    title: "A payment is due",
    lines: [
      `${p.title ? `"${p.title}"` : "A payment"} for "${t}" is ready to pay${amountOf(p) ? `: ${amountOf(p)}` : ""}.`,
      "The project waits on this payment. You pay in the creator's currency on a secure Stripe page.",
    ],
    cta: "Pay now",
  }),
  payment_reminder: (t, p) => ({
    subject: `Reminder: payment due for "${t}"`,
    title: "A payment is still waiting",
    lines: [
      `${p.title ? `"${p.title}"` : "A payment"} for "${t}"${amountOf(p) ? ` (${amountOf(p)})` : ""} has been unpaid ${waited(p)}.`,
      "The creator is waiting on it. If something is wrong, reply in the commission's chat so the creator knows.",
    ],
    cta: "Pay now",
  }),
  payment_received: (t, p) => ({
    subject: `Payment received for "${t}"`,
    title: "The buyer paid",
    lines: [
      `The buyer paid ${p.title ? `"${p.title}"` : "a payment"} for "${t}"${amountOf(p) ? `: ${amountOf(p)} before fees` : ""}.`,
      "You can carry on with the next step of the project.",
    ],
    cta: "Open commission",
  }),
  payment_refunded: (t, p) => ({
    subject: `Refund on "${t}"`,
    title: "A payment was refunded",
    lines: [
      `A refund was made on ${p.title ? `"${p.title}"` : "a payment"} for "${t}". Open the commission to see the amount.`,
    ],
    cta: "View commission",
  }),
  payment_disputed: (t, p) => ({
    subject: `Payment disputed: "${t}"`,
    title: "A payment is being disputed",
    lines: [
      `The buyer's bank opened a dispute on ${p.title ? `"${p.title}"` : "a payment"} for "${t}". Made for Stream will be in touch about what is needed from you.`,
    ],
    cta: "View commission",
  }),
  milestone_submitted: (t, p) => ({
    subject: `Action needed: review ${named(p, "a milestone")} on "${t}"`,
    title: "A milestone is ready for your review",
    lines: [
      `The creator submitted ${named(p, "a milestone")} on "${t}".`,
      "Please review the work and approve it or ask for revisions. Approving it makes that milestone's payment due.",
    ],
    cta: "Review milestone",
  }),
  milestone_review_reminder: (t, p) => ({
    subject: `Reminder: ${named(p, "a milestone")} on "${t}" needs your review`,
    title: "A milestone is still waiting for your review",
    lines: [
      `${named(p, "A milestone")} on "${t}" has been waiting ${waited(p)}. The creator cannot continue until you approve it or ask for revisions.`,
    ],
    cta: "Review milestone",
  }),
  milestone_approved: (t, p) => ({
    subject: `Milestone approved: "${t}"`,
    title: "The buyer approved your milestone",
    lines: [
      `The buyer approved ${named(p, "your milestone")} on "${t}" and has been asked to pay for it. You will get an email when the payment arrives.`,
    ],
    cta: "Open commission",
  }),
  milestone_revision_requested: (t, p) => ({
    subject: `Revisions needed: "${t}"`,
    title: "The buyer asked for revisions",
    lines: [`The buyer asked for changes to ${named(p, "your milestone")} on "${t}".`],
    noteLabel: "What the buyer asked for",
    note: p.reason,
    cta: "Open commission",
  }),
  final_delivery_submitted: (t) => ({
    subject: `Action needed: your final delivery for "${t}"`,
    title: "Your final delivery is ready to review",
    lines: [
      `The creator submitted the final delivery for "${t}".`,
      "Please review it and approve it or ask for revisions. Approving it completes the project.",
    ],
    cta: "Review delivery",
  }),
  final_delivery_review_reminder: (t, p) => ({
    subject: `Reminder: the final delivery for "${t}" needs your review`,
    title: "Your final delivery is still waiting",
    lines: [
      `The final delivery for "${t}" has been waiting ${waited(p)}. Please approve it or ask for revisions.`,
    ],
    cta: "Review delivery",
  }),
  final_delivery_revision_requested: (t, p) => ({
    subject: `Revisions needed on the final delivery: "${t}"`,
    title: "The buyer asked for revisions to the final delivery",
    lines: [`The buyer asked for changes to the final delivery for "${t}".`],
    noteLabel: "What the buyer asked for",
    note: p.reason,
    cta: "Open commission",
  }),
  progress_update_posted: (t, p) => ({
    subject: `Progress update on "${t}"`,
    title: "The creator posted a progress update",
    lines: [`The creator posted ${named(p, "an update")} on "${t}".`],
    cta: "Read update",
  }),
  progress_update_overdue: (t) => ({
    subject: `A progress update is due on "${t}"`,
    title: "You owe the buyer a progress update",
    lines: [
      `Your agreement for "${t}" promises regular progress updates, and one is now overdue.`,
      "Post a short update so the buyer knows where things stand. Missed updates are one of the things a buyer can raise if a project stalls.",
    ],
    cta: "Post an update",
  }),
  cancellation_statement_needed: (t, p) => ({
    subject: `Action needed: the buyer asked to cancel "${t}"`,
    title: "The buyer asked to cancel",
    lines: [
      `The buyer asked to cancel "${t}" after paying. Nothing is cancelled yet.`,
      "Please submit your itemised statement of the work done against each payment, so the buyer can accept it or dispute it.",
    ],
    noteLabel: "The buyer's reason",
    note: p.reason,
    cta: "Submit statement",
  }),
  cancellation_statement_ready: (t, p) => ({
    subject: `Action needed: cancellation statement for "${t}"`,
    title: "A cancellation statement needs your answer",
    lines: [
      `The creator provided an itemised statement for cancelling "${t}": what was earned, and what would be refunded.`,
      "Please accept it or dispute it. Accepting cancels the rest of the project.",
    ],
    noteLabel: "The reason given",
    note: p.reason,
    cta: "Review statement",
  }),
  cancellation_disputed: (t) => ({
    subject: `Cancellation statement disputed: "${t}"`,
    title: "The buyer disputed your cancellation statement",
    lines: [
      `The buyer did not accept your cancellation statement for "${t}". Made for Stream will review it. The project is not cancelled and no money has moved.`,
    ],
    cta: "Open commission",
  }),
  request_cancelled: (t, p) => ({
    subject: `Cancelled: "${t}"`,
    title: "This commission was cancelled",
    lines: [
      `"${t}" has been cancelled and is now closed. Any payment that had not been made is no longer due.`,
    ],
    noteLabel: "The reason given",
    note: p.reason,
    cta: "View commission",
  }),
  request_completed: (t) => ({
    subject: `Completed: "${t}"`,
    title: "This commission is complete",
    lines: [
      `"${t}" is complete: the final delivery was approved and the project is closed. Thank you for using Made for Stream.`,
    ],
    cta: "View commission",
  }),
};

// Null when the kind has no template (NOTIF-002).
export const renderNotificationEmail = ({ kind, requestTitle, payload, requestUrl }) => {
  const build = NOTIFICATION_EMAILS[kind];

  if (!build) {
    return null;
  }

  const content = build(requestTitle || "your commission", payload || {});

  return renderActionEmail({ ...content, ctaUrl: requestUrl, ctaLabel: content.cta });
};
