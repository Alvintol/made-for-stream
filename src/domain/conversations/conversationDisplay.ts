import { english, type Translate } from "../../lib/i18n/i18n";
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
  item: ConversationDisplayInput,
  t: Translate = english
): string => {
  const subject = item.conversation.subject?.trim();
  const listingTitle = item.listing?.title?.trim();

  if (item.conversation.conversation_type === "listing_request") {
    return subject || listingTitle || t("fulfilment.request");
  }

  if (item.conversation.conversation_type === "listing_inquiry") {
    return listingTitle || subject || t("inbox.typeListing");
  }

  return subject || t("inbox.typeCreator");
};

export const getConversationDisplayContext = (
  item: ConversationDisplayInput,
  t: Translate = english
): string | null => {
  const subject = item.conversation.subject?.trim();
  const listingTitle = item.listing?.title?.trim();

  if (
    item.conversation.conversation_type === "listing_request" &&
    listingTitle &&
    subject &&
    listingTitle !== subject
  ) {
    return t("buyerRequests.listing", { title: listingTitle });
  }

  if (
    item.conversation.conversation_type === "creator_inquiry" &&
    item.conversation.initiation_reason_code
  ) {
    return getConversationInitiationReasonLabel(
      item.conversation.initiation_reason_code,
      t
    );
  }

  return null;
};