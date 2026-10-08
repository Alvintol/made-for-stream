import type { ListingRequestStatus } from "../listings/listingRequests";
import { getConversationDisplayContext, getConversationDisplayTitle } from "./conversationDisplay";

// The inbox's folders. Every conversation sits in exactly one of the last
// four; "all" shows them together.
export type InboxFolder =
  | "all"
  | "messages"
  | "active_commissions"
  | "completed_commissions"
  | "ended";

export const inboxFolders: Array<{ key: InboxFolder; label: string }> = [
  { key: "all", label: "All" },
  { key: "messages", label: "Messages" },
  { key: "active_commissions", label: "Active commissions" },
  { key: "completed_commissions", label: "Completed commissions" },
  { key: "ended", label: "Ended conversations" },
];

export const isInboxFolder = (value: string | null): value is InboxFolder =>
  inboxFolders.some((folder) => folder.key === value);

type InboxFolderInput = {
  conversation: {
    conversation_type: string;
    status: string;
    subject: string | null;
    last_message_preview: string | null;
  };
  // The commission's status, for a commission conversation.
  requestStatus?: ListingRequestStatus | null;
  otherParticipant?: { handle: string | null; display_name: string | null } | null;
  listing?: { title: string | null } | null;
};

export const getInboxFolder = (item: InboxFolderInput): Exclude<InboxFolder, "all"> => {
  const isOpen = item.conversation.status === "open";

  if (item.conversation.conversation_type !== "listing_request") {
    return isOpen ? "messages" : "ended";
  }

  if (item.requestStatus === "completed") return "completed_commissions";

  if (item.requestStatus === "submitted" || item.requestStatus === "accepted") {
    return "active_commissions";
  }

  // Declined, cancelled or archived. A commission whose status could not be
  // read falls back to whether its chat is still open.
  return item.requestStatus || !isOpen ? "ended" : "active_commissions";
};

// Whether a conversation's own details mention every word typed: its title,
// the listing, the other person, and the latest message. Older messages are
// searched in the database (useInboxMessageSearch).
export const matchesInboxSearch = (item: InboxFolderInput, query: string): boolean => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (words.length === 0) return true;

  const text = [
    getConversationDisplayTitle(item),
    getConversationDisplayContext(item),
    item.listing?.title,
    item.otherParticipant?.handle,
    item.otherParticipant?.display_name,
    item.conversation.last_message_preview,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return words.every((word) => text.includes(word));
};
