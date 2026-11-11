import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CREATOR_PAYMENT_ACCOUNT_REQUIRED_MESSAGE,
  requireCreatorPaymentAccountReadyForPublishing,
} from "../listingPaymentAccountGuards";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}));

const mockListing = (
  data: { is_free: boolean } | null,
  error: unknown = null,
) => {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve({ data, error })),
  };

  mocks.from.mockReturnValue(chain);

  return chain;
};

// Answers each RPC by name: payments_are_live (the pre-launch switch) and
// has_ready_creator_payment_account (Stripe readiness).
const mockRpc = (
  { live = true, ready = false, liveError = null }: { live?: boolean; ready?: boolean; liveError?: unknown } = {},
) => {
  mocks.rpc.mockImplementation((name: string) =>
    Promise.resolve(
      name === "payments_are_live"
        ? { data: liveError ? null : live, error: liveError }
        : { data: ready, error: null },
    ),
  );
};

describe("requireCreatorPaymentAccountReadyForPublishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a free listing without a connected account", async () => {
    mockListing({ is_free: true });
    mockRpc({ ready: false });

    await expect(
      requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1"),
    ).resolves.toBeUndefined();

    // A free listing never takes a payment, so readiness is not consulted at all.
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires a ready account for a paid listing", async () => {
    mockListing({ is_free: false });
    mockRpc({ ready: false });

    await expect(
      requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1"),
    ).rejects.toThrow(CREATOR_PAYMENT_ACCOUNT_REQUIRED_MESSAGE);
  });

  it("allows a paid listing when the account is ready", async () => {
    mockListing({ is_free: false });
    mockRpc({ ready: true });

    await expect(
      requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1"),
    ).resolves.toBeUndefined();
  });

  it("checks readiness when the listing cannot be read", async () => {
    // Not finding the row must not be mistaken for a free listing.
    mockListing(null);
    mockRpc({ ready: false });

    await expect(
      requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1"),
    ).rejects.toThrow(CREATOR_PAYMENT_ACCOUNT_REQUIRED_MESSAGE);
  });

  it("surfaces a listing read failure instead of skipping the check", async () => {
    mockListing(null, new Error("network"));
    mockRpc({ ready: true });

    await expect(
      requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1"),
    ).rejects.toThrow("network");

    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("allows a paid listing without an account while payments are locked", async () => {
    // Soft launch: the database lets it publish, so the site must too.
    mockListing({ is_free: false });
    mockRpc({ live: false, ready: false });

    await expect(
      requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1"),
    ).resolves.toBeUndefined();

    expect(mocks.rpc).not.toHaveBeenCalledWith(
      "has_ready_creator_payment_account",
      expect.anything(),
    );
  });

  it("surfaces a failed payments switch read instead of guessing", async () => {
    mockListing({ is_free: false });
    mockRpc({ liveError: new Error("switch unreadable"), ready: true });

    await expect(
      requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1"),
    ).rejects.toThrow("switch unreadable");
  });

  it("scopes the listing read to the acting creator", async () => {
    const chain = mockListing({ is_free: true });

    await requireCreatorPaymentAccountReadyForPublishing("user-1", "listing-1");

    expect(chain.eq).toHaveBeenCalledWith("id", "listing-1");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
