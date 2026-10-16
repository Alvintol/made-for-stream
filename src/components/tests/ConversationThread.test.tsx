import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  idle: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
  currentUserId: "buyer-1",
  messages: [
    {
      id: "m1",
      sender_user_id: "creator-1",
      message_type: "system",
      body: "The creator sent a project change order for buyer review: discount",
      created_at: "2026-10-12T15:00:00Z",
    },
    {
      id: "m2",
      sender_user_id: "buyer-1",
      message_type: "text",
      body: "Thanks, looking now.",
      created_at: "2026-10-12T15:30:00Z",
    },
    {
      id: "m3",
      sender_user_id: "buyer-1",
      message_type: "system",
      body: "The buyer declined the project change order: discount",
      created_at: "2026-10-13T15:00:00Z",
    },
  ],
}));

vi.mock("../../hooks/conversations/useConversationMessages", () => ({
  useConversationMessages: () => ({
    messages: mocks.messages,
    isLoading: false,
    error: null,
    currentUserId: mocks.currentUserId,
    sendMessageMutation: mocks.idle(),
  }),
}));
vi.mock("../../hooks/conversations/useCloseConversation", () => ({
  useCloseConversation: mocks.idle,
}));
vi.mock("../../hooks/conversations/useConversationImagePermissions", () => ({
  useApproveBuyerImageUpload: mocks.idle,
  useRequestBuyerImageUpload: mocks.idle,
  useRevokeBuyerImageUpload: mocks.idle,
}));
vi.mock("../../hooks/conversations/useConversationParticipants", () => ({
  useConversationParticipants: () => ({ data: [] }),
}));
vi.mock("../../hooks/conversations/useMarkConversationRead", () => ({
  useMarkConversationRead: mocks.idle,
}));
vi.mock("../../hooks/moderation/useMyModerationReports", () => ({
  useMyModerationReports: () => ({ data: [] }),
}));
vi.mock("../../hooks/moderation/useSubmitModerationReport", () => ({
  useSubmitModerationReport: mocks.idle,
}));

import ConversationThread from "../conversations/ConversationThread";

const dayText = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const timeText = (value: string) =>
  new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const renderThread = (viewer: "buyer" | "creator") => {
  mocks.currentUserId = viewer === "buyer" ? "buyer-1" : "creator-1";

  return render(
    <ConversationThread
      conversation={{
        id: "conversation-1",
        buyer_user_id: "buyer-1",
        creator_user_id: "creator-1",
        status: "open",
        closed_at: null,
        closed_reason_code: null,
        closed_reason_details: null,
        buyer_image_upload_status: "blocked",
        buyer_image_upload_request_note: null,
        last_message_at: null,
        last_message_sender_user_id: null,
      }}
      viewer={viewer}
      buyerLabel="ImAllBeans"
      creatorLabel="meowington"
      header={<span>Chat</span>}
    />,
  );
};

const rowOf = (text: string) => screen.getByText(text).parentElement as HTMLElement;

describe("<ConversationThread />", () => {
  it("shows each day once and only the time on each line", () => {
    renderThread("buyer");

    // Three lines over two days: two day headers.
    expect(screen.getAllByText(dayText("2026-10-12T15:00:00Z"))).toHaveLength(1);
    expect(screen.getAllByText(dayText("2026-10-13T15:00:00Z"))).toHaveLength(1);

    // Both automatic lines were written at the same time of day, on
    // different days: the line itself no longer says which day.
    expect(
      screen.getAllByText(`System · ${timeText("2026-10-12T15:00:00Z")}`),
    ).toHaveLength(2);
    expect(screen.getByText(timeText("2026-10-12T15:30:00Z"))).toBeInTheDocument();
  });

  it("puts an automatic line on the side of whoever caused it", () => {
    // Shown with the people named, not as stored.
    const sent = "meowington sent a project change order for ImAllBeans to review: discount";
    const declined = "ImAllBeans declined the project change order: discount";

    const { unmount } = renderThread("buyer");

    expect(rowOf(sent)).toHaveAttribute("data-side", "other");
    expect(rowOf(sent)).toHaveClass("items-start");
    expect(rowOf(declined)).toHaveAttribute("data-side", "own");
    expect(rowOf(declined)).toHaveClass("items-end");

    unmount();
    renderThread("creator");

    expect(rowOf(sent)).toHaveAttribute("data-side", "own");
    expect(rowOf(declined)).toHaveAttribute("data-side", "other");
  });
});
