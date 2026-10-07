import { ConversationInitiationReasonCode, getConversationInitiationReasonLabel } from "./conversations";

type ConversationDisplayInput = {
  conversation: {
    conversation_type: string;
    subject: string | null;
    initiation_reason_code?: ConversationInitiationReasonCode | null;
  };
  listing?: {
    title: string | null;
  } | null;
};

export const getConversationDisplayTitle = (
  item: ConversationDisplayInput
): string => {
  const subject = item.conversation.subject?.trim();
  const listingTitle = item.listing?.title?.trim();

  if (item.conversation.conversation_type === "listing_request") {
    return subject || listingTitle || "Commission request";
  }

  if (item.conversation.conversation_type === "listing_inquiry") {
    return listingTitle || subject || "Listing inquiry";
  }

  return subject || "Creator inquiry";
};

export const getConversationDisplayContext = (
  item: ConversationDisplayInput
): string | null => {
  const subject = item.conversation.subject?.trim();
  const listingTitle = item.listing?.title?.trim();

  if (
    item.conversation.conversation_type === "listing_request" &&
    listingTitle &&
    subject &&
    listingTitle !== subject
  ) {
    return `Listing: ${listingTitle}`;
  }

  if (
    item.conversation.conversation_type === "creator_inquiry" &&
    item.conversation.initiation_reason_code
  ) {
    return getConversationInitiationReasonLabel(
      item.conversation.initiation_reason_code
    );
  }

  return null;
};