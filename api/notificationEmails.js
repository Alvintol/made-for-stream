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

// Chat emails open the conversation itself, the same page for both sides.
const CONVERSATION_KINDS = new Set(["conversation_started", "message_received"]);

// The page an email's button opens. `row` is a listing_request_notifications
// row; `buyerUserId` is the commission's buyer, when there is a commission.
export const getNotificationUrl = (appOrigin, row, buyerUserId) =>
  row.conversation_id && (CONVERSATION_KINDS.has(row.kind) || !row.listing_request_id)
    ? `${appOrigin}/messages/${row.conversation_id}`
    : getListingRequestUrl(
        appOrigin,
        row.listing_request_id,
        buyerUserId === row.recipient_user_id ? "buyer" : "creator",
      );

const deadline = (payload) =>
  payload.expires_at
    ? new Date(payload.expires_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : "the deadline";

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

// How an email refers to the people involved: by handle (as it is written
// on their profile, with no "@") when the account has one, and by role
// ("the buyer", "the creator") when it does not, or when the handles could
// not be read. `names` is { buyer, creator, other }, each a handle or empty;
// `other` is whoever the recipient is not. Capitalised keys start a sentence.
const people = (names = {}, payload = {}) => ({
  buyer: names.buyer || "the buyer",
  Buyer: names.buyer || "The buyer",
  aBuyer: names.buyer || "A buyer",
  creator: names.creator || "the creator",
  Creator: names.creator || "The creator",
  other: names.other || "the other person",
  Other: names.other || "The other person",
  // Chat emails: the database's own name for the sender is the fallback.
  sender: names.other || payload.sender || "",
});

// Each entry: subject and title (short), lines (plain sentences), an
// optional quoted note (the other person's own words), and the button.
// `t` is the commission's title, `p` the row's payload, and `n` the people
// involved (see `people` above): their handle where they have one.
export const NOTIFICATION_EMAILS = {
  request_received: (t, p, n) => ({
    subject: `New commission request: "${t}"`,
    title: "You have a new commission request",
    lines: [
      `${n.aBuyer} sent you a commission request, "${t}".`,
      "Open it to read the details, ask questions in the chat, and accept or decline.",
    ],
    cta: "Review commission request",
  }),
  request_reminder: (t, p, n) => ({
    subject: `Still waiting on you: "${t}"`,
    title: "A commission request is waiting for your answer",
    lines: [
      `"${t}" has been waiting ${waited(p)}. ${n.Buyer} cannot move forward until you accept or decline it.`,
    ],
    cta: "Review commission request",
  }),
  request_accepted: (t, p, n) => ({
    subject: `Accepted: "${t}"`,
    title: `${n.Creator} accepted your commission request`,
    lines: [
      `Good news: ${n.creator} accepted "${t}".`,
      `Next, ${n.creator} will send you a project agreement with the scope, price, timeline and payment schedule. You will get another email when it is ready. Nothing starts and nothing is charged until you review and accept that agreement.`,
    ],
    cta: "Open commission",
  }),
  request_declined: (t, p, n) => ({
    subject: `Declined: "${t}"`,
    title: `${n.Creator} declined your commission request`,
    lines: [`${n.Creator} is not able to take on "${t}". You have not been charged.`],
    noteLabel: `${n.Creator}'s reason`,
    note: p.reason,
    cta: "View commission",
  }),
  request_withdrawn: (t, p, n) => ({
    subject: `No longer waiting: "${t}"`,
    title: "A commission request was archived",
    lines: [
      `The commission request "${t}" was archived by ${n.other} before it was accepted. Nothing more is needed from you.`,
    ],
    cta: "View commission",
  }),
  agreement_sent: (t, p, n) => ({
    subject: `Action needed: review the agreement for "${t}"`,
    title: "Your project agreement is ready to review",
    lines: [
      `${n.Creator} sent the project agreement for "${t}".`,
      "Please read the scope, price, timeline and payment schedule, tick each item to confirm you understand it, and accept or decline. Work cannot start until you accept.",
    ],
    cta: "Review agreement",
  }),
  agreement_reminder: (t, p, n) => ({
    subject: `Reminder: the agreement for "${t}" needs your answer`,
    title: "Your project agreement is still waiting",
    lines: [
      `The agreement for "${t}" has been waiting ${waited(p)}. ${n.Creator} cannot start until you accept or decline it.`,
    ],
    cta: "Review agreement",
  }),
  agreement_accepted: (t, p, n) => ({
    subject: `Agreement accepted: "${t}"`,
    title: `${n.Buyer} accepted your project agreement`,
    lines: [
      `${n.Buyer} read, acknowledged and accepted the agreement for "${t}".`,
      "If the agreement has a payment due before work starts, wait for the payment email before you begin. Otherwise you can start now.",
    ],
    cta: "Open commission",
  }),
  agreement_declined: (t, p, n) => ({
    subject: `Agreement declined: "${t}"`,
    title: `${n.Buyer} declined your project agreement`,
    lines: [
      `${n.Buyer} declined the agreement for "${t}". You can talk it through in the chat and send a revised agreement.`,
    ],
    cta: "Open commission",
  }),
  change_order_sent: (t, p, n) => ({
    subject: `Action needed: a change to "${t}"`,
    title: `${n.Creator} proposed a change`,
    lines: [
      `${n.Creator} proposed a change order, ${named(p, "a change")}, on "${t}". It may change the scope, price, timeline or deliverables.`,
      "Nothing changes until you accept it. Please review and accept or decline.",
    ],
    cta: "Review change",
  }),
  change_order_accepted: (t, p, n) => ({
    subject: `Change accepted: "${t}"`,
    title: `${n.Buyer} accepted your change order`,
    lines: [
      `${n.Buyer} accepted ${named(p, "your change order")} on "${t}". If it added to the price, ${n.buyer} has been asked to pay the difference.`,
    ],
    cta: "Open commission",
  }),
  change_order_declined: (t, p, n) => ({
    subject: `Change declined: "${t}"`,
    title: `${n.Buyer} declined your change order`,
    lines: [
      `${n.Buyer} declined ${named(p, "your change order")} on "${t}". The original agreement still applies.`,
    ],
    cta: "Open commission",
  }),
  payment_required: (t, p, n) => ({
    subject: `Payment due for "${t}"`,
    title: "A payment is due",
    lines: [
      `${p.title ? `"${p.title}"` : "A payment"} for "${t}" is ready to pay${amountOf(p) ? `: ${amountOf(p)}` : ""}.`,
      `The project waits on this payment. You pay in ${n.creator}'s currency on a secure Stripe page.`,
    ],
    cta: "Pay now",
  }),
  payment_reminder: (t, p, n) => ({
    subject: `Reminder: payment due for "${t}"`,
    title: "A payment is still waiting",
    lines: [
      `${p.title ? `"${p.title}"` : "A payment"} for "${t}"${amountOf(p) ? ` (${amountOf(p)})` : ""} has been unpaid ${waited(p)}.`,
      `${n.Creator} is waiting on it. If something is wrong, reply in the commission's chat so ${n.creator} knows.`,
    ],
    cta: "Pay now",
  }),
  payment_received: (t, p, n) => ({
    subject: `Payment received for "${t}"`,
    title: `${n.Buyer} paid`,
    lines: [
      `${n.Buyer} paid ${p.title ? `"${p.title}"` : "a payment"} for "${t}"${amountOf(p) ? `: ${amountOf(p)} before fees` : ""}.`,
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
  payment_disputed: (t, p, n) => ({
    subject: `Payment disputed: "${t}"`,
    title: "A payment is being disputed",
    lines: [
      `${n.Buyer}'s bank opened a dispute on ${p.title ? `"${p.title}"` : "a payment"} for "${t}". Made for Stream will be in touch about what is needed from you.`,
    ],
    cta: "View commission",
  }),
  milestone_submitted: (t, p, n) => ({
    subject: `Action needed: review ${named(p, "a milestone")} on "${t}"`,
    title: "A milestone is ready for your review",
    lines: [
      `${n.Creator} submitted ${named(p, "a milestone")} on "${t}".`,
      "Please review the work and approve it or ask for revisions. Approving it makes that milestone's payment due.",
    ],
    cta: "Review milestone",
  }),
  milestone_review_reminder: (t, p, n) => ({
    subject: `Reminder: ${named(p, "a milestone")} on "${t}" needs your review`,
    title: "A milestone is still waiting for your review",
    lines: [
      `${named(p, "A milestone")} on "${t}" has been waiting ${waited(p)}. ${n.Creator} cannot continue until you approve it or ask for revisions.`,
    ],
    cta: "Review milestone",
  }),
  milestone_approved: (t, p, n) => ({
    subject: `Milestone approved: "${t}"`,
    title: `${n.Buyer} approved your milestone`,
    lines: [
      `${n.Buyer} approved ${named(p, "your milestone")} on "${t}" and has been asked to pay for it. You will get an email when the payment arrives.`,
    ],
    cta: "Open commission",
  }),
  milestone_revision_requested: (t, p, n) => ({
    subject: `Revisions needed: "${t}"`,
    title: `${n.Buyer} asked for revisions`,
    lines: [`${n.Buyer} asked for changes to ${named(p, "your milestone")} on "${t}".`],
    noteLabel: `What ${n.buyer} asked for`,
    note: p.reason,
    cta: "Open commission",
  }),
  final_delivery_submitted: (t, p, n) => ({
    subject: `Action needed: your final delivery for "${t}"`,
    title: "Your final delivery is ready to review",
    lines: [
      `${n.Creator} submitted the final delivery for "${t}".`,
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
  final_delivery_revision_requested: (t, p, n) => ({
    subject: `Revisions needed on the final delivery: "${t}"`,
    title: `${n.Buyer} asked for revisions to the final delivery`,
    lines: [`${n.Buyer} asked for changes to the final delivery for "${t}".`],
    noteLabel: `What ${n.buyer} asked for`,
    note: p.reason,
    cta: "Open commission",
  }),
  progress_update_posted: (t, p, n) => ({
    subject: `Progress update on "${t}"`,
    title: `${n.Creator} posted a progress update`,
    lines: [`${n.Creator} posted ${named(p, "an update")} on "${t}".`],
    cta: "Read update",
  }),
  progress_update_overdue: (t, p, n) => ({
    subject: `A progress update is due on "${t}"`,
    title: `You owe ${n.buyer} a progress update`,
    lines: [
      `Your agreement for "${t}" promises regular progress updates, and one is now overdue.`,
      `Post a short update so ${n.buyer} knows where things stand. Missed updates are one of the things a buyer can raise if a project stalls.`,
    ],
    cta: "Post an update",
  }),
  cancellation_statement_needed: (t, p, n) => ({
    subject: `Action needed: ${n.buyer} asked to cancel "${t}"`,
    title: `${n.Buyer} asked to cancel`,
    lines: [
      `${n.Buyer} asked to cancel "${t}" after paying. Nothing is cancelled yet.`,
      `Please submit your itemised statement of the work done against each payment, so ${n.buyer} can accept it or dispute it.`,
    ],
    noteLabel: `${n.Buyer}'s reason`,
    note: p.reason,
    cta: "Submit statement",
  }),
  cancellation_statement_ready: (t, p, n) => ({
    subject: `Action needed: cancellation statement for "${t}"`,
    title: "A cancellation statement needs your answer",
    lines: [
      `${n.Creator} provided an itemised statement for cancelling "${t}": what was earned, and what would be refunded.`,
      "Please accept it or dispute it. Accepting cancels the rest of the project.",
    ],
    noteLabel: "The reason given",
    note: p.reason,
    cta: "Review statement",
  }),
  cancellation_disputed: (t, p, n) => ({
    subject: `Cancellation statement disputed: "${t}"`,
    title: `${n.Buyer} disputed your cancellation statement`,
    lines: [
      `${n.Buyer} did not accept your cancellation statement for "${t}". Made for Stream will review it. The project is not cancelled and no money has moved.`,
    ],
    cta: "Open commission",
  }),
  conversation_started: (t, p, n) => ({
    subject: `New message from ${n.sender || "someone on Made for Stream"}`,
    title: "Someone started a conversation with you",
    lines: [
      `${n.sender || "Someone"} sent you a message${p.subject ? ` about "${p.subject}"` : ""}.`,
      "Open the conversation to read it and reply.",
    ],
    cta: "Open conversation",
  }),
  message_received: (t, p, n) => ({
    subject: `New message from ${n.sender || "someone on Made for Stream"}`,
    title: "You have unread messages",
    lines: [
      `${n.sender || "Someone"} sent you a message${p.subject ? ` in "${p.subject}"` : ""} while you were away.`,
      "You will not get another email about this conversation until you have read it.",
    ],
    cta: "Open conversation",
  }),
  cancellation_warning: (t, p, n) => ({
    subject: `Cancellation warning: reply by ${deadline(p)} about "${t}"`,
    title: "You have received a cancellation warning",
    lines: [
      `${n.Other} on "${t}" has not heard from you and has started a ${p.response_days ? `${p.response_days}-day ` : ""}cancellation timer.`,
      `Unless you respond by ${deadline(p)}, the commission will be cancelled automatically.`,
      "Either of two things stops the timer at once: doing what is asked (for example paying, accepting or approving), or sending any reply in the commission's chat. You do not need to do both.",
      "If the buyer is the one who does not respond, payments already made stay with the creator. If the creator does not respond, amounts paid for work not reached are refunded to the buyer.",
    ],
    noteLabel: "What they need from you",
    note: p.reason,
    cta: "Reply now",
  }),
  cancellation_warning_answered: (t, p, n) => ({
    subject: `Your cancellation warning was answered: "${t}"`,
    title: `${n.Other} responded`,
    lines: [
      `${n.Other} on "${t}" responded to your cancellation warning, either with a message or by taking the next step. The timer has stopped and the commission continues.`,
      "If things stall again you can send a new warning.",
    ],
    cta: "Open commission",
  }),
  cancellation_warning_reminder: (t, p) => ({
    subject: `Last reminder: "${t}" will be cancelled on ${deadline(p)}`,
    title: "A cancellation warning is about to run out",
    lines: [
      `"${t}" will be cancelled automatically on ${deadline(p)} unless you respond before then: do what is asked, or send any reply in its chat.`,
    ],
    noteLabel: "What they need from you",
    note: p.reason,
    cta: "Reply now",
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

// The handles of the two people on a commission or conversation, as the
// `names` an email is written with. `handleByUserId` maps user ids to
// handles; anyone missing from it is left out and named by role instead.
export const getNotificationNames = ({ buyerUserId, creatorUserId, recipientUserId, handleByUserId }) => {
  const handle = (userId) => String((userId && handleByUserId?.[userId]) || "").trim();
  const otherUserId = recipientUserId === buyerUserId ? creatorUserId : buyerUserId;

  return { buyer: handle(buyerUserId), creator: handle(creatorUserId), other: handle(otherUserId) };
};

// Null when the kind has no template (NOTIF-002).
export const renderNotificationEmail = ({ kind, requestTitle, payload, requestUrl, names }) => {
  const build = NOTIFICATION_EMAILS[kind];

  if (!build) {
    return null;
  }

  const content = build(
    requestTitle || "your conversation",
    payload || {},
    people(names, payload || {}),
  );

  return renderActionEmail({ ...content, ctaUrl: requestUrl, ctaLabel: content.cta });
};
