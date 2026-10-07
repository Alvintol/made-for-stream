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

import { useListingRequestChangeOrders } from "../useListingRequestChangeOrders";

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

describe("useListingRequestChangeOrders", () => {
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
          id: "change-order-2",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          creator_user_id: "creator-1",
          buyer_user_id: "buyer-1",
          version_number: 2,
          status: "sent",
          title: "Additional animation",
          summary: "Add one animation and extend delivery.",
          changes_scope: true,
          changes_price: true,
          changes_timeline: true,
          changes_deliverables: true,
          changes_payment_schedule: false,
          changes_milestones: false,
          price_delta: 150,
          revised_total_amount: 450,
          timeline_delta_days: 5,
          revised_completion_at:
            "2026-06-25T12:00:00.000Z",
          before_snapshot: {
            currency: "cad",
          },
          proposed_snapshot: {
            currency: "cad",
          },
          buyer_response_reason: null,
          sent_at: "2026-06-08T12:00:00.000Z",
          buyer_accepted_at: null,
          buyer_declined_at: null,
          cancelled_at: null,
          superseded_at: null,
          applied_at: null,
          created_at: "2026-06-08T12:00:00.000Z",
          updated_at: "2026-06-08T12:00:00.000Z",
        },
        {
          id: "change-order-1",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          creator_user_id: "creator-1",
          buyer_user_id: "buyer-1",
          version_number: 1,
          status: "buyer_declined",
          title: "Extra revision",
          summary: "Add one additional revision round.",
          changes_scope: true,
          changes_price: false,
          changes_timeline: false,
          changes_deliverables: false,
          changes_payment_schedule: false,
          changes_milestones: false,
          price_delta: 0,
          revised_total_amount: null,
          timeline_delta_days: 0,
          revised_completion_at: null,
          before_snapshot: {
            currency: "cad",
          },
          proposed_snapshot: {
            currency: "cad",
          },
          buyer_response_reason:
            "The additional revision is no longer needed.",
          sent_at: "2026-06-06T12:00:00.000Z",
          buyer_accepted_at: null,
          buyer_declined_at: "2026-06-07T12:00:00.000Z",
          cancelled_at: null,
          superseded_at: null,
          applied_at: null,
          created_at: "2026-06-06T12:00:00.000Z",
          updated_at: "2026-06-07T12:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("loads change orders newest version first", async () => {
    const { result } = renderHook(
      () => useListingRequestChangeOrders("request-1"),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mocks.from).toHaveBeenCalledWith(
      "listing_request_change_orders"
    );

    expect(mocks.eq).toHaveBeenCalledWith(
      "listing_request_id",
      "request-1"
    );

    expect(mocks.order).toHaveBeenCalledWith(
      "version_number",
      {
        ascending: false,
      }
    );

    expect(result.current.data).toEqual([
      expect.objectContaining({
        id: "change-order-2",
        version_number: 2,
        status: "sent",
      }),
      expect.objectContaining({
        id: "change-order-1",
        version_number: 1,
        status: "buyer_declined",
      }),
    ]);
  });

  it("returns an empty list when no change orders exist", async () => {
    mocks.order.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () => useListingRequestChangeOrders("request-1"),
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
      () => useListingRequestChangeOrders("request-1"),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not query without a commission id", () => {
    const { result } = renderHook(
      () => useListingRequestChangeOrders(null),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("surfaces change-order query errors", async () => {
    mocks.order.mockResolvedValue({
      data: null,
      error: new Error(
        "Project change orders could not be loaded."
      ),
    });

    const { result } = renderHook(
      () => useListingRequestChangeOrders("request-1"),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(
      new Error(
        "Project change orders could not be loaded."
      )
    );
  });
});