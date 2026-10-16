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
  reasonCode: ConversationInitiationReasonCode | null
): string =>
  reasonCode
    ? conversationInitiationReasonOptions.find(
      (option) => option.value === reasonCode
    )?.label ?? "Unknown topic"
    : "No topic";

export const getBuyerImageUploadStatusLabel = (
  status: BuyerImageUploadStatus
): string =>
  status === "blocked"
    ? "Image uploads blocked"
    : status === "requested"
      ? "Image upload access requested"
      : status === "approved"
        ? "Image uploads allowed"
        : "Image uploads disabled";

export const conversationCloseReasonOptions: Array<{
  value: ConversationCloseReasonCode;
  label: string;
}> = [
    { value: "question_answered", label: "My question was answered" },
    { value: "not_moving_forward", label: "I am not moving forward" },
    { value: "not_a_fit", label: "This is not a good fit" },
    { value: "duplicate_conversation", label: "This is a duplicate conversation" },
    { value: "unresponsive", label: "The other person is not responding" },
    { value: "unwanted_messages", label: "I do not want more messages in this thread" },
    { value: "other", label: "Other" },
  ];

export const getConversationCloseReasonLabel = (
  reasonCode: ConversationCloseReasonCode | null
): string => {
  if (reasonCode === "project_completed") {
    return "Project completed";
  }

  const option = conversationCloseReasonOptions.find(
    (currentOption) =>
      currentOption.value === reasonCode
  );

  return option?.label ?? "Unknown reason";
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
