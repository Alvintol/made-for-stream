import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { siteUpdates, siteVersion } from "../../domain/site/siteUpdates";

const mocks = vi.hoisted(() => ({
  preference: vi.fn(),
  markSeen: vi.fn(),
}));

vi.mock("../../hooks/settings/useSiteUpdatePreference", () => ({
  useSiteUpdatePreferenceAtSignIn: () => ({ data: mocks.preference() }),
  useMarkSiteUpdatesSeen: () => ({ mutate: mocks.markSeen }),
}));

import SiteUpdatesNotice from "../app/SiteUpdatesNotice";

const renderNotice = () =>
  render(
    <MemoryRouter>
      <SiteUpdatesNotice />
    </MemoryRouter>,
  );

describe("<SiteUpdatesNotice />", () => {
  beforeEach(() => {
    mocks.markSeen.mockReset();
    mocks.preference.mockReset();
  });

  it("shows the latest changes to someone who asked and has not seen this version", () => {
    mocks.preference.mockReturnValue({ showSiteUpdates: true, lastSeenVersion: "2026.01.01" });

    renderNotice();

    expect(screen.getByRole("dialog")).toHaveTextContent(siteUpdates[0].changes[0]);
    expect(screen.getByRole("link", { name: "See all updates" })).toHaveAttribute(
      "href",
      "/updates",
    );
  });

  it("closes, and records the version so it is shown only once", () => {
    mocks.preference.mockReturnValue({ showSiteUpdates: true, lastSeenVersion: null });

    renderNotice();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.markSeen).toHaveBeenCalledWith(siteVersion);
  });

  it("stays away from someone who has already seen this version", () => {
    mocks.preference.mockReturnValue({ showSiteUpdates: true, lastSeenVersion: siteVersion });

    renderNotice();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("stays away from someone who did not ask for it, and from signed-out visitors", () => {
    mocks.preference.mockReturnValue({ showSiteUpdates: false, lastSeenVersion: null });
    const { unmount } = renderNotice();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();

    mocks.preference.mockReturnValue(undefined);
    renderNotice();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
