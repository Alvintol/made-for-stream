import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const mutate = vi.fn();
const rows = [
  { id: "n1", title: 'Accepted: "Logo"', link_path: "/requests/r1", created_at: "2026-11-09T10:00:00Z", read_at: null },
  { id: "n2", title: 'Payment received: "Emotes"', link_path: "/creator/requests/r2", created_at: "2026-11-08T10:00:00Z", read_at: "2026-11-08T11:00:00Z" },
];

vi.mock("../../../hooks/notifications/useNotifications", () => ({
  useNotifications: () => ({ data: rows }),
  useMarkNotificationsRead: () => ({ mutate }),
}));

import NotificationBell from "../NotificationBell";

describe("NotificationBell", () => {
  it("counts the unread, lists every line with its page when opened, and marks them read", () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    const bell = screen.getByRole("button", { name: "Notifications, 1 unread" });
    expect(screen.queryByText('Accepted: "Logo"')).toBeNull();

    fireEvent.click(bell);

    expect(screen.getByText('Accepted: "Logo"').closest("a")?.getAttribute("href")).toBe("/requests/r1");
    expect(screen.getByText('Payment received: "Emotes"').closest("a")?.getAttribute("href")).toBe(
      "/creator/requests/r2",
    );
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
