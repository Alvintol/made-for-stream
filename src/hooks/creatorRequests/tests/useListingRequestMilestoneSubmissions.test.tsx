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

import { useListingRequestMilestoneSubmissions } from "../useListingRequestMilestoneSubmissions";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
}));

vi.mock(
  "../../../providers/AuthProvider",
  () => ({
    useAuth: mocks.useAuth,
  })
);

vi.mock(
  "../../../lib/supabaseClient",
  () => ({
    supabase: {
      from: mocks.from,
    },
  })
);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({
    children,
  }: {
    children: ReactNode;
  }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe(
  "useListingRequestMilestoneSubmissions",
  () => {
    beforeEach(() => {
      vi.clearAllMocks();

      mocks.useAuth.mockReturnValue({
        user: {
          id: "creator-1",
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
            id: "milestone-submission-2",
            milestone_id: "milestone-1",
            listing_request_id: "request-1",
            agreement_id: "agreement-1",
            creator_user_id: "creator-1",
            buyer_user_id: "buyer-1",
            version_number: 2,
            status: "submitted",
            summary:
              "The revised concepts are ready.",
            delivery_links: [
              "https://example.com/revised",
            ],
            revision_request_reason: null,
            submitted_at:
              "2026-06-17T12:00:00.000Z",
            revision_requested_at: null,
            buyer_approved_at: null,
            superseded_at: null,
            created_at:
              "2026-06-17T12:00:00.000Z",
            updated_at:
              "2026-06-17T12:00:00.000Z",
          },
          {
            id: "milestone-submission-1",
            milestone_id: "milestone-1",
            listing_request_id: "request-1",
            agreement_id: "agreement-1",
            creator_user_id: "creator-1",
            buyer_user_id: "buyer-1",
            version_number: 1,
            status: "revision_requested",
            summary:
              "The first concepts are ready.",
            delivery_links: [
              "https://example.com/first",
            ],
            revision_request_reason:
              "Please adjust the colour direction.",
            submitted_at:
              "2026-06-16T12:00:00.000Z",
            revision_requested_at:
              "2026-06-16T18:00:00.000Z",
            buyer_approved_at: null,
            superseded_at: null,
            created_at:
              "2026-06-16T12:00:00.000Z",
            updated_at:
              "2026-06-16T18:00:00.000Z",
          },
        ],
        error: null,
      });
    });

    it("loads milestone submissions newest first", async () => {
      const { result } = renderHook(
        () =>
          useListingRequestMilestoneSubmissions(
            "request-1"
          ),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(
          true
        );
      });

      expect(mocks.from).toHaveBeenCalledWith(
        "listing_request_milestone_submissions"
      );

      expect(mocks.eq).toHaveBeenCalledWith(
        "listing_request_id",
        "request-1"
      );

      expect(mocks.order).toHaveBeenCalledWith(
        "submitted_at",
        {
          ascending: false,
        }
      );

      expect(result.current.data).toEqual([
        expect.objectContaining({
          id: "milestone-submission-2",
          version_number: 2,
          status: "submitted",
        }),
        expect.objectContaining({
          id: "milestone-submission-1",
          version_number: 1,
          status: "revision_requested",
        }),
      ]);
    });

    it("returns an empty list when none exist", async () => {
      mocks.order.mockResolvedValue({
        data: null,
        error: null,
      });

      const { result } = renderHook(
        () =>
          useListingRequestMilestoneSubmissions(
            "request-1"
          ),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(
          true
        );
      });

      expect(result.current.data).toEqual([]);
    });

    it("does not query while signed out", () => {
      mocks.useAuth.mockReturnValue({
        user: null,
      });

      const { result } = renderHook(
        () =>
          useListingRequestMilestoneSubmissions(
            "request-1"
          ),
        {
          wrapper: createWrapper(),
        }
      );

      expect(result.current.fetchStatus).toBe(
        "idle"
      );

      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("does not query without a commission id", () => {
      const { result } = renderHook(
        () =>
          useListingRequestMilestoneSubmissions(
            null
          ),
        {
          wrapper: createWrapper(),
        }
      );

      expect(result.current.fetchStatus).toBe(
        "idle"
      );

      expect(mocks.from).not.toHaveBeenCalled();
    });

    it("surfaces milestone submission query errors", async () => {
      mocks.order.mockResolvedValue({
        data: null,
        error: new Error(
          "Milestone submissions could not be loaded."
        ),
      });

      const { result } = renderHook(
        () =>
          useListingRequestMilestoneSubmissions(
            "request-1"
          ),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(
          true
        );
      });

      expect(result.current.error).toEqual(
        new Error(
          "Milestone submissions could not be loaded."
        )
      );
    });
  }
);