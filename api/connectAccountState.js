// Sprint 9: one mapping from a Stripe Accounts v2 object to the
// creator_payment_accounts mirror. Every writer uses it -- the settings-page
// sync, account-session onboarding, the v2 thin-event handler and the
// scheduled resync -- so they cannot disagree about what "ready" means.
//
// Ordering. Thin events are unversioned and can arrive late, twice, or out
// of order. The handler never trusts an event's payload for state: it
// re-reads the account from Stripe and stamps the write with
// stripe_state_observed_at (taken just before that read). The database
// trigger guard_creator_payment_account_state_order (20260924_139) keeps
// the newer observation when an older one arrives, so a replayed event can
// only ever write the account's current state, and a slow read cannot
// overwrite a faster, newer one. See docs/support/payments/connect-onboarding.md.

// Verified against Stripe's event type list (docs.stripe.com/api/v2/core/
// events/event-types, 2026-09-24). v2 events for connected accounts are
// delivered to a destination whose "Events from" is **Your account**, not
// "Connected accounts" (docs.stripe.com/connect/accounts-v2/migrate-integration).
export const CONNECT_ACCOUNT_RESYNC_EVENT_TYPES = new Set([
  "v2.core.account[requirements].updated",
  "v2.core.account[configuration.merchant].capability_status_updated",
  "v2.core.account[configuration.recipient].capability_status_updated",
  "v2.core.account.closed",
]);

// The include list every retrieve uses. Without configuration.* and
// requirements the v2 API omits them, and the mapping would read an
// account as not ready.
export const CONNECT_ACCOUNT_RETRIEVE_INCLUDE = [
  "configuration.merchant",
  "configuration.recipient",
  "identity",
  "requirements",
];

// Reads the v2 core Account shape (configuration.merchant / .recipient
// capability statuses, requirements) into the three flat booleans the rest
// of the app -- and has_ready_creator_payment_account in the database --
// already understand.
//
// card_payments / payouts status values observed live: "active" once
// requirements clear, "restricted" while they don't. details_submitted is
// derived from whether any requirement entries remain rather than from a
// specific status string, since Stripe support and the docs never named one
// meaning "fully clear" -- an empty entries list is unambiguous either way.
// A closed account is never ready, whatever its capabilities last said.
export const deriveCreatorPaymentAccountReadinessFromV2Account = (
  stripeAccount,
) => {
  if (stripeAccount?.closed === true) {
    return {
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    };
  }

  const cardPaymentsStatus =
    stripeAccount?.configuration?.merchant?.capabilities?.card_payments
      ?.status;

  const payoutsStatus =
    stripeAccount?.configuration?.recipient?.capabilities?.stripe_balance
      ?.payouts?.status;

  const requirementEntries = stripeAccount?.requirements?.entries;

  const detailsSubmitted =
    Array.isArray(requirementEntries) && requirementEntries.length === 0;

  return {
    chargesEnabled: cardPaymentsStatus === "active",
    payoutsEnabled: payoutsStatus === "active",
    detailsSubmitted,
  };
};

// Counts for CON-004 triage: how many requirements the creator (not Stripe)
// must act on now, and how many are already past due. Entries awaiting
// Stripe's own review are not the creator's to fix.
export const deriveCreatorRequirementCountsFromV2Account = (stripeAccount) => {
  const entries = stripeAccount?.requirements?.entries;

  if (!Array.isArray(entries)) {
    return { requirementsDueCount: 0, requirementsPastDueCount: 0 };
  }

  const userEntries = entries.filter(
    (entry) => entry?.awaiting_action_from !== "stripe",
  );

  const statusOf = (entry) => entry?.minimum_deadline?.status;

  return {
    requirementsDueCount: userEntries.filter(
      (entry) =>
        statusOf(entry) === "currently_due" || statusOf(entry) === "past_due",
    ).length,
    requirementsPastDueCount: userEntries.filter(
      (entry) => statusOf(entry) === "past_due",
    ).length,
  };
};

// Which kinds of tax id Stripe collected at onboarding (the types only,
// never the numbers) and the legal entity type. Whether that makes the
// creator "registered" for a given regime -- and so whether EU reverse
// charge applies -- is part of the Sprint 7 advice gate and is not derived
// here. NOT VERIFIED against a live v2 account's identity payload: read
// defensively, and store nothing if the shape is not what is expected.
export const deriveCreatorTaxStatusFromV2Account = (stripeAccount) => {
  const identity = stripeAccount?.identity;

  if (!identity || typeof identity !== "object") {
    return {};
  }

  const idNumbers = identity.business_details?.id_numbers;

  return {
    tax_entity_type:
      typeof identity.entity_type === "string" && identity.entity_type.trim()
        ? identity.entity_type.trim().slice(0, 50)
        : null,
    tax_id_types: Array.isArray(idNumbers)
      ? [
          ...new Set(
            idNumbers
              .map((entry) =>
                typeof entry?.type === "string" ? entry.type : null,
              )
              .filter(Boolean),
          ),
        ]
      : [],
  };
};

export const isCreatorPaymentAccountReady = (row) =>
  Boolean(
    row?.charges_enabled && row?.payouts_enabled && row?.details_submitted,
  );

// The single row patch. `observedAt` is when the Stripe read began (ISO
// string); the database refuses to let an older observation replace a newer
// one. `existing` is the current mirror row, if any, so the first
// completion time is kept rather than bumped on every sync.
export const buildCreatorPaymentAccountPatch = ({
  userId,
  stripeAccount,
  country,
  defaultCurrency,
  onboardingStartedAt,
  observedAt,
  existing = null,
}) => {
  if (!stripeAccount?.id) {
    throw new Error("Stripe account is missing an id.");
  }

  if (!observedAt || Number.isNaN(Date.parse(observedAt))) {
    throw new Error("A Stripe observation time is required.");
  }

  const { chargesEnabled, payoutsEnabled, detailsSubmitted } =
    deriveCreatorPaymentAccountReadinessFromV2Account(stripeAccount);

  const { requirementsDueCount, requirementsPastDueCount } =
    deriveCreatorRequirementCountsFromV2Account(stripeAccount);

  return {
    user_id: userId,
    provider: "stripe",
    stripe_account_id: stripeAccount.id,
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    details_submitted: detailsSubmitted,
    requirements_due_count: requirementsDueCount,
    requirements_past_due_count: requirementsPastDueCount,
    country,
    default_currency: defaultCurrency,
    onboarding_started_at:
      onboardingStartedAt ?? existing?.onboarding_started_at ?? null,
    onboarding_completed_at: detailsSubmitted
      ? existing?.onboarding_completed_at || observedAt
      : null,
    stripe_state_observed_at: observedAt,
    last_synced_at: observedAt,
    // Sprint 7 (launch-scope.md section 12.2): creator tax status. Only
    // written when Stripe returned the identity -- never cleared by a
    // response that simply did not include it.
    ...deriveCreatorTaxStatusFromV2Account(stripeAccount),
  };
};

// Decides what to do with a verified thin event notification. Returns
// { action: "resync", stripeAccountId } or { action: "ignore", reason }.
// Only the account id is taken from the notification; state always comes
// from a fresh read.
export const classifyConnectAccountEvent = (notification) => {
  const type = String(notification?.type || "");

  if (!CONNECT_ACCOUNT_RESYNC_EVENT_TYPES.has(type)) {
    return { action: "ignore", reason: `unhandled event type ${type || "(none)"}` };
  }

  const related = notification?.related_object;
  const stripeAccountId =
    related && related.type === "v2.core.account" && typeof related.id === "string"
      ? related.id
      : null;

  if (!stripeAccountId || !/^acct_[A-Za-z0-9]+$/.test(stripeAccountId)) {
    return { action: "ignore", reason: "no v2.core.account related object" };
  }

  return { action: "resync", stripeAccountId };
};

// Readiness moved from ready to not ready. The caller logs the CON-003
// signal; the hourly alert run reports it while the creator still has live
// listings.
export const didCreatorPaymentAccountLoseReadiness = (before, after) =>
  isCreatorPaymentAccountReady(before) && !isCreatorPaymentAccountReady(after);

// CON-009. The mirror row points at a Stripe account that Stripe no longer
// has (deleted in a sandbox, or removed from the platform). Nothing the
// creator can do in the form fixes that, so the routes say so plainly
// instead of passing on Stripe's "No such account".
export const CONNECT_ACCOUNT_GONE_MESSAGE =
  "Your Stripe payout account is closed, so setup can't continue here. Please contact support.";

export const isStripeAccountGoneError = (err) =>
  err?.code === "resource_missing" ||
  /No such account/i.test(String(err?.message || ""));

// Which mirror rows the scheduled resync reads this run: the stalest first,
// never-synced before anything else, skipping rows synced within
// `minAgeMs`, at most `limit`.
export const selectAccountsForResync = (
  rows,
  { now = Date.now(), minAgeMs = 6 * 60 * 60 * 1000, limit = 100 } = {},
) => {
  const syncedAt = (row) =>
    row?.last_synced_at ? Date.parse(row.last_synced_at) : Number.NEGATIVE_INFINITY;

  return (Array.isArray(rows) ? rows : [])
    .filter((row) => typeof row?.stripe_account_id === "string" && row.stripe_account_id)
    .filter((row) => now - syncedAt(row) >= minAgeMs)
    .sort((a, b) => syncedAt(a) - syncedAt(b))
    .slice(0, Math.max(0, limit));
};
