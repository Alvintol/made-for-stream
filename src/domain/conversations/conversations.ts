import { english, hasMessage, wordFor, type Translate } from "../../lib/i18n/i18n";

export type ConversationType =
  | "creator_inquiry"
  | "listing_inquiry"
  | "listing_request";

export type ConversationStatus = "open" | "closed" | "admin_locked";

export type ConversationMessageType =
  | "text"
  | "system"
  | "attachment"
  | "mixed";

export type ConversationCloseReasonCode =
  | "question_answered"
  | "not_moving_forward"
  | "not_a_fit"
  | "duplicate_conversation"
  | "unresponsive"
  | "unwanted_messages"
  | "project_completed"
  | "other";

export type BuyerImageUploadStatus =
  | "blocked"
  | "requested"
  | "approved"
  | "revoked";

export type ConversationInitiationReasonCode =
  | "custom_quote"
  | "style_fit"
  | "scope_or_complexity"
  | "timeline_availability"
  | "pricing"
  | "deliverables"
  | "usage_rights"
  | "reference_requirements"
  | "revision_policy"
  | "commercial_use"
  | "file_formats"
  | "bundle_or_multiple_items"
  | "commission_availability"
  | "listing_clarification"
  | "before_requesting";

export const conversationInitiationReasonOptions: Array<{
  value: ConversationInitiationReasonCode;
  label: string;
}> = [
    { value: "custom_quote", label: "Custom quote" },
    { value: "style_fit", label: "Style fit or creative direction" },
    { value: "scope_or_complexity", label: "Scope or complexity" },
    { value: "timeline_availability", label: "Timeline or availability" },
    { value: "pricing", label: "Pricing question" },
    { value: "deliverables", label: "Deliverables question" },
    { value: "usage_rights", label: "Usage rights or licensing" },
    {
      value: "reference_requirements",
      label: "Reference image or material requirements",
    },
    { value: "revision_policy", label: "Revision policy" },
    { value: "commercial_use", label: "Commercial-use question" },
    { value: "file_formats", label: "File format or source-file question" },
    { value: "bundle_or_multiple_items", label: "Bundle or multiple item commission" },
    { value: "commission_availability", label: "Commission availability" },
    { value: "listing_clarification", label: "Clarification about a listing" },
    { value: "before_requesting", label: "Question before sending a commission request" },
  ];

export const getConversationInitiationReasonLabel = (
  reasonCode: ConversationInitiationReasonCode | null,
  t: Translate = english
): string => {
  if (!reasonCode) return t("topic.none");

  const key = `topic.${reasonCode}`;

  return hasMessage(key) ? t(key) : t("topic.unknown");
};

export const getBuyerImageUploadStatusLabel = (
  status: BuyerImageUploadStatus,
  t: Translate = english
): string => t(`imageStatus.${status}`);

// What a person can choose; project_completed is set by the site itself.
export const conversationCloseReasonOptions: Array<{
  value: ConversationCloseReasonCode;
}> = [
    { value: "question_answered" },
    { value: "not_moving_forward" },
    { value: "not_a_fit" },
    { value: "duplicate_conversation" },
    { value: "unresponsive" },
    { value: "unwanted_messages" },
    { value: "other" },
  ];

export const getConversationCloseReasonLabel = (
  reasonCode: ConversationCloseReasonCode | null,
  t: Translate = english
): string => {
  const key = `closeReason.${reasonCode}`;

  return hasMessage(key) ? t(key) : t("closeReason.unknown");
};

export const canSendConversationMessage = (
  status: ConversationStatus
): boolean => status === "open";

export const isConversationReadOnly = (
  status: ConversationStatus
): boolean => status !== "open";

// Which side of the thread a line sits on, for the person looking at it:
// their own side, the other person's, or the middle for a line that neither
// the buyer nor the creator caused. Used for automatic lines, so the thread
// shows who did what.
export type ConversationMessageSide = "own" | "other" | "neutral";

export const getConversationMessageSide = (input: {
  senderUserId: string | null;
  viewerUserId: string | null;
  buyerUserId: string;
  creatorUserId: string;
}): ConversationMessageSide => {
  const { senderUserId, viewerUserId, buyerUserId, creatorUserId } = input;

  if (senderUserId !== buyerUserId && senderUserId !== creatorUserId) {
    return "neutral";
  }

  return senderUserId === viewerUserId ? "own" : "other";
};

// True for the first line of the thread and the first line of each day, in
// the reader's own time zone. The thread shows the day once, above it.
export const startsNewConversationDay = (
  previousCreatedAt: string | null,
  createdAt: string
): boolean =>
  previousCreatedAt === null ||
  new Date(previousCreatedAt).toDateString() !==
    new Date(createdAt).toDateString();

// Automatic chat lines are stored as "The creator sent …", "… accepted by
// the buyer", "… for buyer review". On screen they name the people instead.
// What follows the first ": " is a title or reason someone typed, shown as
// written up to the first ". "; fixed wording after that ("… sketches. The
// creator can continue …") is named too.
export const nameSystemMessagePeople = (
  body: string,
  names: { buyerName: string; creatorName: string }
): string => {
  const split = body.indexOf(": ");
  const head = split === -1 ? body : body.slice(0, split);
  const tail = split === -1 ? "" : body.slice(split);

  const name = (text: string) =>
    text
      .replace(/\bfor buyer review\b/g, `for ${names.buyerName} to review`)
      .replace(/\b[Tt]he buyer\b/g, names.buyerName)
      .replace(/\b[Tt]he creator\b/g, names.creatorName);

  const sentenceEnd = tail.indexOf(". ");
  const typed = sentenceEnd === -1 ? tail : tail.slice(0, sentenceEnd + 2);
  const after = sentenceEnd === -1 ? "" : tail.slice(sentenceEnd + 2);

  return name(head) + typed + name(after);
};

// The code the database saves beside an automatic line
// (public.system_line_for): a key under chat.line and the parts that vary.
export type SystemLine = { key: string; values: Record<string, string> };

// The database saves what off-site work was as English: "milestone 2 (title)",
// "the final delivery (title)" or "this commission".
export const offSiteSubjectText = (subject: string, t: Translate = english): string => {
  const milestone = subject.match(/^milestone (\d+) \((.*)\)$/s);
  if (milestone) {
    return t("chat.line.subjectMilestone", { number: milestone[1], title: milestone[2] });
  }

  const delivery = subject.match(/^the final delivery \((.*)\)$/s);
  if (delivery) return t("chat.line.subjectDelivery", { title: delivery[1] });

  return subject === "this commission" ? t("chat.line.subjectCommission") : subject;
};

// Saved as "email, Discord, another way (what they typed)".
const offSiteMethodsText = (methods: string, t: Translate): string =>
  methods
    .split(", ")
    .map((method) =>
      method === "email"
        ? t("chat.line.method.email")
        : method === "text message"
          ? t("chat.line.method.text_message")
          : method.startsWith("another way (")
            ? t("chat.line.method.other") + method.slice("another way".length)
            : method
    )
    .join(", ");

// An automatic line in the reader's language. A line with no code, or one
// this version of the site does not know, reads as it was saved.
export const systemLineText = (
  line: SystemLine | null | undefined,
  body: string,
  names: { buyerName: string; creatorName: string },
  t: Translate = english
): string => {
  if (!line || !hasMessage(line.key)) return nameSystemMessagePeople(body, names);

  const { subject, methods, branch } = line.values;
  const values: Record<string, string> = {
    ...line.values,
    buyer: names.buyerName,
    creator: names.creatorName,
  };

  if (subject !== undefined) values.subject = offSiteSubjectText(subject, t);
  if (methods !== undefined) values.methods = offSiteMethodsText(methods, t);
  if (branch !== undefined) values.branch = wordFor("chat.line.branch", branch, t);

  return t(line.key, values);
};

// The inbox says "the buyer" and "the creator", so a line can start a sentence
// with either. A message someone wrote is shown as saved.
export const inboxPreviewText = (
  line: SystemLine | null | undefined,
  preview: string | null,
  t: Translate
): string | null => {
  if (!line) return preview;

  const text = systemLineText(
    line,
    preview ?? "",
    { buyerName: t("chat.line.theBuyer"), creatorName: t("chat.line.theCreator") },
    t
  );

  return text.charAt(0).toUpperCase() + text.slice(1);
};
