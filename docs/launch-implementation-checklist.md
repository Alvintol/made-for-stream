# Launch Implementation Checklist

The build order for [`launch-scope.md`](launch-scope.md). Ordered by dependency, not
by size: each sprint assumes the ones before it have landed. Sprint 7 is the
exception — its blocking item is external advice, so it starts in parallel.

Every item follows `AGENTS.md`: enforcement at the database and API rather than the
UI alone, the next free migration number taken from `supabase/migrations/`, and a
support playbook written or updated before the branch is ready.

**Baselines to hold** (measured 2026-09-26, after the Sprint 9 follow-ups):
**1041 tests passing, eslint clean, tsc clean, `npx vite build` clean** (the >500 kB
chunk-size warning predates Sprint 7). `AGENTS.md` still
records the older 740 / 21 errors / 19 lines — those were cleaned up since and
it is gitignored, so this file is the current reference.

---

## Sprint 0.5 — Stripe portal configuration

**Dashboard settings, not code.** Quick, free, and two of them decide numbers that
get published. Record each answer here as it is confirmed.

- [x] **Set the Connect pricing model to "Stripe handles pricing"** (§3.4). Stripe
      bills the connected account for processing; the platform incurs no account
      fee, no payout volume fee and no per-payout fee. This is the decision the fee
      structure now rests on — confirm it is actually applied, not just intended.
      *Confirmed 2026-09-22 directly with Stripe support (launch-scope.md §9.2):
      under Stripe-handles-pricing with Express + direct charges, the platform
      incurs none of the account/payout/tax-reporting fees. No live payments have
      run yet, so this was confirmed by asking support rather than reading an
      invoice that would show nothing either way.*
- [x] ~~Verify on a Stripe invoice that no CA$2 monthly active account line and no
      per-payout fees are being charged.~~ Superseded by the direct support
      confirmation above — there is no invoice data yet to read (no live traffic).
- [ ] Confirm the creator's connected account is being debited for the 2.9% +
      CA$0.30, which is what makes Fee Schedule §5 true as published.
- [ ] Check whether the platform qualifies for Stripe's **revenue share** under this
      model — it exists only here, and nothing in the plan has counted it.
- [ ] Record Stripe's minimum charge amount per currency we intend to enable, for
      the registry's `stripe_minimum_charge` column (Sprint 1).
- [ ] Confirm international card and currency conversion surcharges, and who bears
      them, before enabling a currency outside CAD/USD.
- [x] Register the Connect **webhook endpoint** against the production API origin
      once §11.1 is decided, and confirm the raw body reaches signature
      verification intact. *Done 2026-09-22 as part of §11.1 — see Sprint 3
      for what was built and verified live: classic `webhook_endpoints`
      (test mode, `connect: true`) pointed at the deployed Cloud Run origin,
      a real triggered event confirmed reaching it, and a manually-signed
      request confirming signature verification against the real secret.
      Live-mode registration is still open, deferred until `STRIPE_KEY_MODE`
      flips to `prod`.*

---

## Sprint 1 — The currency registry

> **Partly overtaken (2026-09-23).** The fee minimums were removed and rates
> resolved per user in `20260921_117`. Sprint 8's `20260923_138` added a first
> cut of `supported_currencies` (code, exponent fixed at 2, per-currency
> `minimum_instalment_minor_units`, enabled), enforced at agreement, schedule
> item and change order, and in the API. The payout-settings currency is now a
> picker. Still open: the exponent work (`* 100` in the bridge and
> `formatPaymentCents`), `amount_multiple`, `stripe_minimum_charge`,
> `supported_countries`, the country picker and foreign keys. The boxes below
> are left as they were.

Global availability rests entirely on this. Three places in the product assume a
currency has exactly 100 minor units, and until that assumption is gone, enabling a
new currency ships wrong money rather than a new market.

- [x] Migration: `supported_currencies` — **first cut in `20260923_138`**
      (code, `minor_unit_exponent` fixed at 2 by a check constraint,
      `minimum_instalment_minor_units`, `enabled`). Live 2026-09-26: 15
      two-decimal currencies, all enabled (CAD, USD and wave 2, decided
      2026-09-23). `amount_multiple` and `stripe_minimum_charge` are not in it:
      they only matter for zero- and three-decimal currencies (see the deferred
      box below).
- [ ] Migration: `supported_countries`, seeded from Stripe's Connect availability
      list, recording which capabilities each supports.
- [x] ~~Rates from the resolver instead of `500`~~ — done in `20260921_117`
      (live, verified 2026-09-26). **The exponent half is deferred** with the
      zero-/three-decimal work below: the registry's check constraint pins every
      enabled currency to exponent 2, so `* 100` is correct for all of them.
- [ ] *(Deferred, see above.)* Rewrite `ensure_listing_request_payment_for_schedule_item` to take the
      exponent from the registry instead of `* 100`. In CAD and USD the result must be
      **byte-identical** to today for any base at or above 30.00 — below that the
      dropped minimums legitimately change it, and those cases get their own
      expectations.
- [x] **Remove both fee minimums.** *Done in `20260921_117`; the live bridge
      has no `max(...)`/`greatest(...)` (verified 2026-09-26).* 5% flat on each side, no `max(...)` (§3.1).
      Model A removed the cost they offset. No `creator_fee_minimum_consumption`
      table, no monthly period, no first-of-month branch — this subsystem is gone
      before it is built.
- [x] **Resolve both rates per user rather than as literals** *(`resolve_listing_request_fee_rates`, `20260921_117`, live)* (§3.5, §3.6). One
      shared resolver, returning 500 bps for everyone today, so a future buyer or
      creator subscription is a data change rather than a trigger rewrite.
- [x] Record the **reason** each rate applied *(`*_fee_reason` columns on agreements and payments, `20260921_117`, live)* — standard, subscription,
      promotional, goodwill — on the payment alongside the rate. A `0` with no
      explanation is indistinguishable from a bug.
- [x] **Lock the resolved rate at agreement acceptance as a ceiling** *(`lock_listing_request_agreement_fee_rates`, `20260921_117`, live)*: a later
      waiver may lower it, nothing may raise it (§3.5). This is what stops a lapsed
      subscription silently repricing an accepted schedule, which Fee Schedule §8
      forbids.
- [x] *(Covered by `listingRequestAgreements.test.ts`, `listingRequestPaymentDisplay.test.ts` and `ListingRequestPaymentCheckoutFees.test.tsx`.)* Tests: a waived buyer rate produces a zero fee and a recorded reason; a lapsed
      waiver does not raise an accepted schedule's rate; a mid-project waiver lowers
      later instalments only; refunds of a zero-fee payment return zero fee.
- [ ] *(Deferred until a zero- or three-decimal currency is wanted, e.g. JPY, KWD.)* Apply `amount_multiple` rounding for three-decimal currencies.
- [x] *Done in `20260923_138` as a **10.00 floor in every currency** (Sprint 8 decision), enforced at the database with a plain-language message.* Enforce the registry's `minimum_instalment` (5.00 in CAD/USD) before a
      payment row is created. Under Model A this protects the **creator** from
      Stripe's flat 0.30 rather than the platform from a loss (§3.1). Give it a
      clear message rather than `PAY-004`'s generic failure.
- [ ] *(Deferred with the zero-/three-decimal work.)* Fix `formatPaymentCents` (`src/domain/payments/listingRequestPaymentDisplay.ts`)
      to divide by the registry exponent, not by 100. Extend
      `src/lib/formatMoney.ts` the same way.
- [ ] *(Deferred.)* Tests: JPY (exponent 0), KWD (exponent 3, multiple of 10), and a CAD/USD
      regression set proving nothing moved.
- [x] ~~`POST /api/stripe/connect/start` validates country and currency~~ —
      the route was removed (2026-09-22). Its replacement,
      `POST /api/stripe/connect/account-session`, refuses unsupported currencies
      (`20260923_138`). Country is still format-checked only, until
      `supported_countries` exists.
- [x] Currency: a picker driven by `SUPPORTED_CURRENCY_CODES` (Sprint 8).
- [x] Country: a dropdown since 2026-10-05, from a 35-country list in code
      (`api/supportedCountries.js`, mirrored in the web app, kept in step by a
      test) and refused by the API otherwise. Choosing a country sets its
      currency. No `supported_countries` table: a code list covers it until the
      list needs editing without a deploy. **Confirm the list against Stripe's
      Dashboard before launch.**
- [ ] Migration: foreign keys from `creator_payment_accounts.country` /
      `.default_currency` and from the agreement, schedule item and payment currency
      columns to the registry.
- [ ] Audit existing rows for values outside the registry before the keys land.
- [x] *(Done in Sprint 8: `PAY-004`, `CON-005`, `AGR-005`/`AGR-006`.)* Playbook: update `payments/connect-onboarding.md` and `payments/checkout.md`.
      `PAY-004`'s "Note for non-USD work" becomes a description of the registry.
- [x] *(Started: `api/tests/` covers `tax.js`, `refundArithmetic.js`, `policyAcceptanceGuard.js`, `connectAccountState.js` and `opsAlerts.js`. The route handlers themselves are still untested; that stays in the carried list.)* First server-side tests for `api/server.js` start here — registry validation is
      a pure function and a good place to begin closing that gap.

**Done:**

- [x] Migration: exempt `is_free` listings from
      `enforce_listing_payment_account_readiness`, and make the trigger watch
      `is_free` so a free listing flipped to paid is still checked. Playbook and UI
      guard updated with it. *(#104)* **Correction 2026-09-26:** the migration
      (`116`) was never applied live; `20260926_140` applies it. See Sprint 9
      follow-ups.

---

## Sprint 2 — Currency wave 2 and global onboarding

- [ ] Open creator onboarding to every country in the registry.
- [x] ~~One at a time~~ — **all wave 2 two-decimal currencies were enabled
      together** (decision 2026-09-23). The end-to-end check is the rehearsal's
      EUR run (Sprint 8), which is still to do.
- [ ] Record which currencies have actually been run end to end (starts with the
      rehearsal's CAD, USD and EUR).
- [x] ~~Per-currency minimums reviewed for purchasing power~~ — superseded:
      fee minimums were removed (`117`) and the instalment floor is a flat 10.00
      in every currency (Sprint 8 decision).
- [x] *(Fee Schedule §1 lists the enabled currencies, Sprint 8.)* Publish the enabled currency list and its minimums in the fee schedule — §1 of
      that schedule already requires this before a currency may be enabled.
- [ ] Creator-facing currency picker limited to what their account country can
      settle.
- [ ] *(Merged into the "record which currencies have been run" box above.)* Playbook: record the per-currency validation status somewhere durable, so
      "has this currency actually been run end to end" has an answer.

---

## Sprint 3 — Payment integrity, payout hold and the charge handle

**Integrity first (§11).** None of the rules in the scope document are safe until
these hold, and two of them were verified directly against the code.

- [x] `POST /api/stripe/checkout/session` verifies acceptance of the current policy
      versions before opening a session, on every call including a reused session.
      `api/policyVersions.js` mirrors `checkoutPolicyTypes` /
      `currentPolicyVersions` by hand — the two packages share no build step — with
      `src/domain/tests/checkoutPolicyVersionsSync.test.ts` failing loudly if they
      drift. `api/policyAcceptanceGuard.js` holds the pure missing-policy logic and
      is the first server-side test coverage in `api/`.
- [x] Recompute the base, fees and recipient server-side from authoritative rows,
      rather than trusting the stored ledger values.
      `recompute_listing_request_payment_amounts(payment_id)`
      (`supabase/migrations/20260922_120_recompute_payment_amounts_at_checkout.sql`)
      mirrors `ensure_listing_request_payment_for_schedule_item`'s arithmetic,
      called from `POST /api/stripe/checkout/session` before Checkout opens.
      Self-heals drift on a `requires_checkout`/`checkout_opened` payment
      (clearing a stale open session's id if one existed), raises on a
      recipient mismatch, no-ops for `one_time`/settled payments. Verified live
      via `apply_migration` + `begin; ... rollback;`: corrupted amounts healed
      back to the schedule item's true value, a stale `checkout_opened` session
      was cleared, a payer/creator mismatch raised. The currency-registry and
      monthly-minimum recomputation this item originally named doesn't apply
      yet — neither exists (Sprint 1/2); this closes the gap that exists today.
- [x] Restrict the `admin_confirm_*_payment` RPCs — kept, not removed (removing
      would delete a working, tested admin UI built for a real reconciliation
      need). All four now refuse if `listing_request_payments` already has a
      `paid`/`refunded`/`partially_refunded`/`disputed` row for the schedule item
      they'd confirm, closing the exact "leave a schedule satisfied against a
      refunded payment" danger this item names. Each now also posts a system
      message that explicitly says the confirmation was manual and bypassed
      Stripe — the "labelled as break-glass" half — instead of reading like an
      ordinary automated confirmation.
      (`supabase/migrations/20260922_121_restrict_admin_confirm_payment_rpcs.sql`)
      **Found and fixed in the same migration:** the milestone-payment RPC
      (`admin_confirm_listing_request_milestone_payment`, 20260618_101) called
      `public.is_admin()`, which has never existed in this database — confirmed
      via `pg_proc`/`pg_namespace`. Every call to it has failed with "function
      public.is_admin() does not exist" since it was created; it has never
      worked. Fixed to call the real function, `public.is_admin_user(uuid)`
      (20260429_032). Verified live in a `begin; ... rollback;` transaction:
      the new guard correctly refuses against a `paid` row, and a clean
      confirmation now runs end to end (it previously could not have, at all).
- [x] Handle out-of-order and duplicate webhook delivery explicitly.
      **Duplicate delivery** of the same Stripe event id was already handled
      (`recordStripeWebhookEventStart`'s `stripe_event_ids` dedup) and remains so.
      **Out-of-order delivery** across different event types: audited every
      status-writing handler — `markListingRequestPaymentProcessingFromCheckoutSession`,
      `markListingRequestPaymentPaidFromCheckoutSession`,
      `markListingRequestPaymentCancelledFromCheckoutSession`,
      `markListingRequestPaymentFailedFromPaymentIntent` — all already guard
      `if (payment.status === "paid") return` (or an equivalent check) before
      writing, so a late-arriving `checkout.session.expired` or
      `payment_intent.payment_failed` cannot regress an already-paid payment
      regardless of arrival order. The one real gap was `charge.refunded` /
      `charge.dispute.*`, previously not handled at all; the new handlers
      added for charge traceability (above) are themselves designed to be
      order-safe — charge-id-first lookup with a metadata fallback specifically
      so a refund event arriving *before* `checkout.session.completed` still
      finds the right payment, and neither ever writes `status`. Live re-fetch
      of the PaymentIntent for the charge/application-fee ids (rather than
      trusting the webhook payload) is the "reconcile against current Stripe
      object state" half for the one thing the payload doesn't carry; the
      `payment_status` field itself is not re-fetched, since Stripe's own
      guidance treats that field on `checkout.session.completed` as
      authoritative as delivered.
- [x] Decide where `api/server.js` runs in production (§11.1). **Decided
      2026-09-22: Docker, on Google Cloud Run.** Static hosting does not run
      Express, and the Connect webhook needs a real HTTPS origin preserving
      the **raw body** for signature verification.
      **Platform choice, re-verified this session against current terms
      rather than trusting an earlier draft's recommendation:** Fly.io's free
      tier is gone (credit card required, ~$2-15+/month per always-on
      machine); Railway disabled autoscaling entirely in May 2026, which
      rules it out against "must not go down under volume." Cloud Run has a
      real perpetual free tier (2M requests + 360K vCPU-seconds/month),
      deploys straight from a Dockerfile, and autoscales both up (under load)
      and to zero (idle) natively — confirmed with the user before treating
      this as decided.
      **Built:** `api/Dockerfile` (multi-stage, `node:24-alpine`, non-root
      `node` user, `npm ci --omit=dev`, container `HEALTHCHECK` against
      `GET /api/health`) and `api/.dockerignore` (excludes `.env` — production
      config comes entirely from Cloud Run's env vars / Secret Manager,
      `dotenv.config()` only fills values not already in `process.env`, so no
      code change was needed for that part).
      **CORS fixed in the same pass** (was a real limitation, not just a
      Docker concern): `api/server.js` now reads a comma-separated
      `APP_ORIGINS` env var, falling back to the single `APP_ORIGIN` value for
      backward compatibility — adding a new allowed frontend origin (www +
      apex, staging, a preview deploy) is now a platform env-var change, not a
      code deploy. Origin-validation logic is unchanged (still rejects
      anything not in the list).
      **Verified live, locally (not yet against the deployed Cloud Run
      origin — that step is the user's, see below):** ran `api/server.js`
      directly (Docker isn't available in this session) on a throwaway port
      with `APP_ORIGINS` set to two production-shaped origins — confirmed
      both are allowed, `localhost:5173` still works, and an arbitrary origin
      is rejected. Ran `stripe listen --forward-to` against the same running
      process and `stripe trigger checkout.session.completed` — confirmed
      Stripe's real signature verification and raw-body handling succeed
      end to end through this exact code path (several event types returned
      200; `checkout.session.completed` returned 400 only because the
      fixture event carries no real Made for Stream payment id, which is
      expected for a synthetic trigger, not a webhook/signature failure).
      `npx vitest run` (861 tests), `npx tsc --noEmit`, `npx eslint .`,
      `npx vite build` all still pass — confirmed after this change even
      though it's `api/`-only.
      **Deployed and verified live, same session, once the user had a
      working `gcloud` on their machine.** Service:
      `made-for-stream-api` on Cloud Run, region `us-central1`, URL
      `https://made-for-stream-api-422533033771.us-central1.run.app`.
      Verified directly (not "should work"): `GET /api/health` returns
      `{"ok":true,...}`; CORS allows the two configured `APP_ORIGINS` values
      and rejects an arbitrary origin; `/api/stripe/config` confirms the
      Stripe secret key and webhook secret loaded correctly from Secret
      Manager. **Webhook delivery proven two ways:** a real Stripe-triggered
      `checkout.session.completed` event on a live connected test account
      reached `/api/stripe/webhook` (confirmed via Cloud Run request logs —
      `pending_webhooks: 1` on the Stripe event, then a `POST 400` in the
      logs); and a manually HMAC-signed request against the real
      `STRIPE_WEBHOOK_SECRET_DEV` value returned the exact expected
      application error (`"Stripe checkout session is missing Made for
      Stream payment metadata."`) rather than a signature failure —
      proving raw-body preservation and signature verification both work
      correctly through Cloud Run, and that the 400s seen from Stripe's own
      triggered fixture events are the *correct* rejection of a synthetic
      event with no real payment id, not a delivery or verification defect.
      **The webhook endpoint that's actually live is a classic
      `webhook_endpoints` object** (`stripe webhook_endpoints create
      --connect=true`) — see `docs/support/payments/webhooks.md` for why:
      Stripe's newer "Event destinations" UI looked correctly configured but
      never routed a single event (`pending_webhooks: 0` on every trigger),
      a real platform quirk worth knowing about before anyone tries that UI
      again.
      **Sprint 0.5's "register the Connect webhook endpoint" item is
      satisfied by this** — see that line below.
      **Still open:** only a live-mode (`STRIPE_WEBHOOK_SECRET_PROD`)
      webhook endpoint, for whenever `STRIPE_KEY_MODE` flips to `prod` — the
      secret exists in Secret Manager as a placeholder, ready for that
      switch. The stale, non-functional "Event destinations" entry in the
      Stripe Dashboard was left in place rather than deleted (an account
      change outside this session's scope) — worth removing to avoid
      confusion later.
- [x] **Resolved, and it required a real code migration, not a config
      change.** `controller.fees.payer` on Express accounts (§3.2): confirmed
      live against Stripe's real API (2026-09-22) that Express accounts
      *require* `fees.payer: "application"` — no per-account override exists.
      Root cause found: `api/server.js` was still creating **Accounts v1**
      (`type: "express"`) accounts, while this platform's own Connect
      settings were already configured for **Accounts v2**
      (`fees_collector`/`losses_collector: "stripe"`, `dashboard: "none"`).
      Migrated `getOrCreateStripeAccountForEmbeddedConnect` to
      `stripeClient.v2.core.accounts.create()` matching those settings exactly,
      added `getSupabaseUserEmail` (v2 requires `contact_email` once a
      `recipient` configuration/payouts capability is requested),
      `deriveCreatorPaymentAccountReadinessFromV2Account` (maps v2 capability
      statuses onto the existing `charges_enabled`/`payouts_enabled`/
      `details_submitted` booleans so the DB, the readiness trigger and the
      frontend need zero changes), and updated `/api/stripe/connect/sync` to
      retrieve via v2. Removed the dead v1-only `/api/stripe/connect/start`
      route and its exclusively-used helpers (`createStripeConnectAccount`,
      `getStripeConnectAccountLink`, plus now-unused
      `STRIPE_CONNECT_RETURN_URL`/`STRIPE_CONNECT_REFRESH_URL`). Verified
      live end to end against Stripe's test API before trusting any of it:
      v2 account creation with the platform's exact config, capability-status
      reads, and — the one that mattered most — that a **direct charge with
      `application_fee_amount` still works unchanged** against a v2 account
      via the same `Stripe-Account` header pattern already used everywhere
      else. Also verified the existing embedded-components `accountSessions.create`
      call (what the onboarding UI actually uses) works unmodified against a
      v2 account, so **no frontend changes were needed**. 861 tests still
      passing, tsc/eslint clean. See §3.2, §9.1, §9.2 for the account.
      **One real cost, not free:** the 14-day payout hold (§6.3) does not
      survive this migration at the guaranteed figure originally decided —
      see that item below.
- [x] Idempotently reserve a schedule item against concurrent checkout attempts.
      Already satisfied, not newly built: `20260905_110` created
      `listing_request_payments_payment_schedule_item_idx`, a unique index on
      `payment_schedule_item_id` where not null, specifically so
      `ensure_listing_request_payment_for_schedule_item`'s `on conflict do
      nothing` + re-select has a real conflict target. Confirmed live via
      `pg_indexes` that the index still exists and is unique. No new migration
      needed for this item.

Two prerequisites for refunds. The hold keeps the money available so most refunds
never need platform funding; the charge handle is what a refund is issued against.

**Payout hold (§6.3)**

- [x] **Superseded by the v1→v2 migration above — the mechanism changed
      entirely, not just the account-creation path.** For v2 accounts, payout
      scheduling is not part of account creation; it's a separate Balance
      Settings resource (`stripeClient.balanceSettings.update(...)`, called
      per-account via the `Stripe-Account` header). New helper
      `setStripeConnectDailyPayoutSchedule` sets `interval: "daily"`
      immediately after account creation in
      `getOrCreateStripeAccountForEmbeddedConnect`. **`delay_days` is not set
      to 14 and cannot be** — confirmed live that
      `settlement_timing.delay_days_override` is rejected outright while
      `losses_collector` is `"stripe"` (the platform doesn't own liability),
      which is the configuration kept per the user's explicit 2026-09-22
      decision (lower platform risk over payout-timing control). The delay
      stays at whatever Stripe assigns — confirmed 7 days on a Canadian test
      account, unconfirmed in live mode or for other countries. §6.3 has the
      full account; §3.1/§3.3/§3.4's dollar figures are unaffected (this only
      changes payout *timing*, not fee economics).
- [ ] **Follow-up, still open:** confirm the real live-mode delay (Stripe's
      default may differ from the 7-day test-mode figure observed), and decide
      whether it's acceptable to publish in the fee schedule as-is or whether
      it needs monitoring per country as currency waves expand (§1.3).
- [x] *(Resolved: `creator_payment_accounts` has no rows as of 2026-09-26, so the old v1 account is gone.)* **Follow-up:** one existing connected account
      (`creator_payment_accounts`, `charges_enabled = false`) predates this
      session's fixes entirely (created under the old v1 path with no
      schedule at all) and was not migrated to a v2 account or re-synced. It
      should be re-onboarded or explicitly retired once its Stripe mode
      (test/live) is confirmed — not mutated automatically here.

**Charge traceability**

- [x] Populate `stripe_charge_id` and `stripe_application_fee_id` on the paid path in
      `markListingRequestPaymentPaidFromCheckoutSession`, through the same
      cross-checks the webhook already runs. Fetched live from the PaymentIntent's
      expanded `latest_charge` (`getChargeDetailsFromPaymentIntent`) since neither
      id is present on the Checkout Session or PaymentIntent webhook payload
      itself. Self-heals via `backfillChargeDetailsForPayment` when a `paid`
      payment missing its charge id is retried through the "downstream workflow
      failed" branch.
- [x] *(Not needed: zero `paid` rows, and the fixed code has been live since the 2026-09-26 deploy, so no payment can land under the pre-fix code.)* **Bulk-backfill both columns for existing `paid` rows from Stripe.** Not run
      in this session — there are zero `paid` rows as of 2026-09-22 (no live
      traffic), so there is nothing to backfill yet. Write and run this before the
      first real payment lands under the pre-fix code, not after
      (docs/support/payments/refunds-and-disputes.md Known gaps).
- [x] Handle `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`
      in `processStripeWebhookEvent` — recording them against the payment
      (`stripe_refund_id`/`refunded_at`, `stripe_dispute_id`/`disputed_at`) and
      reusing the `stripe_event_ids` idempotency pattern. No status writes, as
      specified — `status` still requires the Sprint 5 refund ledger to derive
      correctly. Lookup is charge-id-first with a metadata fallback specifically
      so a `charge.refunded` arriving before `checkout.session.completed` (Stripe
      does not guarantee order) still finds the right payment.
- [x] Admin surface listing disputes and out-of-band refunds, replacing the manual
      query in `REF-002`/`REF-003`. New page `/admin/payment-issues`
      (`src/pages/admin/AdminPaymentIssues.tsx`, hook
      `src/hooks/admin/useAdminPaymentIssues.ts`), linked from the admin
      dashboard and routed in `App.tsx` inside the existing
      `RequireAdminAccess` block — no new RLS needed, the existing "listing
      request payments participants read" policy already grants admins
      (`admin_roles` membership) `SELECT` on every row. Filters by
      disputed/refunded/all, and explicitly calls out per-row when `status`
      still reads `paid` despite a recorded refund or dispute, since that
      divergence is the actual thing this page exists to surface. Tests added
      (`src/pages/tests/AdminPaymentIssues.test.tsx`).
- [x] Playbook: rewrite `payments/refunds-and-disputes.md` — `REF-002` and `REF-003`
      lose their "no trace but an ignored row" framing; they now query the payment
      row's own new columns. A new gap replaces it: `status` still says `paid`
      after a recorded refund or dispute, and that divergence is what's now
      documented as the operational risk.

---

## Sprint 4 — Cancellation

- [x] Migration: add `cancelled` to `listing_requests_status_check`, with
      `cancelled_at`, `cancelled_by_user_id` and `cancellation_reason`, plus the
      metadata check constraint matching the `completed` pattern in `20260611_093`.
      Built in `20260922_122`. Also closes the conversation on cancellation using
      `20260611_094`'s exact pattern (`closed_reason_code = 'not_moving_forward'`).
- [x] `security definer` RPC `cancel_listing_request_before_payment` — the
      unilateral pre-payment path (§5.1). Writes the `cancelled` status that already
      exists on agreements, schedule items, milestones, change orders and final
      deliveries. Built in `20260922_122`; scoped to `accepted` requests with no
      payment in `paid`/`processing`/`refunded`/`partially_refunded`/`disputed`.
- [x] Expire any open Stripe checkout session for payments the cancellation moves to
      `cancelled`. Built as `POST /api/stripe/checkout/expire-cancelled-sessions` in
      `api/server.js` (re-derives sessions to expire from the database rather than
      trusting the client; called by both cancellation hooks; best-effort). See
      `docs/support/requests/cancellation.md` `CAN-005` for the residual race this
      does not fully close (a stale session completed before the expire call lands).
- [x] Migration + RPCs for the post-payment cancellation proposal (§5.2): propose
      with a per-milestone earned-value statement, accept, dispute. Built in
      `20260922_124` — `propose_listing_request_cancellation`,
      `submit_listing_request_cancellation_statement`,
      `respond_listing_request_cancellation_proposal`, plus
      `listing_request_cancellation_proposals` /
      `_proposal_items` tables. The creator's itemised statement is the one binding
      figure acceptance acts on (must cover every paid payment on the request);
      on acceptance, unearned amounts are written to
      `listing_request_cancellation_proposal_items.flagged_for_refund_at` for
      Sprint 5's refund engine to consume — **no refund is issued by this sprint**.
      A dispute is the Tier 2 support-queue signal itself (`status = 'disputed'`),
      following `REF-001`'s no-separate-queue-table pattern; there is no admin
      resolution UI yet (known gap, tracked in `cancellation.md`).
- [x] The three-business-day itemised cancellation statement deadline is recorded and
      visible to both parties. `statement_due_at = public.add_business_days(now(), 3)`,
      set at proposal creation; shown in the "Next step" card and the cancellation
      proposal panel.
- [x] Workspace UI: cancellation entry points, the proposal and response screens, and
      the "Next step" card understanding a cancelled request. Built:
      `ListingRequestCancelBeforePaymentAction` and
      `ListingRequestCancellationProposalPanel` components, wired into
      `BuyerRequestDetails.tsx` and `CreatorRequestDetails.tsx` (both directions —
      either party can open either flow); `AdminRequestDetails.tsx` gets read-only
      visibility only, since admins cannot call these RPCs.
      `src/domain/listings/requestWorkspace.ts` gained a `cancellationProposal`
      input and next-step branches for `cancelled`, `disputed`,
      `pending_creator_statement` and `pending_buyer_response`, all taking priority
      over the ordinary workflow steps.
- [x] Migration: add structured `usage_rights` to the agreement (§5.3), snapshotted
      at acceptance. Built in `20260922_123` — `usage_rights_type` (enumerated,
      nullable) and `usage_rights_qualifier` (free text). **Schema only**:
      `create_listing_request_agreement` was not extended to accept or write these
      columns, and no UI sets them, so every agreement's usage rights are `null`
      today. Tracked as a known gap in `docs/support/requests/agreements.md` — the
      agreement builder needs a follow-up pass before this is real.
- [x] Migration: make `included_revision_count` nullable and apply the two-round
      fallback when null (§5.4). Built in `20260922_123` (data untouched — an
      existing `0` stays `0`, not reinterpreted). The fallback itself is
      `getListingRequestIncludedRevisionCount` in
      `src/domain/listings/listingRequestAgreements.ts`, used by
      `ListingRequestAgreementSummary.tsx`. The agreement builder still always
      writes a number today (no UI path to leave it blank), so `null` is reachable
      in the schema but not yet in practice through the product's own UI.
- [x] Playbook: new `requests/cancellation.md`; update `requests/request-lifecycle.md`
      (lost its "no cancellation workflow" gap, gained a cross-reference) and
      `requests/agreements.md` (fee-rate-locking section's neighbor now covers the
      `cancelled` status becoming reachable and both new schema gaps, with their
      real limitations spelled out above rather than assumed complete).

**Verified:** `npx vitest run` (880 passing, up from 861 — no regressions),
`npx tsc --noEmit` (clean), `npx eslint .` (clean), `npx vite build` (clean),
`node --check api/server.js` (clean). New coverage: hook tests for
`useCancelListingRequestBeforePayment`, `useProposeListingRequestCancellation`,
`useRespondListingRequestCancellationProposal`; a component test for
`ListingRequestCancelBeforePaymentAction`; domain tests for the new `cancelled`
status, the `cancellationProposal`-aware next-step branches, and the
revision-count fallback. **Not verified by this pass**: the SQL migrations
were not applied against a live Supabase project (no project access in this
session) — read carefully before applying, particularly the `for update` row
locking and the constraint interactions in `20260922_124`.

---

## Sprint 5 — Refunds, tips and creator recovery balances

Depends on Sprint 3 for the payout hold and charge handle, and Sprint 4 for what a
refund does to the project.

Three things ship together here on purpose. The recovery mechanism is what makes a
platform-funded refund safe to offer. Tips ship **with** refunds rather than before
them, because a contribution we cannot refund correctly is worse than no
contribution at all.

**Refund execution**

- [x] Migration: an **immutable refund ledger** —
      `listing_request_payment_refunds`, one row per Stripe refund with its
      base/buyer-fee/creator-fee/tip/contribution amounts, actor, reason,
      `initiated_via` and timestamp. Built in `20260922_125`.
- [x] Derive `partially_refunded` and `refunded` from the sum of settled refunds
      rather than writing them directly. `derive_listing_request_payment_refund_status`
      (`20260922_125`), called from inside `apply_refunded_listing_request_payment`
      in the same transaction as the ledger insert.
- [x] `security definer` RPC `apply_refunded_listing_request_payment`
      (`20260922_125`), following the `apply_paid_listing_request_*` shape —
      idempotent on `stripe_refund_id`, writes the ledger row, derives status,
      cascades the request, and closes Sprint 4's loop by setting
      `refunded_at` on any covered `listing_request_cancellation_proposal_items` row.
- [x] Proportional cumulative fee arithmetic per §6.2, mirrored in two places for
      testability (the SQL function is the source of truth; `api/refundArithmetic.js`
      is what the admin route uses before calling Stripe, and
      `src/domain/payments/listingRequestPaymentRefunds.ts` is what the admin UI
      preview uses) — both have vitest coverage of repeated partial refunds and the
      final rounding remainder (`api/tests/refundArithmetic.test.js`,
      `src/domain/tests/listingRequestPaymentRefunds.test.ts`).
- [x] Admin-only refund route: `POST /api/stripe/refunds`
      (`src/components/listingRequests/payments/ListingRequestPaymentAdminRefundPanel.tsx`
      on `/admin/requests/:id`, not `/admin/payment-issues` — that page only lists
      payments with an *existing* dispute or refund). **Deviates from the literal
      "refund_application_fee: true" wording** in favour of two explicit calls
      (`stripe.refunds.create` for the buyer's share, then the Application Fee
      Refunds API for the creator-fee/contribution reversal) — see the comment
      above the route for why: `refund_application_fee`'s automatic ratio is based
      on the whole charge amount, not the base amount §6.2's cumulative arithmetic
      needs exact control over.
- [x] Cascade the request per §6.7, via one unified rule rather than one branch per
      table row (see the comment in `apply_refunded_listing_request_payment`):
      a milestone payment being refunded at all cancels that milestone, and the
      request is cancelled once no payment on it remains `paid`/`partially_refunded`,
      unless already `completed`.
- [x] `charge.refunded` webhook branch now calls `apply_refunded_listing_request_payment`
      (`initiated_via = 'webhook_external'`) instead of only recording a pointer, so a
      refund issued directly in Stripe reconciles. Its base/fee split is a
      best-effort attribution (the whole refund amount, since there is no stored
      intent to split against) — documented in `refunds-and-disputes.md`.

**Tips and platform contributions (§4)**

- [x] Tip and contribution controls on the checkout page
      (`ListingRequestPaymentCheckout.tsx`), both defaulting to empty/zero and
      gating the policy-acceptance step (and therefore Stripe Checkout) behind an
      explicit "Continue to payment" click.
- [x] `set_listing_request_payment_tip_and_support` RPC (`20260922_126`) writes the
      amounts and recomputes `total_checkout_cents`/`application_fee_cents` in the
      same statement. No separate "reissue" API route was needed: the existing
      `POST /api/stripe/checkout/session` already calls
      `recompute_listing_request_payment_amounts` (20260922_120, which turned out to
      already preserve stored tip/support rather than zeroing them) before every
      session creation, and its idempotency key is keyed on `updated_at`, which the
      new RPC bumps — verified the RPC also resets `checkout_opened` back to
      `requires_checkout` and clears the stale session id when the amount changes
      after a session was already opened, the same self-heal
      `recompute_listing_request_payment_amounts` does for drift.
- [x] Confirmed the schema's existing check constraints hold: a tip raises the total
      but not the application fee; a contribution raises both. Unchanged — the RPC
      computes both sides itself rather than trusting the constraint alone.
- [x] Tips and contributions do not consume or count toward any fee minimum —
      §3.1 already removed the fee minimum entirely, and tips/contributions were
      never part of the buyer/creator fee bps calculation to begin with.
- [x] A tip falls under the payout hold as creator money (it was already part of
      the connected account's balance, untouched by any Sprint 5 change); a
      contribution is part of `application_fee_cents` and therefore reaches the
      platform immediately, same as before.
- [x] Contribution refunds per Refund Policy §8, built into the same refund ledger
      rather than a separate table: `apply_refunded_listing_request_payment` never
      auto-prorates `p_tip_refund_cents`/`p_contribution_refund_cents` on a partial
      base refund, and enforces the 14-day-from-payment-or-cancellation window
      (with a mistaken/duplicate/unauthorised override) only when the refund is
      *not* a full-cancellation-style one. Window logic has its own tests in both
      mirrors (`isTipOrContributionRefundWithinWindow` in
      `listingRequestPaymentRefunds.test.ts`).

**Platform-funded refunds (§6.5)**

- [x] Migration: `creator_recovery_balances` and `creator_recovery_entries`
      (`20260922_127`) — one debit when the platform funds a refund shortfall, one
      credit per recovery (diversion, direct settlement, or write-off), all through
      `apply_creator_recovery_debit`/`apply_creator_recovery_credit`.
- [x] Refund path takes from the held balance first, automatically: before
      calling `stripe.refunds.create`, `issueListingRequestPaymentRefund`
      checks the connected account's own available balance
      (`stripe.balance.retrieve`) for the refund's currency. While the hold
      is in effect there is normally enough available balance, so no top-up
      happens. Once it is genuinely insufficient, the platform tops up the
      account by exactly the shortfall (`stripe.transfers.create`) before
      issuing the refund, then opens a recovery balance
      (`apply_creator_recovery_debit`) for that same shortfall amount — never
      the whole refund. This is the one path in this sprint that could not be
      exercised against a real Stripe test-mode charge (see "Verified" below).
- [x] Outstanding-balance check added to the `listing requests buyer insert` RLS
      policy (`20260922_128`), via a shared boolean function
      (`creator_has_outstanding_recovery_balance`) the buyer-facing UI also calls,
      so the two can never disagree about whether a request would be blocked.
- [x] Listing/request UI (`RequestListing.tsx`) shows a plain "Requests are paused
      for this creator" message without exposing the balance.
- [x] Recovery on subsequent payments: `resolve_listing_request_payment_recovery_instalment`
      (`20260922_129`), folded into `application_fee_cents` in both
      `ensure_listing_request_payment_for_schedule_item` and
      `recompute_listing_request_payment_amounts` so the two can't diverge, capped at
      `least(50% of base, outstanding balance)`. Applied to the balance once the
      payment is marked paid (`apply_listing_request_payment_recovery_instalment`,
      idempotent via `recovery_instalment_applied_at`).
- [x] Creator settings (`CreatorRecoveryBalanceSection.tsx` in
      `CreatorPayoutSettings.tsx`): balance visible, entry history, and a direct
      settlement path — a plain (non-Connect) Stripe Checkout session on the
      platform's own account (`POST /api/stripe/recovery/settlement-session`,
      `creator_recovery_settlement_payments` table, `20260922_130`).
- [x] Automatic release — `apply_creator_recovery_credit` floors `outstanding_cents`
      at zero with no separate status column, so the RLS block lifts the moment it
      reaches zero with no admin action.
- [x] Admin write-off action (`admin_write_off_creator_recovery_balance`, callable
      from `/admin/requests/:id`'s `CreatorRecoveryBalanceAdminPanel.tsx`).
- [x] Tests: the cap and partial-recovery-across-several-payments logic is mirrored
      in `src/domain/payments/creatorRecoveryBalance.ts`
      (`resolveRecoveryInstalmentCents`) with its own suite
      (`creatorRecoveryBalance.test.ts`) covering the 50% cap, a balance recovered
      across three payments, and release at zero. The SQL functions themselves have
      no automated test (no live-database test harness exists in this repo — see
      Baselines note) and were only inspected, not applied or run.
- [x] Creator Terms §4 and Fee Schedule §5 disclose the recovery mechanism
      (concrete: blocked new requests, 50% diversion cap, direct settlement, admin
      write-off) before a creator can incur one. Both documents' versions bumped
      (`2026-09-22-draft-1`) with fingerprints recorded in
      `policyVersionIntegrity.test.ts`; `api/policyVersions.js`'s
      `payment_terms` entry bumped to match, per that file's own
      keep-in-sync-by-hand warning.
- [x] Playbooks: `payments/refunds-and-disputes.md` rewritten — `REF-001`/`REF-002`
      have real resolutions, `status: partial` → `active`. New
      `payments/creator-recovery-balances.md` (`REC-001`–`REC-004`).
      `requests/cancellation.md` updated: `CAN-004` is now actionable (not
      resolved-as-a-state), `CAN-005` is now closed automatically
      (`refundStrayPaymentOnCancelledRequest`), new `CAN-006` for the
      accepted-cancellation refund-drain follow-up call failing.

**Verified:** `npx vitest run` (899 passing, up from 880 — 19 new: 9 refund/window
arithmetic, 5 recovery-cap, 5 mirrored in `api/tests/refundArithmetic.test.js`),
`npx tsc --noEmit` (clean), `npx eslint .` (clean),
`npx vite build` (clean), `node --check api/server.js` and
`node --check api/refundArithmetic.js` (clean). **Not verified by this pass**: the
SQL migrations (`20260922_125`–`130`) were inspected against the live schema (exact
current constraint names, existing table state) via read-only queries, but not
applied — this repo's established pattern (Sprint 3/4 did the same) is to hand the
migration files to the user rather than apply them from an agent session. The
Stripe Application Fee Refunds API two-call approach, the platform-funded top-up
path, and the settlement Checkout session have **not** been exercised against a
real Stripe test-mode charge — there is no live traffic yet (per Sprint 4's own
note), so there was nothing to test against.

---

## Sprint 6 — Non-response, closure and transactional email

Email ships here because the notices are its first real use, but the Supabase SMTP
item is a live production gap and can be pulled forward on its own at any point.

- [x] Migration: notice records against a request — type (first / final), sender,
      what was requested, sent and expiry timestamps.
      `public.listing_request_notices`
      (`supabase/migrations/20260922_131_add_listing_request_notices.sql`), plus
      delivery-outcome columns (`email_status`, `email_provider_message_id`,
      `email_attempted_at`, `email_delivered_at`, `email_failed_reason`) in the
      same table rather than a separate one, since each notice maps to exactly
      one send attempt.
- [x] RPCs to send a first notice and a final notice, enforcing the 7 + 7 day clock
      and refusing a final notice before the first has expired.
      `send_listing_request_first_notice` / `send_listing_request_final_notice`
      (`20260922_131`) — both server-side: the final-notice RPC checks
      `now() >= first_notice.expires_at` and re-checks for a substantive reply at
      send time via `listing_request_has_substantive_reply`, not just at open
      time. "Substantive" reuses `conversation_messages.message_type <> 'system'`
      rather than adding a new concept — an automated acknowledgement is always
      `'system'` in this schema (Sprint 4's cancellation messages confirmed the
      convention).
- [x] Administrative closure RPC — admin only, on a request with an expired final
      notice, recording the reason and cascading per §5.
      `admin_close_listing_request_for_non_response`
      (`supabase/migrations/20260922_133_add_listing_request_administrative_closure.sql`)
      — re-verifies every precondition itself (expired unanswered final notice
      sent by the claimed waiting party, or an approved early-review flag) rather
      than trusting the caller. Two branches per §7's table: `buyer_unresponsive`
      cancels unfinished work only (unearned amounts stay refundable via the
      ordinary admin route); `creator_unresponsive` also flags every
      paid-but-unrefunded amount for automatic refund. Recorded in
      `listing_request_closures`, one per request, with the branch, reason, admin,
      and the notice or early-review flag it was based on. Explicitly not a
      finding of satisfactory work (Refund Policy §6) — the closure's system
      message says so.
      **Early review** (§7's table) is a separate admin-approval entry point, not
      a bypass flag on the closure RPC: `flag_listing_request_for_early_review` /
      `admin_decide_listing_request_early_review`
      (`20260922_132_add_listing_request_early_review_flags.sql`).
      **Refund execution reuses Sprint 5's engine, not a parallel path**: the
      `creator_unresponsive` branch writes to a new
      `listing_request_closure_refund_items` table (same shape as Sprint 4's
      `listing_request_cancellation_proposal_items`), and
      `POST /api/stripe/refunds/drain-flagged-for-request` was extended to also
      read it, calling the same `issueListingRequestPaymentRefund` ->
      `apply_refunded_listing_request_payment` path. A new migration
      (`20260922_136_close_closure_refund_loop.sql`) closes the refunded-at loop
      for the new table the same way `20260922_125` already does for Sprint 4's —
      this required a full `create or replace` of
      `apply_refunded_listing_request_payment` since Postgres cannot patch a
      single statement into an existing function body. A new `initiated_via`
      value, `'closure_cascade'`, keeps this distinguishable from Sprint 4's
      `'cancellation_cascade'` in the refund ledger.
- [x] Workspace UI: notice state, countdown, and the request-closure action for the
      waiting party.
      `src/components/listingRequests/core/NoticeAndClosurePanel.tsx` (buyer and
      creator workspaces) and `AdminNoticeClosurePanel.tsx` (admin, with the
      approve/decline early-review queue and the closure form itself). The
      waiting party's "request closure" action posts a plain participant text
      message (existing RLS already allows this) rather than a new RPC — closure
      itself stays admin-only regardless of who asks. Notice-clock display logic
      is mirrored in `src/domain/listings/listingRequestNotices.ts` with its own
      test suite (`src/domain/tests/listingRequestNotices.test.ts`), the same
      "SQL is truth, TS mirrors it for the UI" pattern as Sprint 5's refund
      arithmetic.
**Transactional email (§7.1)**

- [x] Enable Cloudflare Workers Paid and onboard `send.madeforstream.com` as the
      sending domain. Until a domain is onboarded, sending is limited to addresses
      verified on the account.
      **Done by the user, 2026-09-23** (billing/dashboard action, not code).
      Verified live: a real send through `api/email.js`'s
      `sendTransactionalEmail` was accepted by
      `smtp.mx.cloudflare.net:465` end to end (see
      `docs/support/messaging/transactional-email.md`'s status line).
- [x] Confirm Email Routing for `inbox@madeforstream.com` on the root domain, and
      that Cloudflare manages the SPF and DKIM records for both directions.
      **Done by the user, 2026-09-23.** `madeforstream.com`'s DNS shows the
      Email-Routing-managed MX (`route1-3.mx.cloudflare.net`), SPF, and DKIM
      records; the `inbox@madeforstream.com` custom address rule is verified.
- [x] Send from the Express API over the REST API or SMTP. **No Workers code
      required** — do not introduce a Workers deployment just to send mail.
      Sends over **authenticated SMTP** via `nodemailer`
      (`api/email.js`, `api/package.json`), not the REST API — Cloudflare Email
      Sending's REST contract is newer (Beta); SMTP is a stable, well-understood
      protocol and the docs confirm both are supported. **Verified live
      2026-09-23**: a real send was accepted by Cloudflare's SMTP endpoint
      (`smtp.mx.cloudflare.net:465`, username `api_token`) end to end. No
      Workers deployment introduced.
- [x] Templates: payment receipt, first notice, final notice, payout released. The
      last is not optional once the payout hold ships (§6.3).
      `api/emailTemplates.js`. Wired at the natural trigger points: receipt from
      `markListingRequestPaymentPaidFromCheckoutSession`'s fresh-write path
      (`api/server.js`), first/final notice from the new
      `POST /api/notices/:noticeId/send-email` route called right after the
      sending RPC, payout-released from a new `payout.paid` Stripe webhook
      handler. **§6.3 found the 14-day hold is Stripe's own account-level payout
      schedule, not something this app tracks or releases itself** — so
      `payout.paid` on the connected account is the only real signal available;
      this requires the webhook endpoint to be receiving Connect events, which
      needs confirming in the Stripe Dashboard (flagged in the playbook, not
      confirmed here).
- [x] *(Done 2026-10-01: custom SMTP saved in Supabase Auth, same Cloudflare credentials. A delivered sign-in email is confirmed in the rehearsal's account setup.)* Point **Supabase custom SMTP** at the same provider and sending domain. Auth
      mail currently goes through Supabase's built-in service, which is rate-limited
      to a handful per hour and is not for production — this is a live gap
      independent of the rest of this sprint.
      **Not done — Supabase dashboard action** (Project Settings → Auth → SMTP),
      and it needs the same Cloudflare credentials the two items above produce.
      Can be pulled forward once those exist, per this section's own note.
- [ ] Warm the sending domain before launch. New accounts start on a conservative
      daily quota that scales with sending behaviour; launch day is the wrong time
      to discover the ceiling.
      **Not done — domain is onboarded but only a single test send has gone
      out. Warming (gradually ramping real volume before launch) hasn't
      started.**
- [x] Record delivery outcomes against the notice records, so a disputed closure can
      show the notice was accepted for delivery.
      `listing_request_notices.email_status` (`pending`/`sent`/`failed`/`bounced`)
      plus `email_provider_message_id`/`email_attempted_at`/`email_delivered_at`/
      `email_failed_reason`, set by `POST /api/notices/:noticeId/send-email`.
      Distinguishable states: not-yet-sent (`pending`), accepted for delivery
      (`sent`), and bounced (`bounced`) — see `EMAIL-003` in the new playbook for
      how this feeds a disputed-closure investigation.
- [x] Suppression-list handling, so a hard bounce does not silently restart a notice
      clock that nobody received.
      `public.email_suppressions`
      (`supabase/migrations/20260922_134_add_email_suppressions.sql`), checked
      before every send (`isEmailSuppressed` in `api/email.js`) and written to by
      a new best-effort `POST /api/webhooks/email` handler. **The clock itself is
      never gated on suppression or delivery** — `sent_at`/`expires_at` are set by
      the notice RPC regardless of what the email does afterward, deliberately
      (an email outage must not be able to freeze the non-response process). The
      tradeoff is weaker delivery evidence on a disputed closure, documented in
      the playbook rather than silently accepted.
- [x] Playbook: new `messaging/transactional-email.md` — bounced notice, unverified
      domain, quota exceeded, and what a failed notice means for the 7 + 7 clock.
      Updated to `status: active` after the 2026-09-23 verified send; the
      bounce/complaint webhook's field-name parsing in
      `POST /api/webhooks/email` is still a best-effort guess (a successful
      send doesn't exercise it) and needs re-checking against a real
      Cloudflare bounce.
- [x] Staleness query surfaced in admin: requests not advanced in 14+ days with a
      pending action on one side.
      `admin_list_stale_listing_requests_checked`
      (`supabase/migrations/20260922_135_add_admin_stale_listing_requests.sql`),
      surfaced at the top of `/admin/requests`
      (`src/pages/admin/AdminRequests.tsx`). Approximated as "no request update
      and no conversation message in 14+ days on an active request" rather than
      re-deriving `requestWorkspace.ts`'s full whose-turn logic in SQL.
- [x] Playbook: `REQ-003` in `requests/request-lifecycle.md` is rewritten from "no
      policy exists" to the documented procedure; update
      `requests/final-delivery.md` and `requests/milestones.md`, whose gaps both
      point at it.

**Verified:** `npx vitest run` (913 passing, up from 899 — 14 new: the notice
clock/substantive-reply/closure-state domain mirror), `npx tsc --noEmit`
(clean), `npx eslint .` (clean), `npx vite build` (clean). **Not verified by
this pass:** the new SQL migrations (`20260922_131`–`136`) were written against
the live schema (columns, constraints and function signatures confirmed via
read-only queries — Sprint 5's tables are themselves still unapplied, per that
sprint's own note, so this sprint's migrations were checked by inspection only)
but not applied, matching Sprint 3/4/5's established pattern of handing migration
files to the user rather than applying them from an agent session.
**Addendum, 2026-09-23:** the user completed the Cloudflare/Supabase dashboard
steps and `api/email.js`'s SMTP send path was verified live — a real message
was accepted by `smtp.mx.cloudflare.net:465` end to end. Still unexercised
against real infrastructure: the `payout.paid` webhook handler (no real payout
has fired yet) and `POST /api/webhooks/email`'s bounce parsing (no real bounce
has occurred yet).

---

## Sprint 7 — Regional sales tax

Its own sprint because the blocking work is a professional opinion, not a migration,
and burying that inside an engineering sprint is how it gets skipped (§12).

**Status (2026-09-23): plumbing built, collection OFF, advice gate still open.**
Everything below is jurisdiction-neutral. `STRIPE_TAX_COLLECTION_COUNTRIES` ships
empty, so every payment is recorded as `tax_treatment = 'not_collected'` with its
billing country, and no tax is charged anywhere. Switching a country on needs the
advice first, then a Stripe Tax registration on the platform account plus config.
There is no code change (`docs/support/payments/tax.md`).

**Do first, in parallel with everything above — STILL OPEN, blocking collection in
any jurisdiction they cover**

- [ ] Jurisdiction-specific advice on registration and remittance, at minimum for EU
      VAT and UK VAT. **EU VAT applies from the first euro** with no small-seller
      threshold for a non-established supplier, so this gates wave 2, not a later
      phase.
- [ ] Decide which jurisdictions to register in and in what order.
- [ ] Confirm whether our own fees (the buyer service fee and the platform
      contribution) are separately taxable in each. This is a different question
      from tax on the commission. The tip's taxability is the same question. In the
      build, each line's Stripe tax code is config with **no default**, so enabling
      a country without all four set refuses checkout (`TAX-005`).
- [ ] **New question for the advisor, found in this sprint:** can the platform be
      the liable deemed supplier while the charge is a *direct charge* on the
      creator's connected account? Stripe Tax does not support platform liability
      on direct charges (Stripe's docs say so explicitly). The build therefore
      calculates on the platform account with the Tax Calculation API and sweeps
      tax into the application fee ("approach A", chosen 2026-09-23 so §3.4 Model A
      and Sprints 3–5 stay intact). If the advice says that can't work, the
      alternative is destination charges, which means reworking the payout hold,
      refund ledger and recovery balances.

**Product work**

- [x] Migration: `tax_cents` and jurisdiction on `listing_request_payments`, included
      in `total_checkout_cents`. `20260923_137`: per-line tax (`tax_on_base_cents`,
      `_buyer_fee_`, `_tip_`, `_support_`) summing to `tax_cents`;
      `tax_treatment`, `tax_jurisdiction_country/region`, Stripe calculation and
      transaction ids. Tax is in both the total and the application-fee constraints.
      `set_listing_request_payment_tax` recomputes both totals from the stored
      lines and refuses a jurisdiction that doesn't match the buyer's recorded
      billing country. `recompute_listing_request_payment_amounts` and
      `set_listing_request_payment_tip_and_support` are re-created to clear stale
      tax when amounts change. **The tip RPC rewrite also fixes a latent Sprint 5
      bug:** since `20260922_129` it omitted `recovery_instalment_cents`, so setting
      a tip on a payment carrying a recovery instalment violated
      `listing_request_payments_check`. **Written, not applied**, and not
      executed against a Postgres instance (none was available locally). This
      follows Sprints 3–6's pattern of handing migrations over unapplied.
- [x] Integrate Stripe Tax for calculation at checkout: `api/tax.js`, plus
      `applyCheckoutTax` in `POST /api/stripe/checkout/session`. Tax is calculated
      server-side before any session is created or reused. Every component,
      including tax, is its own Checkout line, and `buildCheckoutLineItems` throws
      if the lines don't add up to the stored total. The existing webhook
      `amount_total` check then proves the stored `tax_cents` is what was charged.
      Once paid, the calculation is committed as a Stripe Tax transaction on the
      platform account. **Not exercised against real Stripe Tax** (test mode never
      run, and collection is off).
- [x] Capture and store buyer location evidence (EU VAT requires two
      non-contradictory pieces). `listing_request_payment_tax_evidence` stores
      country only, never IP or card data. Pre-payment evidence: declared billing
      country, plus IP country if `TAX_IP_COUNTRY_HEADER` is set. Post-payment:
      card-issuing country and Checkout billing country. The declared and
      Checkout billing addresses are **one category**, so they can never count
      as two pieces. `get_listing_request_payment_tax_evidence_status` classifies
      each payment as `sufficient` / `insufficient` / `contradictory` (mirrored and
      tested in `listingRequestPaymentTax.ts`). Not configured in production: an
      IP geo header (Cloud Run sets none).
- [x] Show tax separately before payment, as §6 already requires. There's a tax row
      on the checkout summary ("Calculated before payment" until it's known), a
      billing-country step before the policies, and a separate tax line in
      Stripe Checkout.
- [x] Proportional tax adjustment on refunds, per Refund Policy §8. This follows
      `apply_refunded_listing_request_payment`'s cumulative-rounding pattern per
      line: base and buyer-fee tax follow the cumulative base; tip and contribution
      tax follow their own cumulative refunded amounts; a fully refunded line
      returns the exact remainder. The same arithmetic exists in the SQL function,
      `api/refundArithmetic.js` and the TS mirror. A 200-sequence randomized parity
      test proves the JS and TS copies agree at every step and always close out to
      exactly the original tax. The refund route adds tax to both the Stripe refund
      and the application-fee reversal, re-reads the ledger row to check it matches,
      and reverses the lines on the Stripe Tax transaction (`TAX-004` on failure).
- [~] Store creator tax status and country from Connect onboarding, and apply reverse
      charge on qualifying B2B supplies within the EU. **Half done.** Country was
      already stored. `tax_entity_type` and `tax_id_types` (types only, never
      numbers) are now stored from the v2 account's `identity`, but that payload
      shape is unverified against a live account. **Reverse charge is not
      applied.** It's blocked on the advice gate (who the supplier is). Once
      that's answered the remaining engineering is small: collect the buyer's VAT
      ID and pass it as `customer_details.tax_ids`, and Stripe Tax applies reverse
      charge itself.
- [~] Rewrite Fee Schedule §6 (§10). **Drafted** in `paymentTerms.ts`
      (`2026-09-23-draft-1`; fingerprint recorded, `api/policyVersions.js` synced, so
      buyers re-accept at checkout). It now says Made for Stream calculates, collects
      and remits *where obliged*, shows tax as its own line, which location signals
      are used and that only the country is kept, and that refunds adjust tax
      proportionally. The final wording waits on the advice gate and Sprint 8's
      non-draft cut.
- [x] Playbook: new `payments/tax.md` (`TAX-001`–`TAX-006`, signal queries, known
      gaps), indexed in `docs/support/README.md`, linked from `checkout.md` and
      `refunds-and-disputes.md`.

**Deploy order matters:** apply `20260923_137` **before** deploying the API or web
app from this branch. The checkout page and route read the new columns and RPCs, so
deploying the code first breaks checkout for everyone.

---

## Sprint 8 — Policy publication and launch gates

**Status (2026-09-24): code built and verified; DMCA agent registered.** Not done,
and not code: the end-to-end rehearsal (written as
[`launch-rehearsal-runbook.md`](launch-rehearsal-runbook.md), not run), the pending
business number, and anything that waits on the Sprint 7 tax advice. Decisions taken with the user this sprint:
the operator is **Made for Stream, P.O. Box 34086, Calgary RPO Westbrook, Alberta,
Canada T3C 3W2**; the instalment floor is **10.00 in every currency** (replacing
§3.1's 5.00); projects may be priced in **CAD, USD and the two-decimal wave 2
majors**; Fee Schedule §6 gets **interim wording** until the advice lands.
**2026-09-24:** the DMCA agent was registered and published; each purpose gets its
own `@madeforstream.com` address (all forwarded to one inbox); and the business
number is published as `[BUSINESS_NUMBER]` while its registration is pending.

**Built and verified**

- [x] §10 policy edits across `src/domain/legal/`. Made for Stream named as the
      operator, with the P.O. Box. The email placeholders are replaced by
      per-purpose addresses (2026-09-24): `support@` (accounts, projects, account
      closure, lost in-app access), `legal@` (legal notices, informal dispute
      resolution, trademark / impersonation / publicity complaints), `privacy@`
      (privacy, cookies, the register), `copyright@` (the DMCA agent),
      `disputes@` (refund and dispute requests, Refund §9), `safety@` (content
      reports, Community Guidelines) and `appeals@` (moderation and account-sanction
      appeals). `legalPublication.test.ts` refuses any other address. Fee Schedule
      §1: minimum columns gone, enabled currencies listed. §2 rewritten: no
      minimum fee, the 10.00 floor, and the agreement estimate as a maximum. §3
      examples reworked, including the two-instalment one (now the same total as
      one payment). §4 describes tips and contributions as available at checkout.
      §5 discloses the hold and recovery, including the 50% diversion. §6 is
      interim (no tax is currently added; if that changes, the schedule is updated
      and re-accepted first). Creator Terms §4: no minimum, the floor, and the
      payout hold. ToS §6 and Refund §8 lose their minimum references. Refund §1
      says the early-start request is captured at agreement acceptance.
      **The payout hold is disclosed as Stripe-set and not guaranteed, not as
      §10's "14-day hold":** §6.3 found 14 days unachievable under
      `losses_collector: "stripe"`.
- [x] Non-draft versions cut for every policy: creator terms and fee schedule at
      `2026-09-23`; terms, privacy, refund, cookie, community guidelines and
      copyright at `2026-09-24` (re-cut for the addresses, the DMCA agent and the
      business-number line). `// REVIEW DRAFT` is removed from all of them. Fingerprints are recorded in
      `policyVersionIntegrity.test.ts`, and `api/policyVersions.js` is synced
      (`checkoutPolicyVersionsSync.test.ts` passes). **Every user re-accepts**:
      signup policies at next sign-in, creator terms at activation, and all three
      checkout policies at next checkout.
      **Copyright Policy §2** publishes the agent exactly as registered with the
      US Copyright Office (2026-09-24): Made for Stream, P.O. Box 34086, Calgary
      RPO Westbrook, Calgary, Alberta T3C 3W2, Canada, +1 403-609-9839,
      `copyright@madeforstream.com`. `legalPublication.test.ts` pins those lines,
      so a change to one side fails until the other matches.
      **One placeholder remains by decision:** `[BUSINESS_NUMBER]` in Terms §1 and
      Privacy §1. It shows as bracketed text on the live pages until filled, and
      filling it bumps Terms and Privacy again (every user re-accepts).
- [x] Cookie Policy §7 **Storage Register** written. It was not on this list, but
      §7 said the published version must include it. Built from the source:
      Supabase session key, pending policy acceptance, cookie choices, theme, and
      Stripe.js's `__stripe_mid` / `__stripe_sid`. **Not browser-verified against
      the deployed site** (the browser pane could not reach it). That check is step
      0 of the runbook.
- [x] Express request to start early, at agreement acceptance (§1.5).
      `20260923_138`: `respond_listing_request_agreement` takes
      `p_early_service_request_version`, writes the `early_service_request` row to
      `policy_acceptances` in the same transaction, and refuses acceptance without
      it. The three-argument signature is dropped, and a trigger refuses any other
      route to `buyer_accepted` without the row. The UI is its own checkbox under
      the acknowledgements; the wording is shared with checkout, which now asks
      again only if the Refund Policy changed. Playbook: `AGR-007`.
- [x] Instalment floor at agreement send and schedule-item creation, at the
      database (§3.1), with a plain-language message naming the floor, the amount
      and what to do. `20260923_138` adds `supported_currencies` (a first cut of
      Sprint 1's registry: two-decimal only, enforced by a check constraint) and
      `assert_listing_request_instalment_allowed`. Triggers cover schedule-item
      insert and amount/currency changes, agreement send (draft → sent re-checks
      every item), agreement currency, and change-order send. The payment
      bridge's 5.00 check is left as a backstop so already-accepted schedules keep
      their terms (Fee Schedule §8). The API refuses unsupported currencies at
      checkout and at connect account-session. The payout-settings currency is now
      a picker. The builder shows the floor message before submit. The agreement
      summary quotes fees **as a maximum**. Playbooks: `AGR-005`, `AGR-006`,
      change-orders, `PAY-004`, `CON-005`, and a tax.md known gap.
- [x] **Service Provider Register published** at `/policies/service-providers`
      (`serviceProviderRegister.ts`), rendered like the other policies and listed
      on `/legal`. Entries: Supabase (US, Oregon), **Google Cloud** (Cloud Run,
      US, Iowa; missing from the original list but it runs the API), Stripe
      including Stripe Tax, and Cloudflare (DNS, inbound routing, outbound email).
      **Google Fonts is listed as not used**: fonts are self-hosted via
      `@fontsource`, so no request goes to Google. Privacy Policy links to the
      register from §4 and §11 (real router links; `LinkedText` now links
      `/policies/...` paths).
- [x] Privacy Policy §4 names Cloudflare alongside Supabase, Google Cloud and
      Stripe. **Sprint 7's processing is now covered:** §2 adds tax location
      evidence (countries only), §8 retains it with financial records, and §4 and
      the register name Stripe Tax "where tax is calculated". "Draft service model"
      becomes "current service model".
- [x] Baselines: **988 tests passing** (944 + 44 new), `tsc` clean, `eslint`
      clean, `vite build` clean (the >500 kB chunk warning predates Sprint 7).

**Migration `20260923_138`: written, not applied.** Verified against **PGlite**
(in-process Postgres 17) with stub tables for the columns it touches: 27
behavioural checks, including every refusal, legacy rows still settleable, the
consent row rolling back when acceptance fails, one remaining RPC signature, and a
clean re-run. That is not the real schema. **Apply it together with the web
deploy** (see the runbook's step 0).

**User actions (not code, not done)**

- [x] **DMCA designated agent registered** with the US Copyright Office
      (2026-09-24, by the user) and published in Copyright Policy §2. **Renew by
      2029-09-24**: a designation lapses after three years, and the safe harbour
      with it. Any change to the agent's details needs an amendment there and a
      matching Copyright Policy version.
- [ ] **Business number** (registration pending). Replace `[BUSINESS_NUMBER]` in
      `termsOfService.ts` and `privacyPolicy.ts`, bump both versions, record the
      fingerprints, and drop the allowance in `legalPublication.test.ts`.
- [x] *(Done by the user, 2026-09-26.)* **Cloudflare Email Routing rules** for `support@`, `legal@`, `privacy@`,
      `copyright@`, `disputes@`, `safety@` and `appeals@` madeforstream.com, all
      forwarding to the existing destination. **Before the web deploy**, because
      the published policies name them. Keep the existing `inbox@` rule.
- [x] *(Done 2026-09-26: both are Secret Manager secrets attached to the service, with all SMTP settings, in revision `00007`.)* **Cloud Run env:** set `EMAIL_SUPPORT_EMAIL=support@madeforstream.com` (the
      code default changed, but a set env var wins) and `EMAIL_COMPANY_ADDRESS` to
      the P.O. Box line in `api/.env.example`, so receipt footers carry it.
- [ ] **Run the rehearsal** in [`launch-rehearsal-runbook.md`](launch-rehearsal-runbook.md)
      (CAD, USD, EUR). Written, **not run**. It includes the Storage Register
      browser check.
- [ ] **Confirm processor terms are in place** before relying on the register as
      a GDPR sub-processor disclosure. Stripe's, Cloudflare's and Google Cloud's
      data processing terms are part of their standard agreements. Check whether
      Supabase's DPA needs to be requested and signed from its dashboard. None of
      this was verified in this sprint.
- [ ] **Ask counsel whether an EU/UK representative is required** (GDPR Art. 27 /
      UK GDPR). Buyers are unrestricted by country from launch, whatever currency
      the creator sells in. Privacy §11 still says the representative's details
      must be added before offering on that basis.
- [ ] *(Answered 2026-10-02: the site was not hosted at all. The dev site now runs on a Cloudflare Worker behind Cloudflare Access; see `environments.md`. **Still to do before prod:** add Cloudflare hosting to the Service Provider Register and Privacy Policy §4, which bumps both versions.)* Confirm whether the site itself is served through Cloudflare (Pages or
      proxy). The register lists Cloudflare for DNS and email only.

**Waiting on the Sprint 7 tax advice**

- [ ] Fee Schedule §6 final wording. The interim text says no tax is added today;
      switching a country on requires rewriting §6 and a version bump **before**
      the first taxed payment (the file's header comment says so).
- [ ] **Live sales in EUR, GBP and the other wave 2 currencies.** They are
      *enabled* (decided 2026-09-23), so nothing in the product stops a live EUR
      sale. EU VAT applies from the first sale. The runbook's EUR run is test mode
      only and does not clear this.
- [ ] Reverse charge, and the IP geo header (both tracked in `payments/tax.md`).

---

## Sprint 9 — Stripe account state and operational alerting

**Status (2026-09-24): code built and verified; migration `20260924_139` written,
not applied; nothing registered or scheduled yet.** Three carried items move
here: account-state handling, the scheduled resync, and alerting. Decisions
taken with the user this sprint: alerts go to **`ops@madeforstream.com`**; the
Cloud Scheduler jobs and Stripe event destination are **user actions** (exact
steps below), not created from an agent session; the migration is handed over,
not applied. The launch rehearsal had **not been run** when this sprint started,
so no rehearsal defects came first.

**Built and verified**

- [x] **Accounts v2 account events.** `POST /api/stripe/account-events`
      receives thin events on their own destination and signing secret
      (`STRIPE_ACCOUNT_EVENTS_WEBHOOK_SECRET_DEV`/`_PROD`), verified with the
      SDK's `parseEventNotification` (stripe-node 22.6.1). Handled:
      `v2.core.account[requirements].updated`,
      `v2.core.account[configuration.merchant].capability_status_updated`,
      `…[configuration.recipient].capability_status_updated` and
      `v2.core.account.closed`. Event names were checked against Stripe's event
      type list, and the delivery scope against the Accounts v2 migration guide:
      v2 account events for connected accounts come from **"Your account"**, not
      "Connected accounts". The handler confirms the event with
      `stripe.v2.core.events.retrieve`, re-reads the account with
      `v2.core.accounts.retrieve`, and never takes state from the payload.
      Deduplicated through `stripe_webhook_events`. Playbook: `CON-003`, `CON-006`.
- [x] **One mapping.** `api/connectAccountState.js`
      (`buildCreatorPaymentAccountPatch`) is the only v2 Account →
      `creator_payment_accounts` mapping. The settings sync, onboarding, the
      event handler and the resync all go through it
      (`resyncCreatorPaymentAccountFromStripe` for the three re-reads). The old
      in-file derive functions are gone. It also records
      `requirements_due_count` / `requirements_past_due_count` for `CON-004`,
      treats a closed account as never ready, and stops bumping
      `onboarding_completed_at` on every sync.
- [x] **Cannot move backwards.** `20260924_139` adds
      `stripe_state_observed_at`, stamped just before each Stripe read, and the
      trigger `guard_creator_payment_account_state_order` keeps the recorded
      state unless a write is strictly newer. It also sets `readiness_lost_at`
      on a ready → not-ready change.
- [x] **Restricted accounts stop new paid work** through the same
      `has_ready_creator_payment_account` check that gates publishing:
      `assert_creator_ready_for_paid_work` runs on request submit, agreement
      sent/accepted (total > 0), and price-increasing change order
      sent/accepted. Drafts, cancellations, other change orders and payments
      already owed are untouched, and checkout already refuses at the API
      (`PAY-003`). **Live listings are not unpublished:** that stays a business
      decision (`CON-003`). The buyer request form maps the new message
      (`listingRequestErrors.ts`). Other flows show the database message as-is.
      Playbook: `CON-007`.
- [x] **Scheduled resync** (the backstop): `POST /api/internal/ops/connect-resync`
      re-reads rows never synced or older than 6 h, stalest first, up to
      `OPS_RESYNC_BATCH_SIZE` (default 100). Per-account failures log `CON-006`
      and the run continues. Runs on Cloud Scheduler hitting the Cloud Run API,
      authenticated with a bearer secret (`OPS_CRON_SECRET`, 32+ characters,
      constant-time compare; unset refuses everything).
- [x] **Alerting.** `list_ops_alerts()` (service-role only) returns one row per
      open alert, each naming its playbook issue: `PAY-005` stuck payment,
      `CHG-003` missing change-order payment, `REQ-003` Sprint 6 staleness,
      `TAX-002`/`003`/`004`, **`TAX-007`** (new: paid non-CAD/USD sale while the
      advice is open, sent once only), **`CON-003`** (lost readiness with live
      listings) and **`CON-006`** (mirror not refreshed in 48 h).
      `POST /api/internal/ops/alerts/run` emails a digest through `api/email.js`
      to `OPS_ALERT_EMAIL`: once when a subject is new, then daily while it
      stays open. A failed send is retried next run and returns 502.
      `ops_alert_notifications` holds this state. PAY-005's email threshold is
      deliberately later than the agent's 30-minute signal (25 h
      `checkout_opened`, 7 days `processing`). New playbook:
      [`support/operations/alerting.md`](support/operations/alerting.md)
      (`OPS-001`–`003`).
- [x] Playbooks: `connect-onboarding.md` (mirror section, `CON-001`, `CON-003`,
      new `CON-006` and `CON-007`, Known gaps rewritten), `tax.md` (`TAX-007`,
      alert notes), `checkout.md` (`PAY-005`), `change-orders.md` (`CHG-003` now
      has its query, and its gap is closed), `request-lifecycle.md` (`REQ-003`),
      `agent-contract.md` and `agent.config.yaml` (`resync_connect_account`'s
      idempotency argument), and the support index. `api/.env.example` lists the
      new variables.

**How it was verified**

- `npx vitest run`: **1039 passing** (988 + 51 new).
  `api/tests/connectAccountState.test.js` covers the mapping, closed accounts,
  requirement counts, event classification (only the account id is taken from a
  notification), identical output for every writer, and resync selection.
  `api/tests/opsAlerts.test.js` checks the registry against
  `list_ops_alerts()` branch for branch, checks every alert's playbook issue
  exists, checks every column the alert SQL names against the schema, and covers
  the digest plan (new, reminder, once-only, retry after a failed send,
  resolved, unknown ids), the rendering and the auth check. One frontend test
  covers the `CON-007` message. `tsc`, `eslint` and `vite build` are clean.
- **The alert SQL was run read-only against the live project** for every branch
  that uses existing columns (all but the two `CON` branches). It returned one
  real `REQ-003` hit and nothing else. The live project has **no
  `creator_payment_accounts` rows yet**.
- **Migration `20260924_139` against PGlite** (in-process Postgres, with stub
  tables shaped from the live `information_schema` and the live
  `has_ready_creator_payment_account`): 40 checks, all passing. They cover:
  applies and re-runs cleanly; an older (09:00) observation after a newer one
  (10:00) changes nothing; a replay at the same time changes nothing; a newer
  restriction applies and sets `readiness_lost_at`; a late "ready" event after
  the restriction cannot un-restrict; a write with no new timestamp cannot flip
  readiness; every paid-work refusal and every allowed path; all nine alerts
  fire with the right issue; `CHG-003` clears once the payment exists; and
  privileges (client roles cannot call `list_ops_alerts` or the gate, or read
  the state table). **The ordering guarantee is tested in PGlite, not in the
  vitest suite**, because PGlite is not a repo dependency. Adding it as a
  devDependency would bring the check into CI. The script is not in the repo.
- **The API was run locally with Supabase unset:** the ops routes return 401
  without the secret or with a wrong one, and log `OPS-002`. With the secret,
  they reach their own failure paths. The SDK was checked directly:
  `parseEventNotification` accepts a correctly signed thin payload, refuses a
  wrong secret, and refuses a v1 snapshot event. The classifier resolves its
  account id.
- **Not exercised:** a real Stripe thin event delivery, a real v2 account in
  `restricted` (the requirement-count shape follows the SDK's types), a real
  scheduled run, and a real alert email to `ops@`.

**User actions (not code, not done)**

- [x] *(Applied, confirmed 2026-09-26.)* **Apply `20260924_139`** with the API deploy that contains this sprint
      (the API selects the new columns, so deploy after applying). Until then
      `list_ops_alerts` does not exist and the alerts job answers 500 (`OPS-001`).
- [x] *(Test mode done 2026-09-26: destination "Accounts", `ed_test_61VTRW…`; signing secret rolled after it was shared and stored as secret version 3; a ping arrived `200` and was recorded `ignored`. **Live mode is still to do** at the switch to live.)* **Stripe event destination for account events**, once per mode (test
      first). Workbench → Webhooks → **Create an event destination**. **Events
      from: Your account.** Payload style **Thin**. Events:
      `v2.core.account[requirements].updated`,
      `v2.core.account[configuration.merchant].capability_status_updated`,
      `v2.core.account[configuration.recipient].capability_status_updated`,
      `v2.core.account.closed`. Destination: webhook endpoint
      `https://made-for-stream-api-422533033771.us-central1.run.app/api/stripe/account-events`.
      Copy the signing secret into Secret Manager as
      `STRIPE_ACCOUNT_EVENTS_WEBHOOK_SECRET_DEV` (`_PROD` for live) and expose it
      to Cloud Run (`--update-secrets`). **Caution:** `webhooks.md` records that
      this UI once looked right but routed nothing (2026-09-22). If a test
      account change shows no delivery, create it through the API instead
      (`POST /v2/core/event_destinations` with `event_payload: "thin"`,
      `type: "webhook_endpoint"`, the events above, the URL, and
      `include: ["webhook_endpoint.signing_secret"]`). Classic
      `webhook_endpoints` cannot carry thin events. Then check that a
      `v2.core.account%` row appears in `stripe_webhook_events` as `processed`.
- [x] *(Created 2026-09-26, both enabled.)* **Cloud Scheduler jobs** `mfs-connect-resync` (`15 * * * *`) and
      `mfs-ops-alerts` (`45 * * * *`), both `POST` with
      `Authorization: Bearer $OPS_CRON_SECRET`. The exact `gcloud` commands are
      in `support/operations/alerting.md` → Setup. Two jobs fit in the free
      three per billing account, then $0.10/job/month.
- [x] *(Done 2026-09-26, except `_PROD`, which waits for live mode.)* **Env and secrets on Cloud Run:** `OPS_CRON_SECRET` (new Secret Manager
      secret, 32+ random characters), `OPS_ALERT_EMAIL=ops@madeforstream.com`,
      `STRIPE_ACCOUNT_EVENTS_WEBHOOK_SECRET_DEV` (and `_PROD` later). Optional:
      `OPS_RESYNC_BATCH_SIZE`, `OPS_PLAYBOOK_BASE_URL`.
- [x] *(Done 2026-09-26.)* **Cloudflare Email Routing rule for `ops@madeforstream.com`**, forwarding
      to the shared inbox like Sprint 8's purpose addresses.
- [x] *(2026-09-26 22:10 UTC: both `200`; the REQ-003 digest was delivered to ops@. The first force-runs after enabling the API were queued for a few minutes, not lost.)* **Force-run both jobs once** and check for `200`. The alerts job should
      email the current `REQ-003` hit, which confirms delivery end to end.


### Sprint 9 follow-ups (2026-09-26)

Found while doing the Sprint 9 setup.

- [x] **Production was stuck on the pre-Sprint-4 build.** Merging doesn't deploy,
      and the last deploy was 2026-09-22. A new deploy would also have failed:
      `api/Dockerfile` copied only three modules, while `server.js` imports seven
      more (`ERR_MODULE_NOT_FOUND`). Fixed to copy `*.js` (#121). **Sprints 4–9
      went live for the first time in revision `00007` (2026-09-26)**, so the
      rehearsal is their first real run.
- [x] **Cloud Run had no email configuration at all.** SMTP host, user and
      password, from address, support address and company address were added
      (`EMAIL_SMTP_PASS`, `EMAIL_SUPPORT_EMAIL`, `EMAIL_COMPANY_ADDRESS` as
      secrets). Transactional email from Cloud Run is verified by the delivered
      ops digest.
- [x] **The alert email reads plainly** (#122): what happened, what to do,
      readable dates and an "Open in admin" button per item.
- [x] **Migration drift audit.** Every function body in `supabase/migrations`
      (newest definition) was compared with the live database by hash, and every
      table, column and trigger with the catalog. Four migrations were never
      applied:
      - `056` and `058`: moderation resolution rules. They could never apply,
        because they change the function's return type.
      - `068`: the request status-change logger.
      - `116`: free listings exempt from payout readiness. The Sprint 1 box
        marked "Done (#104)" was **not true in production**: a creator could
        not publish a free listing without Stripe.
      - The `003` updated-at trigger on `profile_platform_accounts` was also
        missing.
      Everything else matches.
- [x] **Sprint 9 gate fixed for free listings.** `139` refused requests for a
      free listing when the creator had no Stripe account. `20260926_140` exempts
      them, matching `116`.
- [x] *(Applied 2026-09-29 and verified against the live database: all four functions match, the anon revoke held.)* **Apply `20260926_140`** (user action). It re-applies `003`'s trigger,
      `058` (dropping the old function first; the admin UI passes named
      arguments and ignores the return value), `068`'s logger only (not its
      archive-metadata function, which `074` supersedes) and `116`, then fixes
      the gate. **Dry-run on the live database inside a rolled-back
      transaction, 2026-09-26:** every function then matched its repo version,
      `074`'s archive function was untouched, the publish trigger watches
      `is_free`, the trigger functions stayed closed to client roles, and the
      rollback left production unchanged. The dry run found one gap, now fixed:
      recreating the moderation function gave `anon` execute, so `140` revokes it.
- [ ] **Merging doesn't deploy the API.** (The dev **web** site does deploy on merge, since 2026-10-02.) Until a Cloud Build trigger on `main` exists
      (a paid resource; your decision), deploy by hand after each API merge
      (`gcloud run deploy made-for-stream-api --source api --region us-central1`)
      and check that the serving revision is newer than the merge.


### Environments and the private dev site (2026-10-01 to 2026-10-02)

Decision: nothing is publicly usable until the legal items clear. Full layout
in [`environments.md`](environments.md).

- [x] **The website had never been hosted.** `madeforstream.com` had only email
      records. It stays dark on purpose until launch.
- [x] **Dev site:** `dev.madeforstream.com`, a Cloudflare Worker serving the
      Vite build (`wrangler.jsonc`), built from `main` on every merge. The
      `workers.dev` address and preview URLs are disabled.
- [x] **Two locks, both verified from outside (2026-10-02):** Cloudflare Access
      redirects every path (including assets) to its sign-in page for anyone not
      on the allow list, with one-time email codes enabled; and Supabase Auth
      reports `disable_signup: true`, so no account can be created whatever is
      reached.
- [x] **API pointed at dev:** `APP_ORIGIN`, `APP_ORIGINS` and `EMAIL_SITE_URL`
      are `https://dev.madeforstream.com`. The API accepts the dev site and
      localhost and refuses other origins. Supabase Auth's Site URL and redirect
      list include the dev site.
- [x] **SMTP token rolled (2026-10-01)** after the old one was pasted into a
      chat. The new one is in Secret Manager (`EMAIL_SMTP_PASS` version 3) and
      Supabase Auth; a delivered ops alert confirmed the API side.
- [x] **API outage, 2026-10-05: a malformed health probe.** Cloud Run's
      liveness probe path was the whole option string instead of
      `/api/health` (the shell had turned the command's commas into spaces),
      so every instance was shut down about 30 seconds after starting. The
      logs show this from 2026-09-22 (revision `00004`): the API answered
      only between restarts, and on 2026-10-05 every route returned `500`. A
      first fix attempt (revision `00016`) repeated the mistake. Fixed in
      revision `00017`, run from Git Bash with the value quoted. **Verified
      from outside, 2026-10-05:** the probe path reads exactly `/api/health`,
      `/api/health` returns `200`, the dev site still returns `302` and
      sign-ups are still off. Recorded in `environments.md` and as
      `OPS-004` in `support/operations/alerting.md`. **Consequence for
      earlier checks:** anything "verified" on the API between those dates
      was verified on an API that was restarting constantly.
- [x] *(That account was deleted in Stripe later the same day; the result stands, the account does not.)* **Rehearsal, 2026-10-05: first creator through Stripe payout setup.**
      TrashMailman (Ireland / EUR, `acct_1UNLCC2LYyYcqv6i`): `charges_enabled`,
      `payouts_enabled` and `details_submitted` all true in
      `creator_payment_accounts`, and 15 `v2.core.account…` events stored as
      `processed`, none failed. This is the Sprint 9 handler's first real run.
- [ ] **Rehearsal finding, 2026-10-06: creating a listing left it as a
      hidden draft with no clear next step.** Saving went back to the list;
      publishing meant finding the listing again, and the status was two
      small pills. Code: the create page has a checklist side panel that
      updates as the form is filled in and stays on screen, with **Publish
      now** (enabled once the checklist is done) and **Save as draft**. Both
      land on the listing's page, which now opens with a coloured status
      banner (draft / live / deactivated / locked) carrying the next action,
      and shows the real reason when publishing is refused. **Unit tests
      only; tick when seen in a browser.**
- [ ] **Found 2026-10-06: `npx eslint .` does not check the website's
      TypeScript.** `eslint.config.js` only matches `*.js` and `*.jsx`, so
      every `.ts` and `.tsx` file is skipped. "eslint clean" has only ever
      meant the API and scripts. `tsc` does cover the TypeScript.
- [ ] **Listing thumbnails are uploads, with an optional watermark
      (2026-10-06).** The pasted link is gone. The page shrinks the image to
      1200 px, optionally watermarks it ("Made for Stream · @handle") and
      re-saves it in the browser; only that copy is uploaded, so the original
      cannot be taken from the page. An info panel explains this and holds the
      watermark option (on by default, "free during early access"). Migration
      `20261006_143` adds the `listing-previews` bucket, a rule that a
      listing's image can only be changed to the creator's own upload, and
      `preview_watermarked`. **Dry-run on the live database in a rolled-back
      transaction, 2026-10-06:** an unchanged old link is kept, an outside
      link / another creator's folder / another bucket are refused, the
      creator's own upload and clearing the image are accepted; the rollback
      left nothing behind. The watermark was looked at once on a generated
      test image in a local browser (4.7 MB in, 29 KB out, 1200 px). **Not
      tested:** a real upload end to end, Safari, the form in a browser.
      **User action: apply `143` before merging**, or saving any listing
      fails (`LST-004`).
- [ ] **Existing listings still show pasted links** (11 on dev: 6 placeholder
      photos, 5 taken from other websites). They are left as they are and can
      still be published and edited. Not copied into our storage: five are
      other people's images, and stamping them "Made for Stream" would claim
      them. Replace them when the dev data is replaced with made-up data
      (item below).
- [ ] **Watermark as a paid add-on, promo codes, subscription (later, not
      built).** What exists for it: `listings.preview_watermarked`. What it
      needs: an entitlements table (who may watermark, how many, until when),
      promo codes that grant one, and a database check when
      `preview_watermarked` is set, since the browser cannot be the gate.
- [ ] **Rehearsal finding, 2026-10-05: the wrong payout country was too easy
      to pick.** Canada was preselected and one click created a permanent
      Stripe account (it happened twice in the rehearsal). Code: no country
      is preselected; the page shows a large warning that the country can't
      be changed; the creator chooses, presses "Confirm <country>
      (<currency>)", and only then is the Stripe button shown, with a
      "Change country" button until setup starts. The API no longer falls
      back to Canada / CAD when a request names no country. **Unit tests
      only; needs an API deploy; tick when seen in a browser.**
- [ ] **Rehearsal finding, 2026-10-05: a deleted Stripe account left the
      creator stuck** (`CON-009`). Two test accounts were deleted in the
      Stripe Dashboard; their `creator_payment_accounts` rows stayed, so
      "Continue Stripe setup" showed Stripe's raw "No such account". Working
      as designed: the `v2.core.account.closed` events were `processed` and
      the rows' flags went false. Code (API): both payout routes now answer
      with a plain "account is closed, contact support" message and log
      `CON-009`; the playbook has the reset. **Needs an API deploy; unit test
      of the error check only.** Still open: the page reads "Stripe is
      checking your details" for a closed account until a button is pressed
      (needs a `closed_at` column; your decision).
- [ ] **Rehearsal finding, 2026-10-05: the payout page did not say what was
      happening.** After Stripe's form closed the page went blank with a
      "Restart Stripe setup" button, gave no sign that Stripe was checking the
      details, and did not say when the account became ready. Code: the page
      now shows one of three notices (Stripe needs more from you / Stripe is
      checking your details / your payout account is ready), closes the
      finished form, re-reads the status every 10 seconds while Stripe is
      checking, and asks Stripe for all requirements in one pass. Country
      and currency also showed Canada / CAD after a page refresh whatever
      the account's were (display only: the API ignores them for an existing
      account, and the row stayed IE / EUR); they now show the account's own
      and are locked once an account exists. **Unit
      tests only; tick this when the next creator's setup shows it working
      in a browser.**
- [x] *(Fixed 2026-10-05: build variable corrected by the user; the form loaded and TrashMailman completed setup.)* **Rehearsal finding, 2026-10-05: payout setup could not load on the dev
      site** (`CON-008`). The site's `VITE_STRIPE_PUBLISHABLE_KEY_DEV` is from
      a different Stripe account than the API's secret key, so Stripe refused
      the onboarding form ("No account session with that client secret was
      found"). **User action:** set the build variable to the publishable key
      of the sandbox the API uses, and rebuild. Code: the page now shows an
      error when the form fails to load instead of staying blank (unit test
      only; not yet seen in a browser). Working as designed in the same run:
      the first real `v2.core.account…` events arrived and were `processed`,
      and an "approved" decision email was recorded as `sent`.
- [x] *(Recovered 2026-10-06 after the plan and compute upgrade: the database answers in under 0.1 s from outside, sign-ups are still off, and both scheduler jobs ran clean at 20:15 and 20:45 UTC. The Disk IO chart has not been looked at.)* **Outage, 2026-10-06: the dev database stopped answering** (`OPS-005`).
      Supabase reported the Disk IO budget running out; from about 14:45 UTC
      queries timed out, and sign-in failed with `504`. The website and the
      API stayed up. Likely trigger: the payout page's new status check (added
      2026-10-05) re-read the database every 10 seconds with no end, from a
      tab left open overnight on an account that could never leave
      "checking" (about 4,800 requests in 23 hours). Not proved: the database
      could not be queried while down. Code: the check now stops after 30
      tries (5 minutes) and pauses in hidden tabs; tests cover both. **User
      actions:** restart the project; for prod, use the paid plan with a
      chosen compute size. Tick when the database answers again and the
      Disk IO chart is flat with the site open.
- [x] **Supabase moved to the paid plan (2026-10-06, user action).** The
      organization is on Pro (confirmed through Supabase's API) and the dev
      project is on Small compute. The billing email was set to
      `ops@madeforstream.com` by the user; not verified from here. Prod will
      be a second project in the same organization.
- [ ] **Nothing alerts when the API is down** (`OPS-004`). A Cloud Monitoring
      uptime check on `/api/health` would; it is a cloud resource, so it is
      your decision.
- [ ] **The dev database holds real people's details** (seeded creator profiles
      from friends). Replace them with made-up data before more testers are
      added.
- [ ] **Prod environment:** not built. `environments.md` lists what it needs,
      including a clean replay of every migration on an empty database first.

---

## Carried, not launch-blocking

Real gaps the playbooks already record. None of them stops a buyer paying a creator,
so none of them is in the eight sprints above — but they should not be lost.

- [x] ~~Account-state handling, scheduled resync, and alerting for `PAY-005`,
      `CHG-003` and the Sprint 6 staleness query~~ — built in Sprint 9 (with the
      `TAX-002`–`004` and wave 2 currency alerts). The registration and
      scheduling are user actions listed there.
- [ ] Fix the `processing` state — buyer copy, creator SLA, reminders, reconciliation
      that understands a legitimately slow payment. This is the prerequisite for
      local payment methods (§1.6), which matter a lot in several European markets.
- [ ] Delivery links are never verified, so a dead link is indistinguishable from a
      good one at approval time (`final-delivery.md`).
- [ ] Change orders' effect on existing milestone schedules is undocumented and the
      `AGR-001` totals checks may not reconcile afterwards (`change-orders.md`).
- [ ] No versioned view of agreement terms over time, so which version applied when
      cannot be reconstructed for a dispute (`agreements.md`, `change-orders.md`).
- [ ] `api/server.js` still has close to no test coverage. Sprint 9 kept its new
      logic in tested pure modules (`connectAccountState.js`, `opsAlerts.js`),
      but the route handlers themselves are still untested.
- [ ] **Rebrand assets — logos, favicons, site imagery.** The product rebranded
      (2026-09-23) and needs new logo files, favicons, and site imagery
      throughout. Cosmetic, not launch-blocking. Specific hooks already built
      and waiting for real assets rather than requiring code changes later:
      `api/emailTemplates.js` reads `EMAIL_LOGO_URL` (a hosted image URL —
      logo falls back to a plain text wordmark until set),
      `EMAIL_BRAND_NAME`, and `EMAIL_COMPANY_ADDRESS` (deliberately blank, not
      a placeholder, until a real mailing address is decided) via env vars,
      documented in `api/.env.example`. Once assets exist: drop the logo
      somewhere stable (site `/public`, object storage) and set the env var;
      no template code changes needed. Site favicon/imagery is a separate,
      untracked piece of work outside `api/` — add it here when scoped.
      Also revisit Cloudflare BIMI (`docs/support/messaging/transactional-email.md`)
      once a final logo exists and DMARC is enforcing beyond `p=none` — BIMI
      requires `p=quarantine`/`p=reject`, not the `p=none` currently live.
