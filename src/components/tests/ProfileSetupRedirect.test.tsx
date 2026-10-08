import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  profileSetupSeen: true,
  details: { data: null as unknown, isSuccess: true, isLoading: false },
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: () => ({ user: mocks.user, loading: false }),
}));

vi.mock("../../hooks/profile/useMyProfile", () => ({
  useMyProfile: () => ({ data: { profile_setup_seen: mocks.profileSetupSeen }, isLoading: false }),
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
    mocks.details = { data: null, isSuccess: true, isLoading: false };
  });

  it("sends a signed-in account with no details to the form, from any page", () => {
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
