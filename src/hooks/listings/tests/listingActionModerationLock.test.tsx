import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDeleteListingDraft } from "../useDeleteListingDraft";
import { useMoveListingToDraft } from "../useMoveListingToDraft";
import { usePublishListing } from "../usePublishListing";
import { useSetListingActiveState } from "../useSetListingActiveState";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  useAuth: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

vi.mock("../../../providers/AuthProvider", () => ({
  useAuth: mocks.useAuth,
}));

type SupabaseChain = {
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

const createRpcSuccess = <Data,>(data: Data) => ({
  data,
  error: null,
  count: null,
  status: 200,
  statusText: "OK",
});

const createSupabaseChain = (data: unknown = { id: "listing-1" }) => {
  const chain: SupabaseChain = {
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    select: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(createRpcSuccess(data))),
  };

  mocks.from.mockReturnValue(chain);

  return chain;
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("listing action moderation lock guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useAuth.mockReturnValue({
      user: { id: "creator-1" },
    });

    mocks.rpc.mockResolvedValue({
      data: true,
      error: null,
    });
  });

  it("delete draft applies the admin-hidden null guard", async () => {
    const chain = createSupabaseChain({ id: "listing-1" });

    const { result } = renderHook(() => useDeleteListingDraft(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync("listing-1");

    expect(mocks.from).toHaveBeenCalledWith("listings");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.is).toHaveBeenCalledWith("admin_hidden_at", null);
    expect(chain.select).toHaveBeenCalledWith("id");
    expect(chain.maybeSingle).toHaveBeenCalled();
  });

  it("publish listing applies the admin-hidden null guard", async () => {
    const chain = createSupabaseChain({ id: "listing-1" });

    const { result } = renderHook(() => usePublishListing(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync("listing-1");

    expect(mocks.from).toHaveBeenCalledWith("listings");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        is_active: true,
      })
    );
    expect(chain.is).toHaveBeenCalledWith("admin_hidden_at", null);
    expect(chain.select).toHaveBeenCalledWith("id");
    expect(chain.maybeSingle).toHaveBeenCalled();
  });

  it("set active state applies the admin-hidden null guard", async () => {
    const chain = createSupabaseChain({
      id: "listing-1",
      is_active: true,
    });

    const { result } = renderHook(() => useSetListingActiveState(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      listingId: "listing-1",
      isActive: true,
    });

    expect(mocks.from).toHaveBeenCalledWith("listings");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_active: true,
      })
    );
    expect(chain.is).toHaveBeenCalledWith("admin_hidden_at", null);
    expect(chain.select).toHaveBeenCalledWith("id, is_active");
    expect(chain.maybeSingle).toHaveBeenCalled();
  });

  it("move to draft applies the admin-hidden null guard", async () => {
    const chain = createSupabaseChain({ id: "listing-1" });

    const { result } = renderHook(() => useMoveListingToDraft(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync("listing-1");

    expect(mocks.from).toHaveBeenCalledWith("listings");
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        is_active: false,
      })
    );
    expect(chain.is).toHaveBeenCalledWith("admin_hidden_at", null);
    expect(chain.select).toHaveBeenCalledWith("id");
    expect(chain.maybeSingle).toHaveBeenCalled();
  });

  it("delete draft throws a moderation-lock message when no row is deleted", async () => {
    createSupabaseChain(null);

    const { result } = renderHook(() => useDeleteListingDraft(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync("listing-1")).rejects.toThrow(
      "This draft could not be deleted. It may be locked by moderation."
    );
  });

  it("publish listing throws a moderation-lock message when no row is updated", async () => {
    createSupabaseChain(null);

    const { result } = renderHook(() => usePublishListing(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync("listing-1")).rejects.toThrow(
      "This listing could not be published. It may no longer be an editable draft or it may be locked by moderation."
    );
  });

  it("set active state throws a moderation-lock message when no row is updated", async () => {
    createSupabaseChain(null);

    const { result } = renderHook(() => useSetListingActiveState(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync({
        listingId: "listing-1",
        isActive: true,
      })
    ).rejects.toThrow(
      "This listing visibility could not be updated. It may be locked by moderation."
    );
  });

  it("move to draft throws a moderation-lock message when no row is updated", async () => {
    createSupabaseChain(null);

    const { result } = renderHook(() => useMoveListingToDraft(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync("listing-1")).rejects.toThrow(
      "This listing could not be moved to draft. It may be locked by moderation."
    );
  });

  it("publish listing checks creator payment account readiness before publishing", async () => {
    const chain = createSupabaseChain({ id: "listing-1" });

    const { result } = renderHook(() => usePublishListing(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync("listing-1");

    expect(mocks.rpc).toHaveBeenCalledWith("has_ready_creator_payment_account", {
      target_user_id: "creator-1",
    });
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        is_active: true,
      }),
    );
  });

  it("publish listing blocks when creator payment account is not ready", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: false,
      error: null,
    });

    const chain = createSupabaseChain({ id: "listing-1" });

    const { result } = renderHook(() => usePublishListing(), {
      wrapper: createWrapper(),
    });

    await expect(result.current.mutateAsync("listing-1")).rejects.toThrow(
      "Connect and complete Stripe payout onboarding before publishing paid listings.",
    );

    expect(chain.update).not.toHaveBeenCalled();
  });

  it("reactivating a listing checks creator payment account readiness", async () => {
    const chain = createSupabaseChain({
      id: "listing-1",
      is_active: true,
    });

    const { result } = renderHook(() => useSetListingActiveState(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      listingId: "listing-1",
      isActive: true,
    });

    expect(mocks.rpc).toHaveBeenCalledWith("has_ready_creator_payment_account", {
      target_user_id: "creator-1",
    });
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_active: true,
      }),
    );
  });

  it("deactivating a listing does not require creator payment account readiness", async () => {
    const chain = createSupabaseChain({
      id: "listing-1",
      is_active: false,
    });

    const { result } = renderHook(() => useSetListingActiveState(), {
      wrapper: createWrapper(),
    });

    await result.current.mutateAsync({
      listingId: "listing-1",
      isActive: false,
    });

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_active: false,
      }),
    );
  });
});