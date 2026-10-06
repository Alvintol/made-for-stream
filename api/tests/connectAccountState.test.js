import { describe, expect, it } from "vitest";
import {
  CONNECT_ACCOUNT_RESYNC_EVENT_TYPES,
  CONNECT_ACCOUNT_RETRIEVE_INCLUDE,
  buildCreatorPaymentAccountPatch,
  classifyConnectAccountEvent,
  deriveCreatorPaymentAccountReadinessFromV2Account,
  deriveCreatorRequirementCountsFromV2Account,
  didCreatorPaymentAccountLoseReadiness,
  isCreatorPaymentAccountReady,
  isStripeAccountGoneError,
  selectAccountsForResync,
} from "../connectAccountState.js";

const activeAccount = {
  id: "acct_123",
  configuration: {
    merchant: { capabilities: { card_payments: { status: "active" } } },
    recipient: {
      capabilities: { stripe_balance: { payouts: { status: "active" } } },
    },
  },
  requirements: { entries: [] },
};

const restrictedAccount = {
  id: "acct_123",
  configuration: {
    merchant: { capabilities: { card_payments: { status: "restricted" } } },
    recipient: {
      capabilities: { stripe_balance: { payouts: { status: "active" } } },
    },
  },
  requirements: {
    entries: [
      {
        awaiting_action_from: "user",
        minimum_deadline: { status: "past_due" },
      },
      {
        awaiting_action_from: "user",
        minimum_deadline: { status: "currently_due" },
      },
      {
        awaiting_action_from: "user",
        minimum_deadline: { status: "eventually_due" },
      },
      {
        awaiting_action_from: "stripe",
        minimum_deadline: { status: "past_due" },
      },
    ],
  },
};

const observedAt = "2026-09-24T12:00:00.000Z";

describe("deriveCreatorPaymentAccountReadinessFromV2Account", () => {
  it("reads an active account as ready", () => {
    expect(deriveCreatorPaymentAccountReadinessFromV2Account(activeAccount)).toEqual({
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    });
  });

  it("reads a restricted capability and outstanding requirements as not ready", () => {
    expect(
      deriveCreatorPaymentAccountReadinessFromV2Account(restrictedAccount),
    ).toEqual({
      chargesEnabled: false,
      payoutsEnabled: true,
      detailsSubmitted: false,
    });
  });

  it("never reads a closed account as ready, whatever its capabilities say", () => {
    expect(
      deriveCreatorPaymentAccountReadinessFromV2Account({
        ...activeAccount,
        closed: true,
      }),
    ).toEqual({
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    });
  });

  it("reads a response without configuration or requirements as not ready", () => {
    expect(
      deriveCreatorPaymentAccountReadinessFromV2Account({ id: "acct_123" }),
    ).toEqual({
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    });
  });
});

describe("deriveCreatorRequirementCountsFromV2Account", () => {
  it("counts only what the creator must do now, and what is past due", () => {
    expect(deriveCreatorRequirementCountsFromV2Account(restrictedAccount)).toEqual({
      requirementsDueCount: 2,
      requirementsPastDueCount: 1,
    });
  });

  it("is zero when requirements are missing", () => {
    expect(deriveCreatorRequirementCountsFromV2Account({})).toEqual({
      requirementsDueCount: 0,
      requirementsPastDueCount: 0,
    });
  });
});

describe("buildCreatorPaymentAccountPatch", () => {
  const base = {
    userId: "user-1",
    country: "CA",
    defaultCurrency: "cad",
    onboardingStartedAt: null,
    observedAt,
  };

  it("stamps the observation time on the state and the sync time", () => {
    const patch = buildCreatorPaymentAccountPatch({
      ...base,
      stripeAccount: activeAccount,
    });

    expect(patch).toMatchObject({
      user_id: "user-1",
      provider: "stripe",
      stripe_account_id: "acct_123",
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      requirements_due_count: 0,
      requirements_past_due_count: 0,
      country: "CA",
      default_currency: "cad",
      stripe_state_observed_at: observedAt,
      last_synced_at: observedAt,
      onboarding_completed_at: observedAt,
    });
  });

  it("keeps the first completion time instead of bumping it on every sync", () => {
    const patch = buildCreatorPaymentAccountPatch({
      ...base,
      stripeAccount: activeAccount,
      existing: {
        onboarding_completed_at: "2026-09-01T00:00:00.000Z",
        onboarding_started_at: "2026-08-31T00:00:00.000Z",
      },
    });

    expect(patch.onboarding_completed_at).toBe("2026-09-01T00:00:00.000Z");
    expect(patch.onboarding_started_at).toBe("2026-08-31T00:00:00.000Z");
  });

  it("clears completion when requirements reopen", () => {
    const patch = buildCreatorPaymentAccountPatch({
      ...base,
      stripeAccount: restrictedAccount,
      existing: { onboarding_completed_at: "2026-09-01T00:00:00.000Z" },
    });

    expect(patch.onboarding_completed_at).toBeNull();
    expect(patch.requirements_due_count).toBe(2);
    expect(patch.requirements_past_due_count).toBe(1);
  });

  it("refuses a write without an observation time, so the database can order it", () => {
    expect(() =>
      buildCreatorPaymentAccountPatch({
        ...base,
        observedAt: undefined,
        stripeAccount: activeAccount,
      }),
    ).toThrow(/observation time/);
  });

  it("refuses an account without an id", () => {
    expect(() =>
      buildCreatorPaymentAccountPatch({ ...base, stripeAccount: {} }),
    ).toThrow(/missing an id/);
  });

  it("is the same mapping for every writer: identical input, identical row", () => {
    const fromEvent = buildCreatorPaymentAccountPatch({
      ...base,
      stripeAccount: restrictedAccount,
    });
    const fromResync = buildCreatorPaymentAccountPatch({
      ...base,
      stripeAccount: structuredClone(restrictedAccount),
    });

    expect(fromEvent).toEqual(fromResync);
  });
});

describe("classifyConnectAccountEvent", () => {
  const notification = (type, relatedObject) => ({
    id: "evt_test_1",
    type,
    related_object: relatedObject,
  });

  it.each([...CONNECT_ACCOUNT_RESYNC_EVENT_TYPES])("resyncs on %s", (type) => {
    expect(
      classifyConnectAccountEvent(
        notification(type, { id: "acct_123", type: "v2.core.account", url: "/v2/core/accounts/acct_123" }),
      ),
    ).toEqual({ action: "resync", stripeAccountId: "acct_123" });
  });

  it("handles the two event types the brief names", () => {
    expect(CONNECT_ACCOUNT_RESYNC_EVENT_TYPES).toContain(
      "v2.core.account[requirements].updated",
    );
    expect(CONNECT_ACCOUNT_RESYNC_EVENT_TYPES).toContain(
      "v2.core.account[configuration.merchant].capability_status_updated",
    );
  });

  it("ignores other event types", () => {
    expect(
      classifyConnectAccountEvent(
        notification("v2.core.account[identity].updated", {
          id: "acct_123",
          type: "v2.core.account",
        }),
      ).action,
    ).toBe("ignore");
  });

  it("ignores an event without a v2 account related object", () => {
    expect(
      classifyConnectAccountEvent(
        notification("v2.core.account[requirements].updated", null),
      ).action,
    ).toBe("ignore");
    expect(
      classifyConnectAccountEvent(
        notification("v2.core.account[requirements].updated", {
          id: "acct_../../x",
          type: "v2.core.account",
        }),
      ).action,
    ).toBe("ignore");
  });

  it("takes nothing but the account id from the payload -- state always comes from a fresh read", () => {
    const decision = classifyConnectAccountEvent({
      id: "evt_test_1",
      type: "v2.core.account[requirements].updated",
      related_object: { id: "acct_123", type: "v2.core.account" },
      changes: { before: { charges_enabled: true }, after: { charges_enabled: false } },
    });

    expect(Object.keys(decision).sort()).toEqual(["action", "stripeAccountId"]);
  });
});

describe("readiness transitions", () => {
  const ready = { charges_enabled: true, payouts_enabled: true, details_submitted: true };
  const notReady = { ...ready, charges_enabled: false };

  it("treats only all three flags as ready", () => {
    expect(isCreatorPaymentAccountReady(ready)).toBe(true);
    expect(isCreatorPaymentAccountReady(notReady)).toBe(false);
    expect(isCreatorPaymentAccountReady(null)).toBe(false);
  });

  it("flags ready -> not ready only", () => {
    expect(didCreatorPaymentAccountLoseReadiness(ready, notReady)).toBe(true);
    expect(didCreatorPaymentAccountLoseReadiness(notReady, notReady)).toBe(false);
    expect(didCreatorPaymentAccountLoseReadiness(notReady, ready)).toBe(false);
    expect(didCreatorPaymentAccountLoseReadiness(ready, ready)).toBe(false);
  });
});

describe("selectAccountsForResync", () => {
  const now = Date.parse("2026-09-24T12:00:00.000Z");
  const hoursAgo = (hours) => new Date(now - hours * 3600 * 1000).toISOString();

  it("reads never-synced rows first, then the stalest, skipping recent ones", () => {
    const rows = [
      { stripe_account_id: "acct_recent", last_synced_at: hoursAgo(1) },
      { stripe_account_id: "acct_7h", last_synced_at: hoursAgo(7) },
      { stripe_account_id: "acct_never", last_synced_at: null },
      { stripe_account_id: "acct_30h", last_synced_at: hoursAgo(30) },
      { stripe_account_id: "", last_synced_at: null },
    ];

    expect(
      selectAccountsForResync(rows, { now }).map((row) => row.stripe_account_id),
    ).toEqual(["acct_never", "acct_30h", "acct_7h"]);
  });

  it("respects the batch limit", () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      stripe_account_id: `acct_${index}`,
      last_synced_at: hoursAgo(10 + index),
    }));

    expect(selectAccountsForResync(rows, { now, limit: 2 })).toHaveLength(2);
  });
});

it("retrieves every section the mapping reads", () => {
  expect(CONNECT_ACCOUNT_RETRIEVE_INCLUDE).toEqual(
    expect.arrayContaining([
      "configuration.merchant",
      "configuration.recipient",
      "requirements",
      "identity",
    ]),
  );
});

describe("isStripeAccountGoneError (CON-009)", () => {
  it("recognises Stripe's missing-account error, by code or by message", () => {
    expect(isStripeAccountGoneError({ code: "resource_missing" })).toBe(true);
    expect(
      isStripeAccountGoneError(new Error("No such account: 'acct_123'")),
    ).toBe(true);
  });

  it("leaves every other error alone", () => {
    expect(isStripeAccountGoneError(new Error("Invalid session"))).toBe(false);
    expect(isStripeAccountGoneError(null)).toBe(false);
  });
});
