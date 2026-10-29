import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreatorProfile from "../creator/CreatorProfile";

const mocks = vi.hoisted(() => ({
  usePublicCreatorProfile: vi.fn(),
  useTwitchStreams: vi.fn(),
  useAuth: vi.fn(),
  createInquiry: vi.fn(),
  submitProfileReport: vi.fn(),
}));

vi.mock("../../hooks/profile/usePublicCreatorProfile", () => ({
  usePublicCreatorProfile: mocks.usePublicCreatorProfile,
}));

vi.mock("../../hooks/useTwitchStreams", () => ({
  useTwitchStreams: mocks.useTwitchStreams,
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../hooks/conversations/useCreateInquiryConversation", () => ({
  useCreateCreatorInquiryConversation: () => ({
    mutateAsync: mocks.createInquiry,
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../hooks/moderation/useSubmitProfileModerationReport", () => ({
  useSubmitProfileModerationReport: () => ({
    mutateAsync: mocks.submitProfileReport,
    isPending: false,
  }),
}));

const createCreatorProfileData = () => ({
  profile: {
    user_id: "creator-1",
    handle: "creatoruser",
    display_name: "Creator User",
    bio: "I make emotes and stream overlays.",
  },
  platformAccounts: [],
  listings: [],
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/creator/creatoruser"]}>
      <Routes>
        <Route path="/creator/:handle" element={<CreatorProfile />} />
      </Routes>
    </MemoryRouter>
  );

describe("<CreatorProfile /> report UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.usePublicCreatorProfile.mockReturnValue({
      data: createCreatorProfileData(),
      isLoading: false,
      error: null,
    });

    mocks.useTwitchStreams.mockReturnValue({
      twitchByLogin: {},
    });

    mocks.useAuth.mockReturnValue({
      user: null,
      loading: false,
    });

    mocks.createInquiry.mockResolvedValue({
      id: "conversation-1",
    });

    mocks.submitProfileReport.mockResolvedValue("report-1");
  });

  it("shows a sign-in prompt for signed-out users", () => {
    renderPage();

    expect(screen.getByText("Report creator")).toBeInTheDocument();
    expect(
      screen.getByText("You need to sign in before reporting a creator.")
    ).toBeInTheDocument();
    // Anyone can report, account or not (Terms section 10).
    expect(screen.getByText(/No account\? Email safety@madeforstream\.com/)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Sign in to report" })).toHaveAttribute(
      "href",
      "/signin"
    );
  });

  it("does not allow users to report their own creator profile", () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: "creator-1",
      },
      loading: false,
    });

    renderPage();

    expect(
      screen.getByText("You cannot report your own creator profile.")
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: "Report creator" })
    ).not.toBeInTheDocument();
  });

  it("lets signed-in non-owners open the profile report form", () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
      loading: false,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Report creator" }));

    expect(screen.getByLabelText("Reason")).toBeInTheDocument();
    expect(screen.getByLabelText("Details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled();
  });

  it("submits a profile report with details", async () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
      loading: false,
    });

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Report creator" }));

    fireEvent.change(screen.getByLabelText("Details"), {
      target: {
        value: "This creator profile appears misleading.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    await waitFor(() => {
      expect(mocks.submitProfileReport).toHaveBeenCalledWith(
        expect.objectContaining({
          profileUserId: "creator-1",
          reasonDetails: "This creator profile appears misleading.",
        })
      );
    });

    expect(
      await screen.findByText("Profile report submitted. An admin will review it soon.")
    ).toBeInTheDocument();
  });

  it("shows a useful error when profile report submission fails", async () => {
    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
      loading: false,
    });

    mocks.submitProfileReport.mockRejectedValue(
      new Error("You already have an active report for this profile.")
    );

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Report creator" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

    expect(
      await screen.findByText("You already have an active report for this profile.")
    ).toBeInTheDocument();
  });
});