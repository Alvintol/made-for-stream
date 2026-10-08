import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SettingsLayout from "../../components/settings/SettingsLayout";
import ProfileSettings from "../ProfileSettings";

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  platforms: [] as Array<Record<string, unknown>>,
  sellerAccess: {} as Record<string, unknown>,
  paymentAccount: null as Record<string, unknown> | null,
  reports: [] as Array<Record<string, unknown>>,
  accountDetails: { country_code: "CA" } as Record<string, unknown> | null,
  update: vi.fn(),
  refetch: vi.fn(),
}));

// Prices are shown in the creator's own currency in these tests; the
// conversion has its own tests (ListingPriceText, displayCurrency).
vi.mock("../../hooks/money/useDisplayCurrency", () => ({
  useDisplayCurrency: () => ({ displayCurrency: null, rates: null }),
  useDisplayPreferences: () => ({ data: null, isLoading: false }),
  useSaveDisplayPreferences: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
  useExchangeRates: () => ({ data: null }),
}));

vi.mock("../../hooks/settings/useAccountDetails", () => ({
  useAccountDetails: () => ({ data: mocks.accountDetails, isSuccess: true, isLoading: false }),
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "user-1" }, session: { access_token: "token" }, loading: false }),
}));

vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: () => ({
      update: (patch: unknown) => ({
        eq: async () => {
          mocks.update(patch);
          return { error: null };
        },
      }),
    }),
  },
}));

vi.mock("../../hooks/profile/useMyProfile", () => ({
  useMyProfile: () => ({ data: mocks.profile, isLoading: false, error: null, refetch: mocks.refetch }),
}));

vi.mock("../../hooks/profile/useProfilePlatformAccounts", () => ({
  useProfilePlatformAccounts: () => ({
    data: mocks.platforms,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("../../hooks/creatorApplication/useSellerAccess", () => ({
  useSellerAccess: () => mocks.sellerAccess,
}));

vi.mock("../../hooks/moderation/useMyModerationReports", () => ({
  useMyModerationReports: () => ({ data: mocks.reports, isLoading: false, error: null }),
}));

vi.mock("../../hooks/payments/useCreatorPaymentAccount", () => ({
  useCreatorPaymentAccount: () => ({ data: mocks.paymentAccount, refetch: vi.fn() }),
  getCreatorPaymentAccountIsReady: (account: { payouts_enabled?: boolean } | null) =>
    Boolean(account?.payouts_enabled),
  getCreatorPaymentAccountStatusLabel: (account: unknown) =>
    account ? "Onboarding incomplete" : "Not connected",
}));

vi.mock("../../components/settings/CreatorPayoutSettings", () => ({
  default: ({ isCreatorApproved }: { isCreatorApproved: boolean }) => (
    <div>Mock payout settings: {isCreatorApproved ? "approved" : "locked"}</div>
  ),
}));

const member = {
  isLoading: false,
  sellerApplication: null,
  creatorStatusLabel: "Not started",
  canStartApplication: true,
  isCreatorApproved: false,
  profileReady: true,
  hasLinkedCreatorPlatform: true,
};

const renderSettings = () =>
  render(
    <MemoryRouter initialEntries={["/settings/profile"]}>
      <Routes>
        <Route path="/settings" element={<SettingsLayout />}>
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="reports" element={<div>Reports page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

const sectionIds: Record<string, string> = {
  "Public profile": "settings-profile",
  "Connected platforms": "settings-connections",
  "Creator access": "settings-creator",
  Payouts: "settings-payouts",
};

// The checklist repeats section names, so look sections up by id.
const sectionToggle = (name: RegExp) => {
  const label = Object.keys(sectionIds).find((key) => name.test(key));
  const section = document.getElementById(sectionIds[label ?? ""]);

  if (!section) throw new Error(`No settings section for ${name}`);

  return within(section).getAllByRole("button")[0];
};

describe("<ProfileSettings /> in the settings layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profile = {
      handle: "pastelfox",
      display_name: "Pastel Fox",
      bio: "Cozy streamer",
      profile_setup_seen: true,
      profile_setup_completed_at: "2026-05-01T00:00:00.000Z",
      display_name_auto: false,
    };
    mocks.platforms = [
      { platform: "twitch", platform_user_id: "1", platform_login: "pastelfox", metadata: {} },
    ];
    mocks.sellerAccess = { ...member };
    mocks.paymentAccount = null;
    mocks.reports = [];
    mocks.accountDetails = { country_code: "CA" };
  });

  it("shows the account identity and the settings pages", () => {
    mocks.reports = [{ id: "r1", has_unread_update: true }];
    mocks.accountDetails = null;

    renderSettings();

    const header = screen.getByRole("banner");
    const pages = screen.getByRole("navigation", { name: "Settings pages" });

    expect(within(pages).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/settings/profile",
      "/settings/personal",
      "/settings/preferences",
      "/settings/reports",
    ]);
    // An account with no details yet is pointed at the page that asks for them.
    expect(within(pages).getByRole("link", { name: /Personal details/ })).toHaveTextContent(
      "Required",
    );
    // Country and currency moved to their own pages.
    expect(screen.queryByText("Country and currency")).not.toBeInTheDocument();

    expect(within(header).getByText("Pastel Fox")).toBeInTheDocument();
    expect(within(header).getByText("Member")).toBeInTheDocument();
    expect(within(header).getByRole("link", { name: "@pastelfox" })).toHaveAttribute(
      "href",
      "/creator/pastelfox"
    );
    expect(within(pages).getByRole("link", { name: /My reports/ })).toHaveTextContent("1");
  });

  it("keeps optional steps quiet and opens the profile when nothing is pending", () => {
    renderSettings();

    const checklist = screen.getByRole("complementary", { name: "Account setup" });

    expect(within(checklist).getByText("2 of 2 done")).toBeInTheDocument();
    expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
    expect(sectionToggle(/Public profile/)).toHaveAttribute("aria-expanded", "true");
    expect(sectionToggle(/Creator access/)).toHaveTextContent("Optional");
    expect(sectionToggle(/Payouts/)).toHaveTextContent("Locked");
  });

  it("flags the next setup step for new accounts", () => {
    mocks.profile = { ...mocks.profile, handle: null, display_name: null };
    mocks.platforms = [];
    mocks.sellerAccess = { ...member, profileReady: false, hasLinkedCreatorPlatform: false };

    renderSettings();

    expect(sectionToggle(/Public profile/)).toHaveAttribute("aria-expanded", "true");
    expect(sectionToggle(/Public profile/)).toHaveTextContent("Needs attention");
    expect(sectionToggle(/Connected platforms/)).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("0 of 2 done")).toBeInTheDocument();
  });

  it("opens payouts for approved creators who still need Stripe", () => {
    mocks.sellerAccess = {
      ...member,
      isCreatorApproved: true,
      sellerApplication: { status: "approved", reviewer_notes: null },
      creatorStatusLabel: "Approved creator",
    };
    mocks.paymentAccount = { payouts_enabled: false };

    renderSettings();

    expect(sectionToggle(/Payouts/)).toHaveAttribute("aria-expanded", "true");
    expect(sectionToggle(/Payouts/)).toHaveTextContent("Needs attention");
    expect(screen.getByText("Mock payout settings: approved")).toBeInTheDocument();
    expect(within(screen.getByRole("banner")).getByText("Creator")).toBeInTheDocument();
  });

  it("jumps to a section from the checklist", () => {
    renderSettings();

    const connections = sectionToggle(/Connected platforms/);
    expect(connections).toHaveAttribute("aria-expanded", "false");

    const checklist = screen.getByRole("complementary", { name: "Account setup" });
    fireEvent.click(within(checklist).getByRole("button", { name: /Connected platforms/ }));

    expect(connections).toHaveAttribute("aria-expanded", "true");
  });

  it("saves the profile and confirms inline", async () => {
    renderSettings();

    fireEvent.change(screen.getByLabelText(/^Display name/), { target: { value: "Pastel Fox Art" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(screen.getByText("Profile saved.")).toBeInTheDocument();
    });

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ handle: "pastelfox", display_name: "Pastel Fox Art" })
    );
  });

  it("does not let the display name be removed", async () => {
    renderSettings();

    fireEvent.change(screen.getByLabelText(/^Display name/), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText("Enter a display name of 2 to 50 characters.")).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid handle without saving", () => {
    renderSettings();

    fireEvent.change(screen.getByLabelText(/^Handle/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(screen.getByText("Handle must be 3–25 chars (letters, numbers, _ or -).")).toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
