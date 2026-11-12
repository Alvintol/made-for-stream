import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  profileSetupSeen: true,
  nameChosen: true,
  details: { data: null as unknown, isSuccess: true, isLoading: false },
  applicationStatus: null as string | null,
  offerings: [] as string[],
}));

vi.mock("../../hooks/creatorApplication/useMySellerApplication", () => ({
  useMySellerApplication: () => ({
    data: mocks.applicationStatus ? { status: mocks.applicationStatus } : null,
  }),
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: () => ({ user: mocks.user, loading: false }),
}));

vi.mock("../../hooks/profile/useMyProfile", () => ({
  useMyProfile: () => ({
    data: {
      profile_setup_seen: mocks.profileSetupSeen,
      display_name: mocks.nameChosen ? "Pastel Fox" : "New member",
      display_name_auto: !mocks.nameChosen,
      offering_types: mocks.offerings,
    },
    isLoading: false,
  }),
}));

vi.mock("../../hooks/settings/useAccountDetails", () => ({
  useAccountDetails: () => mocks.details,
}));

import ProfileSetupRedirect from "../auth/ProfileSetupRedirect";

const Where = () => <div>at {useLocation().pathname}</div>;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ProfileSetupRedirect />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe("<ProfileSetupRedirect />", () => {
  beforeEach(() => {
    mocks.user = { id: "user-1" };
    mocks.profileSetupSeen = true;
    mocks.nameChosen = true;
    mocks.details = { data: null, isSuccess: true, isLoading: false };
    mocks.applicationStatus = null;
    mocks.offerings = [];
  });

  describe("an approved creator who hasn't said what they offer", () => {
    beforeEach(() => {
      mocks.details = { data: { country_code: "CA" }, isSuccess: true, isLoading: false };
      mocks.applicationStatus = "approved";
    });

    it("is sent to Settings from any page", () => {
      renderAt("/creator/dashboard");

      expect(screen.getByText("at /settings/profile")).toBeInTheDocument();
    });

    it("can still read the policies and sign out", () => {
      renderAt("/privacy");
      expect(screen.getByText("at /privacy")).toBeInTheDocument();
    });

    it("isn't sent anywhere once they've chosen", () => {
      mocks.offerings = ["emotes"];
      renderAt("/creator/dashboard");

      expect(screen.getByText("at /creator/dashboard")).toBeInTheDocument();
    });

    it("adds their account details first, if those are missing too", () => {
      mocks.details = { data: null, isSuccess: true, isLoading: false };
      renderAt("/creator/dashboard");

      expect(screen.getByText("at /settings/personal")).toBeInTheDocument();
    });
  });

  it("doesn't ask applicants or buyers about offerings", () => {
    mocks.details = { data: { country_code: "CA" }, isSuccess: true, isLoading: false };
    mocks.applicationStatus = "submitted";
    renderAt("/market");

    expect(screen.getByText("at /market")).toBeInTheDocument();
  });

  it("sends a signed-in account with no details to the form, from any page", () => {
    renderAt("/market");

    expect(screen.getByText("at /settings/personal")).toBeInTheDocument();
  });

  it("also sends an account that has details but never chose a display name", () => {
    mocks.details = { data: { country_code: "CA" }, isSuccess: true, isLoading: false };
    mocks.nameChosen = false;

    renderAt("/market");

    expect(screen.getByText("at /settings/personal")).toBeInTheDocument();
  });

  it("still lets that account read the policies", () => {
    renderAt("/privacy");

    expect(screen.getByText("at /privacy")).toBeInTheDocument();
  });

  it("leaves visitors, and accounts with details, where they are", () => {
    mocks.details = { data: { country_code: "CA" }, isSuccess: true, isLoading: false };
    renderAt("/market");
    expect(screen.getByText("at /market")).toBeInTheDocument();
  });

  it("does not lock anyone out when the details could not be read", () => {
    mocks.details = { data: undefined, isSuccess: false, isLoading: false };

    renderAt("/market");

    expect(screen.getByText("at /market")).toBeInTheDocument();
  });

  it("sends a first-time account with details on to its profile settings", () => {
    mocks.details = { data: { country_code: "CA" }, isSuccess: true, isLoading: false };
    mocks.profileSetupSeen = false;

    renderAt("/market");

    expect(screen.getByText("at /settings/profile")).toBeInTheDocument();
  });
});
