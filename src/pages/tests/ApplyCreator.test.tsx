import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ApplyCreator from "../creator/ApplyCreator";
import { useAuth } from "../../providers/AuthProvider";
import { useSellerAccess } from "../../hooks/creatorApplication/useSellerAccess";
import { useUpsertMySellerApplication } from "../../hooks/creatorApplication/useUpsertMySellerApplication";
import { useCreatorApplicationQueueState } from "../../hooks/creatorApplication/useCreatorApplicationQueueState";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query"
  );

  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: vi.fn(),
    useQueryClient: vi.fn(),
  };
});

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../hooks/creatorApplication/useSellerAccess", () => ({
  useSellerAccess: vi.fn(),
}));

vi.mock("../../hooks/creatorApplication/useUpsertMySellerApplication", () => ({
  useUpsertMySellerApplication: vi.fn(),
}));

vi.mock("../../hooks/creatorApplication/useCreatorApplicationQueueState", () => ({
  useCreatorApplicationQueueState: vi.fn(),
}));

type SellerApplicationSampleRow = {
  id: string;
  application_id: string;
  sample_type: "link" | "image" | "video";
  title: string;
  description: string | null;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const mockUseAuth = vi.mocked(useAuth);
const mockUseSellerAccess = vi.mocked(useSellerAccess);
const mockUseUpsertMySellerApplication = vi.mocked(useUpsertMySellerApplication);
const mockUseCreatorApplicationQueueState = vi.mocked(
  useCreatorApplicationQueueState
);
const mockUseQuery = vi.mocked(useQuery);
const mockUseMutation = vi.mocked(useMutation);
const mockUseQueryClient = vi.mocked(useQueryClient);

const buildSample = (
  overrides?: Partial<SellerApplicationSampleRow>
): SellerApplicationSampleRow => ({
  id: overrides?.id ?? crypto.randomUUID(),
  application_id: overrides?.application_id ?? "application-1",
  sample_type: overrides?.sample_type ?? "link",
  title: overrides?.title ?? "Portfolio sample",
  description: overrides?.description ?? "Example work",
  url: overrides?.url ?? "https://example.com/sample",
  storage_path: overrides?.storage_path ?? null,
  file_name: overrides?.file_name ?? null,
  mime_type: overrides?.mime_type ?? null,
  file_size_bytes: overrides?.file_size_bytes ?? null,
  sort_order: overrides?.sort_order ?? 0,
  created_at: overrides?.created_at ?? "2026-04-01T00:00:00.000Z",
  updated_at: overrides?.updated_at ?? "2026-04-01T00:00:00.000Z",
});

const buildRequiredRecentUploadSample = (
  overrides?: Partial<SellerApplicationSampleRow>
): SellerApplicationSampleRow =>
  buildSample({
    title: "Most Recent Upload/Vod",
    url: "https://youtube.com/watch?v=recent-upload",
    ...overrides,
  });

const withApplication = (overrides: Record<string, unknown>) => {
  const current = mockUseSellerAccess.mock.results.at(-1)?.value ?? mockUseSellerAccess();

  mockUseSellerAccess.mockReturnValue({
    ...current,
    ...overrides,
    sellerApplication:
      overrides.sellerApplication === null
        ? null
        : { ...current.sellerApplication, ...(overrides.sellerApplication as object) },
  } as never);
};

const readySamples = () => [
  buildRequiredRecentUploadSample({ id: "required", sort_order: 0 }),
  buildSample({ id: "sample-2", title: "Portfolio two", sort_order: 1 }),
  buildSample({ id: "sample-3", title: "Portfolio three", sort_order: 2 }),
];

const renderPage = (samples: SellerApplicationSampleRow[]) => {
  mockUseQuery.mockReturnValue({
    data: samples,
    isLoading: false,
    error: null,
  } as never);

  render(
    <MemoryRouter>
      <ApplyCreator />
    </MemoryRouter>
  );
};

describe("ApplyCreator", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: "user-1" },
      loading: false,
    } as never);

    mockUseSellerAccess.mockReturnValue({
      isLoading: false,
      isSignedIn: true,
      isAdmin: false,
      isCreatorApproved: false,
      canAccessCreatorRoutes: false,
      canAccessAdminRoutes: false,
      profileReady: true,
      hasLinkedCreatorPlatform: true,
      sellerApplication: {
        id: "application-1",
        profile_user_id: "user-1",
        status: "draft",
        submitted_at: null,
        reviewed_at: null,
        reviewed_by: null,
        reviewer_notes: null,
        rejection_reason: null,
        applicant_notes: null,
        agreed_to_terms: true,
        agreed_to_original_work: true,
        agreed_to_manual_review: true,
        agreed_to_age_and_capacity: true,
        twitch_status: "affiliate",
        twitch_follower_count: 300,
        youtube_subscriber_count: null,
        offering_types: ["emotes"],
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
      },
      creatorStatusLabel: "Draft",
      canStartApplication: true,
      canEditApplication: true,
      canSubmitApplication: true,
      error: null,
    } as never);

    mockUseUpsertMySellerApplication.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as never);

    mockUseCreatorApplicationQueueState.mockReturnValue({
      data: {
        openCount: 2,
        maxOpen: 10,
        remaining: 8,
        hasCapacity: true,
        isFull: false,
      },
      isLoading: false,
      error: null,
    } as never);

    mockUseQueryClient.mockReturnValue({
      invalidateQueries: vi.fn(),
    } as never);

    // ApplyCreator creates 4 local mutations.
    mockUseMutation.mockImplementation(() => {
      return {
        mutateAsync: vi.fn(),
        isPending: false,
      } as never;
    });
  });

  it("disables submit when there are fewer than 3 samples", () => {
    renderPage([
      buildRequiredRecentUploadSample({ sort_order: 0 }),
      buildSample({
        id: "sample-2",
        title: "Thumbnail showcase",
        url: "https://example.com/thumbs",
        sort_order: 1,
      }),
    ]);

    expect(
      screen.getByRole("button", { name: /submit for review/i })
    ).toBeDisabled();
  });

  it("disables submit when the required Most Recent Upload/Vod link is missing", () => {
    renderPage([
      buildSample({
        id: "sample-1",
        title: "Portfolio one",
        url: "https://example.com/one",
        sort_order: 0,
      }),
      buildSample({
        id: "sample-2",
        title: "Portfolio two",
        url: "https://example.com/two",
        sort_order: 1,
      }),
      buildSample({
        id: "sample-3",
        title: "Portfolio three",
        url: "https://example.com/three",
        sort_order: 2,
      }),
    ]);

    expect(
      screen.getByRole("button", { name: /submit for review/i })
    ).toBeDisabled();
  });

  it("shows the queue-full message and disables submit when the review queue is full", () => {
    mockUseCreatorApplicationQueueState.mockReturnValue({
      data: {
        openCount: 10,
        maxOpen: 10,
        remaining: 0,
        hasCapacity: false,
        isFull: true,
      },
      isLoading: false,
      error: null,
    } as never);

    renderPage([
      buildRequiredRecentUploadSample({ sort_order: 0 }),
      buildSample({
        id: "sample-2",
        title: "Portfolio two",
        url: "https://example.com/two",
        sort_order: 1,
      }),
      buildSample({
        id: "sample-3",
        title: "Portfolio three",
        url: "https://example.com/three",
        sort_order: 2,
      }),
    ]);

    const submitButton = screen.getByRole("button", {
      name: /submit for review/i,
    });

    expect(submitButton).toBeDisabled();

    expect(
      screen.getByText(/full|check again later|10\/10|queue/i)
    ).toBeInTheDocument();
  });

  it("marks the required link sample clearly and does not show a remove button for it", () => {
    renderPage([
      buildRequiredRecentUploadSample({ id: "required-link", sort_order: 0 }),
      buildSample({
        id: "sample-2",
        title: "Portfolio two",
        url: "https://example.com/two",
        sort_order: 1,
      }),
    ]);

    expect(screen.getByText(/required link sample/i)).toBeInTheDocument();

    // Only the normal sample should expose a remove button.
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(1);
  });

  it("disables submit when the age and capacity acknowledgement is missing", () => {
    mockUseSellerAccess.mockReturnValue({
      isLoading: false,
      isSignedIn: true,
      isAdmin: false,
      isCreatorApproved: false,
      canAccessCreatorRoutes: false,
      canAccessAdminRoutes: false,
      profileReady: true,
      hasLinkedCreatorPlatform: true,
      sellerApplication: {
        id: "application-1",
        profile_user_id: "user-1",
        status: "draft",
        applicant_notes: null,
        agreed_to_terms: true,
        agreed_to_original_work: true,
        agreed_to_manual_review: true,
        agreed_to_age_and_capacity: false,
        submitted_at: null,
        reviewed_at: null,
        reviewed_by: null,
        reviewer_notes: null,
        rejection_reason: null,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
      },
      creatorStatusLabel: "Draft",
      canStartApplication: true,
      canEditApplication: true,
      canSubmitApplication: true,
      error: null,
    } as never);

    renderPage([
      buildRequiredRecentUploadSample({ sort_order: 0 }),
      buildSample({
        id: "sample-2",
        title: "Portfolio two",
        url: "https://example.com/two",
        sort_order: 1,
      }),
      buildSample({
        id: "sample-3",
        title: "Portfolio three",
        url: "https://example.com/three",
        sort_order: 2,
      }),
    ]);

    expect(
      screen.getByRole("button", { name: /submit for review/i })
    ).toBeDisabled();
  });

  it("enables submit when every requirement is met and saves agreements first", async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const submit = vi.fn().mockResolvedValue(undefined);

    mockUseUpsertMySellerApplication.mockReturnValue({ mutateAsync: upsert, isPending: false } as never);
    // Mutations are created in order: add, save recent upload, remove, submit.
    let call = 0;
    mockUseMutation.mockImplementation(() => {
      call += 1;
      return { mutateAsync: call % 4 === 0 ? submit : vi.fn(), isPending: false } as never;
    });

    renderPage(readySamples());

    const button = screen.getByRole("button", { name: /submit for review/i });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith({
        applicationId: "application-1",
        sampleCount: 3,
        videoCount: 0,
      });
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "application-1",
        status: "draft",
        agreed_to_age_and_capacity: true,
        offering_types: ["emotes"],
      })
    );
    expect(upsert.mock.invocationCallOrder[0]).toBeLessThan(submit.mock.invocationCallOrder[0]);
    expect(await screen.findByText(/Application submitted/)).toBeInTheDocument();
  });

  it("asks what they'll offer, needs at least one, and saves every choice", async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    mockUseUpsertMySellerApplication.mockReturnValue({ mutateAsync: upsert, isPending: false } as never);
    withApplication({ sellerApplication: { offering_types: [] } });

    renderPage(readySamples());

    expect(screen.getByText("What will you offer?")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: /submit for review/i });
    expect(button).toBeDisabled();
    expect(screen.getAllByText(/Choose what you'll offer/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("checkbox", { name: "VTuber Models" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Something else" }));
    expect(button).toBeEnabled();

    fireEvent.click(button);

    await waitFor(() =>
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({ offering_types: ["vtuber-models", "other"] }),
      ),
    );
  });

  it("shows a save failure instead of throwing when submitting", async () => {
    mockUseUpsertMySellerApplication.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error("Could not save agreements")),
      isPending: false,
    } as never);

    renderPage(readySamples());
    fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));

    expect(await screen.findByText("Could not save agreements")).toBeInTheDocument();
  });

  it("offers to start an application when none exists", () => {
    withApplication({ sellerApplication: null, canEditApplication: true, creatorStatusLabel: "Not started" });

    renderPage([]);

    expect(screen.getByRole("heading", { name: "What you’ll need" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start application" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /submit for review/i })).not.toBeInTheDocument();
  });

  it("sends new applicants to settings when their profile is incomplete", () => {
    withApplication({ sellerApplication: null, canStartApplication: false, profileReady: false });

    renderPage([]);

    expect(screen.getByRole("button", { name: "Start application" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Finish your profile first" })).toHaveAttribute(
      "href",
      "/settings/profile"
    );
  });

  it("shows a read-only status while the application is in review", () => {
    withApplication({ sellerApplication: { status: "under_review" }, canEditApplication: false });

    renderPage(readySamples());

    expect(screen.getByText("Your application is with our reviewers")).toBeInTheDocument();
    expect(screen.getAllByText("Under review").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /submit for review/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("points approved creators to their next steps", () => {
    withApplication({ sellerApplication: { status: "approved" }, canEditApplication: false });

    renderPage(readySamples());

    expect(screen.getByText("You’re an approved creator")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create a listing" })).toHaveAttribute(
      "href",
      "/creator/listings/new"
    );
  });

  it("shows reviewer notes and allows re-submission when changes are requested", () => {
    withApplication({
      sellerApplication: { status: "needs_changes", reviewer_notes: "Please add a more recent VOD." },
    });

    renderPage(readySamples());

    expect(screen.getByText("Please add a more recent VOD.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Re-submit for review" })).toBeEnabled();
  });

  it("explains a rejected application and keeps it closed", () => {
    withApplication({
      sellerApplication: { status: "rejected", rejection_reason: "Samples were not original work." },
      canEditApplication: false,
    });

    renderPage(readySamples());

    expect(screen.getByText("This application wasn’t approved")).toBeInTheDocument();
    expect(screen.getByText("Samples were not original work.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit for review/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submitted samples/ })).toHaveAttribute("aria-expanded", "false");
  });
});
