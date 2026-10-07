import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  renderHook,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { useListingRequestProgressUpdates } from "../useListingRequestProgressUpdates";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock("../../../providers/AuthProvider", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: mocks.from,
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe("useListingRequestProgressUpdates", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAuth.mockReturnValue({
      user: {
        id: "buyer-1",
      },
    });

    mocks.from.mockReturnValue({
      select: mocks.select,
    });

    mocks.select.mockReturnValue({
      eq: mocks.eq,
    });

    mocks.eq.mockReturnValue({
      order: mocks.order,
    });

    mocks.order.mockResolvedValue({
      data: [
        {
          id: "progress-update-2",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          creator_user_id: "creator-1",
          update_kind: "milestone",
          title: "Sketch milestone complete",
          body: "The initial sketch milestone is ready for review.",
          progress_percent: 50,
          created_at: "2026-06-08T12:00:00.000Z",
          updated_at: "2026-06-08T12:00:00.000Z",
        },
        {
          id: "progress-update-1",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          creator_user_id: "creator-1",
          update_kind: "progress",
          title: "Work started",
          body: "The creator has started the initial concept work.",
          progress_percent: 15,
          created_at: "2026-06-06T12:00:00.000Z",
          updated_at: "2026-06-06T12:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("loads progress updates newest first for the commission", async () => {
    const { result } = renderHook(
      () => useListingRequestProgressUpdates("request-1"),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mocks.from).toHaveBeenCalledWith(
      "listing_request_progress_updates"
    );

    expect(mocks.eq).toHaveBeenCalledWith(
      "listing_request_id",
      "request-1"
    );

    expect(mocks.order).toHaveBeenCalledWith(
      "created_at",
      {
        ascending: false,
      }
    );

    expect(result.current.data).toEqual([
      expect.objectContaining({
        id: "progress-update-2",
        update_kind: "milestone",
        progress_percent: 50,
      }),
      expect.objectContaining({
        id: "progress-update-1",
        update_kind: "progress",
        progress_percent: 15,
      }),
    ]);
  });

  it("returns an empty list when no progress updates exist", async () => {
    mocks.order.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () => useListingRequestProgressUpdates("request-1"),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it("does not query when the user is signed out", () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    const { result } = renderHook(
      () => useListingRequestProgressUpdates("request-1"),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("surfaces progress update query errors", async () => {
    mocks.order.mockResolvedValue({
      data: null,
      error: new Error(
        "Project progress updates could not be loaded."
      ),
    });

    const { result } = renderHook(
      () => useListingRequestProgressUpdates("request-1"),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(
      new Error(
        "Project progress updates could not be loaded."
      )
    );
  });
});