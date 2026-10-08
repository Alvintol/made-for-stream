import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MessagesInbox from "../messages/MessagesInbox";

const mocks = vi.hoisted(() => ({
  useMessagesInbox: vi.fn(),
  useMyModerationReports: vi.fn(),
  useInboxMessageSearch: vi.fn(),
  useOlderMessagesInbox: vi.fn(),
}));

vi.mock("../../hooks/conversations/useMessagesInbox", () => ({
  useMessagesInbox: mocks.useMessagesInbox,
  useInboxMessageSearch: mocks.useInboxMessageSearch,
  useOlderMessagesInbox: mocks.useOlderMessagesInbox,
  INBOX_PAGE_SIZE: 50,
}));

vi.mock("../../hooks/moderation/useMyModerationReports", () => ({
  useMyModerationReports: mocks.useMyModerationReports,
}));

type ItemOverrides = {
  id?: string;
  type?: string;
  subject?: string;
  status?: string;
  requestStatus?: string | null;
  viewerRole?: "buyer" | "creator";
  unreadCount?: number;
  preview?: string | null;
};

const createInboxItem = (overrides: ItemOverrides = {}) => {
  const id = overrides.id ?? "conversation-1";
  const type = overrides.type ?? "listing_request";
  const unreadCount = overrides.unreadCount ?? 2;

  return {
    viewerRole: overrides.viewerRole ?? "buyer",
    hasUnread: unreadCount > 0,
    unreadCount,
    otherParticipantUserId: "creator-1",
    otherParticipant: {
      user_id: "creator-1",
      handle: "creatoruser",
      display_name: "Creator User",
      avatar_url: null,
    },
    listing: { id: "listing-1", title: "Custom Emote Pack", preview_url: null },
    requestStatus:
      overrides.requestStatus === undefined
        ? type === "listing_request"
          ? "accepted"
          : null
        : overrides.requestStatus,
    conversation: {
      id,
      conversation_type: type,
      buyer_user_id: "buyer-1",
      creator_user_id: "creator-1",
      listing_id: "listing-1",
      listing_request_id: type === "listing_request" ? `request-${id}` : null,
      subject: overrides.subject ?? "Custom cozy emote pack",
      initiation_reason_code: null,
      status: overrides.status ?? "open",
      last_message_at: null,
      last_message_sender_user_id: null,
      last_message_preview: overrides.preview ?? null,
      updated_at: "2026-05-20T12:00:00.000Z",
      created_at: "2026-05-20T12:00:00.000Z",
    },
  };
};

const fourConversations = [
  createInboxItem({ id: "active", subject: "Emote pack in progress" }),
  createInboxItem({ id: "done", subject: "Finished overlay", requestStatus: "completed", unreadCount: 0 }),
  createInboxItem({
    id: "cancelled",
    subject: "Cancelled model",
    requestStatus: "cancelled",
    unreadCount: 0,
    viewerRole: "creator",
  }),
  createInboxItem({
    id: "inquiry",
    type: "creator_inquiry",
    subject: "Do you take rush work?",
    unreadCount: 0,
    preview: "Yes, for a fee",
  }),
];

const showInbox = (items: unknown[], totalCount = items.length) =>
  mocks.useMessagesInbox.mockReturnValue({
    data: { items, totalUnreadCount: 2, totalCount },
    isLoading: false,
    error: null,
  });

const renderPage = (path = "/messages") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <MessagesInbox />
    </MemoryRouter>
  );

const headings = () => screen.queryAllByRole("heading", { level: 2 }).map((node) => node.textContent);

const folders = () => within(screen.getByRole("navigation", { name: "Inbox folders" }));

describe("<MessagesInbox />", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    showInbox([]);
    mocks.useMyModerationReports.mockReturnValue({ data: [], isLoading: false, error: null });
    mocks.useInboxMessageSearch.mockReturnValue({ data: [] });
    mocks.useOlderMessagesInbox.mockReturnValue({ data: undefined, isLoading: false, hasNextPage: false });
  });

  it("renders a conversation with its commission status and a link to it", () => {
    showInbox([createInboxItem()]);

    renderPage();

    expect(screen.getByRole("heading", { name: "Custom cozy emote pack" })).toBeInTheDocument();
    expect(screen.getByText(/Listing:\s*Custom Emote Pack/)).toBeInTheDocument();
    expect(screen.getByText(/@creatoruser/)).toBeInTheDocument();
    expect(screen.getByText("2 new messages")).toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Opens*conversation$/ })).toHaveAttribute(
      "href",
      "/requests/request-conversation-1"
    );
  });

  it("files every conversation in one folder and counts them", () => {
    showInbox(fourConversations);

    renderPage();

    expect(folders().getByRole("button", { name: /^All/ })).toHaveTextContent("4");
    expect(folders().getByRole("button", { name: /^Messages/ })).toHaveTextContent("1");
    expect(folders().getByRole("button", { name: /^Active commissions/ })).toHaveTextContent("1");
    expect(folders().getByRole("button", { name: /^Completed commissions/ })).toHaveTextContent("1");
    expect(folders().getByRole("button", { name: /^Ended conversations/ })).toHaveTextContent("1");

    fireEvent.click(folders().getByRole("button", { name: /^Completed commissions/ }));
    expect(headings()).toEqual(["Finished overlay"]);

    fireEvent.click(folders().getByRole("button", { name: /^Ended conversations/ }));
    expect(headings()).toEqual(["Cancelled model"]);

    fireEvent.click(folders().getByRole("button", { name: /^Messages/ }));
    expect(headings()).toEqual(["Do you take rush work?"]);
  });

  it("opens on the folder named in the address", () => {
    showInbox(fourConversations);

    renderPage("/messages?folder=active_commissions");

    expect(headings()).toEqual(["Emote pack in progress"]);
    expect(folders().getByRole("button", { name: /^Active commissions/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("filters by unread and by buying or selling", () => {
    showInbox(fourConversations);

    renderPage();

    fireEvent.click(screen.getByRole("checkbox", { name: "Unread only" }));
    expect(headings()).toEqual(["Emote pack in progress"]);

    fireEvent.click(screen.getByRole("checkbox", { name: "Unread only" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Show conversations where I am" }), {
      target: { value: "creator" },
    });
    expect(headings()).toEqual(["Cancelled model"]);
  });

  it("searches titles, people and the latest message as you type", () => {
    showInbox(fourConversations);

    renderPage();

    // Capitals in what is typed, or in what is searched, make no difference.
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "RUSH" } });
    expect(headings()).toEqual(["Do you take rush work?"]);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "In PROGRESS" } });
    expect(headings()).toEqual(["Emote pack in progress"]);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "for a fee" } });
    expect(headings()).toEqual(["Do you take rush work?"]);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "nothing like this" } });
    expect(headings()).toEqual([]);
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });

  it("also finds conversations by older message text, once typing pauses", async () => {
    showInbox(fourConversations);
    mocks.useInboxMessageSearch.mockImplementation((text: string) => ({
      data: text === "invoice number" ? ["done"] : [],
    }));

    renderPage();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "invoice number" } });

    await waitFor(() => expect(headings()).toEqual(["Finished overlay"]));
  });

  it("loads only the newest conversations, and older ones when their folder is opened", () => {
    const fetchNextPage = vi.fn();

    showInbox(fourConversations, 130);
    mocks.useOlderMessagesInbox.mockImplementation((enabled: boolean) => ({
      data: enabled
        ? { pages: [{ items: [createInboxItem({ id: "old", subject: "Old logo job", unreadCount: 0 })] }] }
        : undefined,
      isLoading: false,
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage,
    }));

    renderPage();

    // Nothing older is asked for until the folder is opened.
    expect(mocks.useOlderMessagesInbox).toHaveBeenLastCalledWith(false);
    expect(screen.getByText(/130/)).toBeInTheDocument();
    expect(screen.getByText(/Showing your 50 most recent conversations/)).toBeInTheDocument();
    expect(headings()).not.toContain("Old logo job");

    fireEvent.click(folders().getByRole("button", { name: /^Older conversations/ }));

    expect(mocks.useOlderMessagesInbox).toHaveBeenLastCalledWith(true);
    expect(folders().getByRole("button", { name: /^Older conversations/ })).toHaveTextContent("80");
    expect(headings()).toEqual(["Old logo job"]);

    fireEvent.click(screen.getByRole("button", { name: "Load 50 more" }));
    expect(fetchNextPage).toHaveBeenCalled();
  });

  it("has no older folder for an inbox that fits on one page", () => {
    showInbox(fourConversations);

    renderPage();

    expect(folders().queryByRole("button", { name: /^Older conversations/ })).not.toBeInTheDocument();
  });

  it("links to reports with how many are active or have news", () => {
    mocks.useMyModerationReports.mockReturnValue({
      data: [
        { id: "r1", resolved_at: null, has_unread_update: false },
        { id: "r2", resolved_at: "2026-05-01T00:00:00.000Z", has_unread_update: false },
      ],
      isLoading: false,
      error: null,
    });

    const { unmount } = renderPage();

    expect(folders().getByRole("link", { name: "Reports, 1 active" })).toHaveAttribute(
      "href",
      "/settings/reports"
    );

    unmount();

    mocks.useMyModerationReports.mockReturnValue({
      data: [{ id: "r1", resolved_at: null, has_unread_update: true }],
      isLoading: false,
      error: null,
    });

    renderPage();

    expect(folders().getByRole("link", { name: /1 with new updates/ })).toHaveTextContent("1 new");
  });

  it("says so when there are no conversations at all", () => {
    renderPage();

    expect(screen.getByText("You do not have any conversations yet.")).toBeInTheDocument();
  });
});
