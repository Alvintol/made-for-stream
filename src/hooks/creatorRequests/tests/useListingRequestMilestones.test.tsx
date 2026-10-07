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

import { useListingRequestMilestones } from "../useListingRequestMilestones";

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

describe("useListingRequestMilestones", () => {
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
          id: "milestone-1",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          agreement_item_id: "item-1",
          payment_schedule_item_id:
            "payment-1",
          creator_user_id: "creator-1",
          buyer_user_id: "buyer-1",
          status: "pending",
          title: "Initial design direction",
          description:
            "Deliver initial concepts for review.",
          amount: 100,
          currency: "cad",
          sort_order: 0,
          submission_version: 0,
          latest_submitted_at: null,
          latest_revision_requested_at: null,
          buyer_approved_at: null,
          payment_required_at: null,
          paid_at: null,
          cancelled_at: null,
          created_at:
            "2026-06-15T12:00:00.000Z",
          updated_at:
            "2026-06-15T12:00:00.000Z",
        },
        {
          id: "milestone-2",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          agreement_item_id: "item-2",
          payment_schedule_item_id:
            "payment-2",
          creator_user_id: "creator-1",
          buyer_user_id: "buyer-1",
          status: "pending",
          title: "Completed project package",
          description:
            "Deliver completed project files.",
          amount: 200,
          currency: "cad",
          sort_order: 1,
          submission_version: 0,
          latest_submitted_at: null,
          latest_revision_requested_at: null,
          buyer_approved_at: null,
          payment_required_at: null,
          paid_at: null,
          cancelled_at: null,
          created_at:
            "2026-06-15T12:00:00.000Z",
          updated_at:
            "2026-06-15T12:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("loads milestones in agreement order", async () => {
    const { result } = renderHook(
      () =>
        useListingRequestMilestones(
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
      "listing_request_milestones"
    );

    expect(mocks.eq).toHaveBeenCalledWith(
      "listing_request_id",
      "request-1"
    );

    expect(mocks.order).toHaveBeenCalledWith(
      "sort_order",
      {
        ascending: true,
      }
    );

    expect(result.current.data).toEqual([
      expect.objectContaining({
        id: "milestone-1",
        sort_order: 0,
        status: "pending",
      }),
      expect.objectContaining({
        id: "milestone-2",
        sort_order: 1,
        status: "pending",
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
        useListingRequestMilestones(
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
        useListingRequestMilestones(
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
      () => useListingRequestMilestones(null),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.fetchStatus).toBe(
      "idle"
    );

    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("surfaces milestone query errors", async () => {
    mocks.order.mockResolvedValue({
      data: null,
      error: new Error(
        "Milestones could not be loaded."
      ),
    });

    const { result } = renderHook(
      () =>
        useListingRequestMilestones(
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
        "Milestones could not be loaded."
      )
    );
  });
});