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

import { useListingRequestFinalDeliveries } from "../useListingRequestFinalDeliveries";

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

describe("useListingRequestFinalDeliveries", () => {
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
          id: "final-delivery-2",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          creator_user_id: "creator-1",
          buyer_user_id: "buyer-1",
          version_number: 2,
          status: "submitted",
          title: "Updated final overlay delivery",
          summary:
            "The revised overlay package is ready for review.",
          delivery_links: [
            "https://example.com/final-v2",
          ],
          agreement_snapshot: {
            agreement_id: "agreement-1",
          },
          revision_request_reason: null,
          submitted_at:
            "2026-06-11T12:00:00.000Z",
          revision_requested_at: null,
          buyer_approved_at: null,
          cancelled_at: null,
          superseded_at: null,
          created_at:
            "2026-06-11T12:00:00.000Z",
          updated_at:
            "2026-06-11T12:00:00.000Z",
        },
        {
          id: "final-delivery-1",
          listing_request_id: "request-1",
          agreement_id: "agreement-1",
          creator_user_id: "creator-1",
          buyer_user_id: "buyer-1",
          version_number: 1,
          status: "revision_requested",
          title: "Initial final overlay delivery",
          summary:
            "The first overlay package was submitted.",
          delivery_links: [
            "https://example.com/final-v1",
          ],
          agreement_snapshot: {
            agreement_id: "agreement-1",
          },
          revision_request_reason:
            "Please adjust the text alignment.",
          submitted_at:
            "2026-06-09T12:00:00.000Z",
          revision_requested_at:
            "2026-06-10T12:00:00.000Z",
          buyer_approved_at: null,
          cancelled_at: null,
          superseded_at: null,
          created_at:
            "2026-06-09T12:00:00.000Z",
          updated_at:
            "2026-06-10T12:00:00.000Z",
        },
      ],
      error: null,
    });
  });

  it("loads final deliveries newest version first", async () => {
    const { result } = renderHook(
      () =>
        useListingRequestFinalDeliveries(
          "request-1"
        ),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mocks.from).toHaveBeenCalledWith(
      "listing_request_final_deliveries"
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
        id: "final-delivery-2",
        version_number: 2,
        status: "submitted",
      }),
      expect.objectContaining({
        id: "final-delivery-1",
        version_number: 1,
        status: "revision_requested",
      }),
    ]);
  });

  it("returns an empty list when no deliveries exist", async () => {
    mocks.order.mockResolvedValue({
      data: null,
      error: null,
    });

    const { result } = renderHook(
      () =>
        useListingRequestFinalDeliveries(
          "request-1"
        ),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it("does not query while signed out", () => {
    mocks.useAuth.mockReturnValue({
      user: null,
    });

    const { result } = renderHook(
      () =>
        useListingRequestFinalDeliveries(
          "request-1"
        ),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not query without a commission id", () => {
    const { result } = renderHook(
      () => useListingRequestFinalDeliveries(null),
      {
        wrapper: createWrapper(),
      }
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("surfaces final-delivery query errors", async () => {
    mocks.order.mockResolvedValue({
      data: null,
      error: new Error(
        "Final deliveries could not be loaded."
      ),
    });

    const { result } = renderHook(
      () =>
        useListingRequestFinalDeliveries(
          "request-1"
        ),
      {
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(
      new Error(
        "Final deliveries could not be loaded."
      )
    );
  });
});