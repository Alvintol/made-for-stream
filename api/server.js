import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";
import crypto from "crypto";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

import { CHECKOUT_POLICY_VERSIONS } from "./policyVersions.js";
import { getMissingCheckoutPolicyTypes } from "./policyAcceptanceGuard.js";
import {
  getUnsupportedPayoutCountryMessage,
  isSupportedPayoutCountry,
} from "./supportedCountries.js";
import {
  getUnsupportedCurrencyMessage,
  isSupportedCurrency,
} from "./supportedCurrencies.js";
import { computeCumulativeRefund } from "./refundArithmetic.js";
import { sendTransactionalEmail, suppressEmail } from "./email.js";
import {
  getListingRequestUrl as buildListingRequestUrl,
  getNotificationNames,
  getNotificationUrl,
  renderNotificationEmail,
} from "./notificationEmails.js";
import { getExchangeRates } from "./exchangeRates.js";
import {
  buildCheckoutLineItems,
  buildTaxCalculationLineItems,
  buildTaxReversalLineItems,
  decideTaxTreatment,
  extractTaxLinesFromCalculation,
  getIpCountryFromRequest,
  normalizeTaxCountry,
  parseTaxConfig,
} from "./tax.js";
import {
  CONNECT_ACCOUNT_GONE_MESSAGE,
  CONNECT_ACCOUNT_RETRIEVE_INCLUDE,
  buildCreatorPaymentAccountPatch,
  classifyConnectAccountEvent,
  didCreatorPaymentAccountLoseReadiness,
  isStripeAccountGoneError,
  selectAccountsForResync,
} from "./connectAccountState.js";
import {
  getApplicantVisibleNote,
  shouldSendApplicationDecisionEmail,
} from "./creatorApplicationEmail.js";
import {
  isAuthorizedOpsRequest,
  planOpsAlertDigest,
  renderOpsAlertDigest,
} from "./opsAlerts.js";
import {
  renderFinalNoticeEmail,
  renderFirstNoticeEmail,
  renderPaymentReceiptEmail,
  renderCreatorApplicationDecisionEmail,
  renderPayoutReleasedEmail,
} from "./emailTemplates.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, ".env"),
});

const app = express();

const PORT = Number(process.env.PORT || 8787);
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || "";
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || "";

const TWITCH_REDIRECT_URI = process.env.TWITCH_REDIRECT_URI || "";
const APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:5173";

// Sprint 7 (launch-scope.md section 12). Collection is off until
// STRIPE_TAX_COLLECTION_COUNTRIES lists a country -- see api/tax.js and
// docs/support/payments/tax.md for why it ships empty.
const TAX_CONFIG = parseTaxConfig(process.env);

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || "";

const normalizeStripeKeyMode = (value) => {
  const normalizedValue = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalizedValue === "prod" ||
    normalizedValue === "production" ||
    normalizedValue === "live"
  ) {
    return "prod";
  }

  if (
    normalizedValue === "dev" ||
    normalizedValue === "development" ||
    normalizedValue === "test"
  ) {
    return "dev";
  }

  return process.env.NODE_ENV === "production" ? "prod" : "dev";
};

const getStripeSecretKeyMode = (key) => {
  if (key.startsWith("sk_live_")) {
    return "prod";
  }

  if (key.startsWith("sk_test_")) {
    return "dev";
  }

  return null;
};

const getStripeKeyConfig = () => {
  const mode = normalizeStripeKeyMode(process.env.STRIPE_KEY_MODE);

  const secretKey =
    mode === "prod"
      ? process.env.STRIPE_SECRET_KEY_PROD || ""
      : process.env.STRIPE_SECRET_KEY_DEV || "";

  const webhookSecret =
    mode === "prod"
      ? process.env.STRIPE_WEBHOOK_SECRET_PROD || ""
      : process.env.STRIPE_WEBHOOK_SECRET_DEV || "";

  // Sprint 9: the v2 thin-event destination (Accounts v2 state changes) is a
  // separate Stripe event destination with its own signing secret.
  const accountEventsWebhookSecret =
    mode === "prod"
      ? process.env.STRIPE_ACCOUNT_EVENTS_WEBHOOK_SECRET_PROD || ""
      : process.env.STRIPE_ACCOUNT_EVENTS_WEBHOOK_SECRET_DEV || "";

  const detectedSecretKeyMode = getStripeSecretKeyMode(secretKey);

  if (
    secretKey &&
    detectedSecretKeyMode &&
    detectedSecretKeyMode !== mode
  ) {
    throw new Error(
      `Stripe secret key mode mismatch. STRIPE_KEY_MODE is "${mode}" but the selected key is "${detectedSecretKeyMode}".`,
    );
  }

  return {
    mode,
    secretKey,
    webhookSecret,
    accountEventsWebhookSecret,
  };
};

const STRIPE_KEY_CONFIG = getStripeKeyConfig();

const STRIPE_KEY_MODE = STRIPE_KEY_CONFIG.mode;
const STRIPE_SECRET_KEY = STRIPE_KEY_CONFIG.secretKey;
const STRIPE_WEBHOOK_SECRET = STRIPE_KEY_CONFIG.webhookSecret;
const STRIPE_ACCOUNT_EVENTS_WEBHOOK_SECRET =
  STRIPE_KEY_CONFIG.accountEventsWebhookSecret;

// Sprint 9: Cloud Scheduler authenticates to /api/internal/ops/* with this
// bearer secret (at least 32 characters; unset refuses every call).
// OPS_ALERT_EMAIL receives the alert digest. See
// docs/support/operations/alerting.md.
const OPS_CRON_SECRET = process.env.OPS_CRON_SECRET || "";
const OPS_ALERT_EMAIL = process.env.OPS_ALERT_EMAIL || "ops@madeforstream.com";
const OPS_RESYNC_BATCH_SIZE = Math.min(
  Math.max(Number(process.env.OPS_RESYNC_BATCH_SIZE) || 100, 1),
  500,
);
const STRIPE_CONNECT_SETUP_URL =
  process.env.STRIPE_CONNECT_SETUP_URL || "https://dashboard.stripe.com/connect";
const STRIPE_CHECKOUT_RETURN_PATH =
  process.env.STRIPE_CHECKOUT_RETURN_PATH || "/payments/return";

// APP_ORIGINS is a comma-separated list, for when the frontend is served
// from more than one valid origin (www + apex, staging, a preview
// deployment). Falls back to the single APP_ORIGIN value so existing
// single-origin configuration keeps working unchanged.
const APP_ORIGINS = String(process.env.APP_ORIGINS || APP_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const LOCAL_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const ALLOWED_ORIGINS = Array.from(
  new Set([...APP_ORIGINS, ...LOCAL_DEV_ORIGINS].filter(Boolean)),
);

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

// Allow local dev
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
  }),
);

app.options("*", cors());

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;
    let webhookEventId = null;

    try {
      const stripeClient = requireStripe();
      const webhookSecret = requireStripeWebhookSecret();
      const signature = req.headers["stripe-signature"];

      event = stripeClient.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret,
      );

      const recordedEvent =
        await recordStripeWebhookEventStart(event);

      if (!recordedEvent.shouldProcess) {
        return res.json({
          received: true,
          duplicate: true,
          status: "already_processed",
        });
      }

      webhookEventId = recordedEvent.id;

      const processingStatus = await processStripeWebhookEvent(event);

      await markStripeWebhookEventProcessed(webhookEventId, processingStatus);

      return res.json({ received: true, status: processingStatus });
    } catch (err) {
      const message = String(err?.message || err);

      await markStripeWebhookEventFailed(webhookEventId, message);

      return res.status(400).json({
        error: message,
      });
    }
  },
);

// Sprint 9: Stripe Accounts v2 state changes arrive as thin events on their
// own event destination ("Events from: Your account"), signed with
// STRIPE_ACCOUNT_EVENTS_WEBHOOK_SECRET_*. The notification only names the
// account; the handler fetches the event (to confirm it) and then the
// account's current state, so the order and number of deliveries do not
// matter. Deduplicated through stripe_webhook_events like the v1 webhook.
// Playbook: docs/support/payments/connect-onboarding.md (CON-003, CON-006).
app.post(
  "/api/stripe/account-events",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let webhookEventId = null;

    try {
      const stripeClient = requireStripe();

      if (!STRIPE_ACCOUNT_EVENTS_WEBHOOK_SECRET) {
        throw new Error(
          `Stripe ${STRIPE_KEY_MODE} account events webhook secret is not configured.`,
        );
      }

      const notification = stripeClient.parseEventNotification(
        req.body,
        req.headers["stripe-signature"],
        STRIPE_ACCOUNT_EVENTS_WEBHOOK_SECRET,
      );

      if (!supabaseAdmin) {
        throw new Error("Supabase admin not configured");
      }

      const decision = classifyConnectAccountEvent(notification);

      const recordedEvent = await recordStripeWebhookEventStart({
        id: notification.id,
        object: "v2.core.event",
        type: notification.type,
        created: notification.created,
        livemode: notification.livemode,
        related_object: notification.related_object ?? null,
        account: decision.stripeAccountId ?? null,
      });

      if (!recordedEvent.shouldProcess) {
        return res.json({
          received: true,
          duplicate: true,
          status: "already_processed",
        });
      }

      webhookEventId = recordedEvent.id;

      if (decision.action !== "resync") {
        await markStripeWebhookEventProcessed(webhookEventId, "ignored");
        return res.json({ received: true, status: "ignored" });
      }

      const event = await stripeClient.v2.core.events.retrieve(notification.id);

      if (
        event?.type !== notification.type ||
        event?.related_object?.id !== decision.stripeAccountId
      ) {
        throw new Error(
          `CON-006: account event ${notification.id} did not match its notification.`,
        );
      }

      const { data: existing, error } = await supabaseAdmin
        .from("creator_payment_accounts")
        .select("*")
        .eq("provider", "stripe")
        .eq("stripe_account_id", decision.stripeAccountId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      // Not one of ours, or not recorded yet: onboarding writes the row
      // right after creating the account, and the resync covers any gap.
      if (!existing) {
        await markStripeWebhookEventProcessed(webhookEventId, "ignored");
        return res.json({ received: true, status: "ignored" });
      }

      await resyncCreatorPaymentAccountFromStripe({
        stripeClient,
        existing,
        source: notification.type,
      });

      await markStripeWebhookEventProcessed(webhookEventId, "processed");

      return res.json({ received: true, status: "processed" });
    } catch (err) {
      const message = String(err?.message || err);

      await markStripeWebhookEventFailed(webhookEventId, message);

      return res.status(400).json({
        error: message,
      });
    }
  },
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "made-for-stream-api",
  });
});

// Reference rates for showing approximate prices in a visitor's currency.
// Public and display-only: see api/exchangeRates.js.
app.get("/api/exchange-rates", async (_req, res) => {
  const rates = await getExchangeRates();

  if (!rates) {
    return res.status(503).json({ error: "Exchange rates are not available right now." });
  }

  res.set("Cache-Control", "public, max-age=3600");

  return res.json(rates);
});

app.get("/api/stripe/config", (_req, res) => {
  res.json({
    mode: STRIPE_KEY_MODE,
    hasSecretKey: Boolean(STRIPE_SECRET_KEY),
    hasWebhookSecret: Boolean(STRIPE_WEBHOOK_SECRET),
  });
});

let cachedToken = null;
let cachedTokenExpMs = 0;

// Cache config
const STREAMS_CACHE_TTL_MS = 15_000;
const STREAMS_CACHE_MAX = 250;

const USERS_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const USERS_CACHE_MAX = 500;

const CACHE_CLEANUP_INTERVAL_MS = 60_000; // 1 minute

// Caches
const streamsCache = new Map(); // key -> { expMs, value }
const streamsInflight = new Map(); // key -> Promise<value>

const usersCache = new Map();
const usersInflight = new Map();

const nowMs = () => Date.now();

const normalizeLogins = (loginsParam) => {
  return String(loginsParam || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .sort()
    .slice(0, 100);
};

const pruneOldest = (cache, maxEntries) => {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
};

const cleanupExpired = (cache) => {
  const now = nowMs();
  for (const [key, entry] of cache.entries()) {
    if (!entry || typeof entry.expMs !== "number" || now > entry.expMs) {
      cache.delete(key);
    }
  }
};

// Touch-on-hit: moves the entry to the end of the Map so hot keys are kept longer
const getCached = (cache, key) => {
  const hit = cache.get(key);
  if (!hit) return null;

  if (nowMs() > hit.expMs) {
    cache.delete(key);
    return null;
  }

  // LRU-ish behavior: reinsert to refresh insertion order
  cache.delete(key);
  cache.set(key, hit);

  return hit.value;
};

const setCached = (cache, key, value, ttlMs, maxEntries) => {
  cache.set(key, { expMs: nowMs() + ttlMs, value });
  pruneOldest(cache, maxEntries);
};

const getOrSetInflight = async (cache, inflight, key, ttlMs, maxEntries, fetcher) => {
  const cached = getCached(cache, key);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    const value = await fetcher();
    setCached(cache, key, value, ttlMs, maxEntries);
    return value;
  })();

  inflight.set(key, p);

  try {
    return await p;
  } finally {
    inflight.delete(key);
  }
};

const getBearerToken = (req) => {
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
};

const requireSupabaseUserId = async (req) => {
  if (!supabaseAdmin) throw new Error("Supabase admin not configured");

  const token = getBearerToken(req);
  if (!token) throw new Error("Missing Authorization bearer token");

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) throw new Error("Invalid session");

  return data.user.id;
};

// Every existing admin write in this codebase goes through a security
// definer RPC that checks admin_roles itself (see AdminPaymentIssues.tsx's
// hooks). The refund route is the first admin action that has to call the
// live Stripe API directly, which only api/server.js can do -- so it needs
// its own admin check here rather than relying on an RPC's internal one.
const requireAdminUserId = async (req) => {
  const userId = await requireSupabaseUserId(req);

  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("admin_roles")
    .select("profile_user_id")
    .eq("profile_user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Administrator access is required.");
  }

  return userId;
};

const requireStripe = () => {
  if (!stripe) {
    throw new Error(
      `Stripe ${STRIPE_KEY_MODE} secret key is not configured.`,
    );
  }

  return stripe;
};

const requireStripeWebhookSecret = () => {
  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      `Stripe ${STRIPE_KEY_MODE} webhook secret is not configured.`,
    );
  }

  return STRIPE_WEBHOOK_SECRET;
};

// Returns the connected Stripe account that emitted a Connect event.
const getStripeEventAccountId = (event) =>
  typeof event?.account === "string" && event.account.trim()
    ? event.account.trim()
    : null;

// Use Stripe's event timestamp for payment lifecycle timestamps.
const getStripeEventTimestamp = (event) =>
  new Date(
    (event?.created || Math.floor(Date.now() / 1000)) * 1000,
  ).toISOString();

// Payment ids are stored in Stripe metadata.
// Checkout Sessions also use client_reference_id as a fallback.
const getPaymentIdFromStripeObject = (stripeObject) =>
  String(
    stripeObject?.metadata?.creatorhub_payment_id ||
    stripeObject?.client_reference_id ||
    "",
  ).trim();

const getPaymentIntentIdFromCheckoutSession = (session) => {
  if (typeof session?.payment_intent === "string") {
    return session.payment_intent;
  }

  return session?.payment_intent?.id || null;
};

const getNextStripeEventIds = (payment, eventId) =>
  Array.from(
    new Set([
      ...(payment?.stripe_event_ids || []),
      eventId,
    ]),
  );

// The Checkout Session and PaymentIntent webhook payloads carry a payment
// intent id but not the charge or application fee ids -- those live on the
// Charge, which has to be fetched separately. Retrieved once per paid event,
// on the connected account the charge actually belongs to.
const getChargeDetailsFromPaymentIntent = async ({
  stripeClient,
  paymentIntentId,
  stripeAccountId,
}) => {
  if (!paymentIntentId) {
    return { chargeId: null, applicationFeeId: null };
  }

  const paymentIntent = await stripeClient.paymentIntents.retrieve(
    paymentIntentId,
    { expand: ["latest_charge"] },
    stripeAccountId ? { stripeAccount: stripeAccountId } : undefined,
  );

  const charge = paymentIntent.latest_charge;

  const chargeId =
    typeof charge === "string" ? charge : charge?.id || null;

  const applicationFeeId =
    charge && typeof charge === "object"
      ? typeof charge.application_fee === "string"
        ? charge.application_fee
        : charge.application_fee?.id || null
      : null;

  // Sprint 7: post-payment buyer location evidence (docs/support/payments/tax.md).
  const cardCountry =
    charge && typeof charge === "object"
      ? normalizeTaxCountry(charge.payment_method_details?.card?.country)
      : null;

  const billingCountry =
    charge && typeof charge === "object"
      ? normalizeTaxCountry(charge.billing_details?.address?.country)
      : null;

  return { chargeId, applicationFeeId, cardCountry, billingCountry };
};

// Record every webhook before applying any business logic.
// Failed events remain retryable if Stripe sends them again.
const recordStripeWebhookEventStart = async (event) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.id,
      stripe_account_id: getStripeEventAccountId(event),
      event_type: event.type,
      processing_status: "processing",
      payload: event,
    })
    .select("id, processing_status")
    .single();

  if (!error) {
    return {
      duplicate: false,
      shouldProcess: true,
      id: data.id,
    };
  }

  // 23505 = unique violation.
  // This means Stripe retried an event we already recorded.
  if (error.code !== "23505") {
    throw new Error(error.message);
  }

  const {
    data: existingEvent,
    error: existingEventError,
  } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id, processing_status")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existingEventError) {
    throw new Error(existingEventError.message);
  }

  if (!existingEvent?.id) {
    throw new Error(
      "Existing Stripe webhook event could not be found.",
    );
  }

  // Successfully handled events should remain idempotent.
  if (
    existingEvent.processing_status === "processed" ||
    existingEvent.processing_status === "ignored"
  ) {
    return {
      duplicate: true,
      shouldProcess: false,
      id: existingEvent.id,
    };
  }

  // A previous attempt failed or stopped part-way through.
  // Allow Stripe's retry to run the workflow again.
  const { error: retryUpdateError } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      processing_status: "processing",
      error_message: null,
      processed_at: null,
    })
    .eq("id", existingEvent.id);

  if (retryUpdateError) {
    throw new Error(retryUpdateError.message);
  }

  return {
    duplicate: true,
    shouldProcess: true,
    id: existingEvent.id,
  };
};

const markStripeWebhookEventProcessed = async (
  eventId,
  processingStatus = "processed",
) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      processing_status: processingStatus,
      error_message: null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) {
    throw new Error(error.message);
  }
};

// Do not let an error while recording the failure hide the
// original webhook processing error.
const markStripeWebhookEventFailed = async (
  eventId,
  errorMessage,
) => {
  if (!supabaseAdmin || !eventId) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("stripe_webhook_events")
    .update({
      processing_status: "failed",
      error_message: errorMessage,
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (error) {
    console.error(
      "[stripe] failed to record webhook error:",
      error.message,
    );
  }
};

// Load the internal payment row used by webhook processing.
const isListingRequestCancelled = async (listingRequestId) => {
  if (!listingRequestId) {
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from("listing_requests")
    .select("status")
    .eq("id", listingRequestId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.status === "cancelled";
};

const getPaymentWithStripeEventIds = async (paymentId) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("listing_request_payments")
    .select(
      `
      id,
      listing_request_id,
      payment_type,
      status,
      currency,
      base_amount_cents,
      creator_tip_cents,
      buyer_service_fee_cents,
      creator_platform_fee_cents,
      platform_support_cents,
      total_checkout_cents,
      stripe_event_ids,
      stripe_connected_account_id,
      stripe_checkout_session_id,
      stripe_payment_intent_id,
      stripe_charge_id,
      stripe_application_fee_id,
      tax_cents,
      tax_treatment,
      stripe_tax_calculation_id,
      stripe_tax_transaction_id,
      paid_at
    `,
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Payment record was not found.");
  }

  return data;
};

// Apply project-workflow side effects only after Stripe has
// confirmed that the ledger payment is paid.
const applyPaidListingRequestPaymentWorkflow = async ({
  paymentId,
  paymentType,
}) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const workflowRpcByPaymentType = {
    starting_payment: "apply_paid_listing_request_starting_payment",
    milestone_payment: "apply_paid_listing_request_milestone_payment",
    change_order_payment:
      "apply_paid_listing_request_change_order_payment",
    final_balance: "apply_paid_listing_request_final_balance_payment",
  };

  const rpcName = workflowRpcByPaymentType[paymentType];

  if (rpcName) {
    const { error } = await supabaseAdmin.rpc(rpcName, {
      p_listing_request_payment_id: paymentId,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  // Applies regardless of payment_type (including one_time, which has no
  // project workflow above) -- section 6.6's recovery diversion is a
  // property of the payment, not of what it unlocks.
  const { error: recoveryError } = await supabaseAdmin.rpc(
    "apply_listing_request_payment_recovery_instalment",
    { p_payment_id: paymentId },
  );

  if (recoveryError) {
    throw new Error(recoveryError.message);
  }
};

// CAN-005 (docs/support/requests/cancellation.md): a database write cannot
// reach the Stripe API, so cancellation only ever *expires* the live
// checkout session as a second, best-effort call -- there is a real window
// where a buyer who still had the old checkout page open completes payment
// after the request was already cancelled. This closes it the way the
// playbook's own "Known gaps" section says it should be closed: as a refund
// case, not a webhook-handler guard that would otherwise silently drop a
// real charge on the floor. Called instead of the normal project workflow
// once a payment lands "paid" on an already-cancelled request -- refunds
// everything (base, both fees, tip and contribution) and never unlocks any
// work.
// Defers to issueListingRequestPaymentRefund (defined further down this
// file, but already initialized by the time any request handler actually
// runs) rather than duplicating the Stripe calls here, so this path also
// gets the held-balance-first / platform-top-up handling for free -- a
// stray payment on a cancelled project is not exempt from the same
// insufficient-balance case an ordinary admin refund can hit.
const refundStrayPaymentOnCancelledRequest = async ({ payment }) => {
  await issueListingRequestPaymentRefund({
    paymentId: payment.id,
    baseRefundCents: payment.base_amount_cents,
    reason:
      "Stripe checkout completed after the listing request was already cancelled (CAN-005).",
    initiatedVia: "system_auto_refund",
    tipRefundCents: payment.creator_tip_cents,
    contributionRefundCents: payment.platform_support_cents,
    tipContributionOverrideReason: "unauthorised",
  });
};

const markListingRequestPaymentProcessingFromCheckoutSession =
  async ({ session, event }) => {
    const paymentId = getPaymentIdFromStripeObject(session);

    if (!paymentId) {
      throw new Error(
        "Stripe checkout session is missing Made for Stream payment metadata.",
      );
    }

    const payment =
      await getPaymentWithStripeEventIds(paymentId);

    // Never downgrade an already-paid payment.
    if (payment.status === "paid") {
      return;
    }

    const { error } = await supabaseAdmin
      .from("listing_request_payments")
      .update({
        status: "processing",

        stripe_connected_account_id:
          payment.stripe_connected_account_id ||
          getStripeEventAccountId(event),

        stripe_checkout_session_id:
          payment.stripe_checkout_session_id ||
          session.id,

        stripe_payment_intent_id:
          payment.stripe_payment_intent_id ||
          getPaymentIntentIdFromCheckoutSession(session),

        stripe_event_ids: getNextStripeEventIds(
          payment,
          event.id,
        ),

        processing_at: getStripeEventTimestamp(event),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (error) {
      throw new Error(error.message);
    }
  };

const markListingRequestPaymentPaidFromCheckoutSession =
  async ({ session, event }) => {
    const paymentId = getPaymentIdFromStripeObject(session);

    if (!paymentId) {
      throw new Error(
        "Stripe checkout session is missing Made for Stream payment metadata.",
      );
    }

    const payment =
      await getPaymentWithStripeEventIds(paymentId);

    const connectedAccountId =
      getStripeEventAccountId(event);

    const paymentIntentId =
      getPaymentIntentIdFromCheckoutSession(session);

    if (
      payment.stripe_checkout_session_id &&
      payment.stripe_checkout_session_id !== session.id
    ) {
      throw new Error(
        "Stripe checkout session does not match this payment.",
      );
    }

    if (
      payment.stripe_connected_account_id &&
      connectedAccountId &&
      payment.stripe_connected_account_id !==
      connectedAccountId
    ) {
      throw new Error(
        "Stripe connected account does not match this payment.",
      );
    }

    if (
      typeof session.amount_total === "number" &&
      typeof payment.total_checkout_cents === "number" &&
      session.amount_total !== payment.total_checkout_cents
    ) {
      throw new Error(
        "Stripe checkout session amount does not match this payment.",
      );
    }

    if (
      session.currency &&
      payment.currency &&
      String(session.currency).toLowerCase() !==
      String(payment.currency).toLowerCase()
    ) {
      throw new Error(
        "Stripe checkout session currency does not match this payment.",
      );
    }

    // The payment may already have been saved as paid while a
    // downstream workflow RPC failed. Retry that workflow, and backfill
    // the charge handle if an earlier attempt landed before it was added.
    if (payment.status === "paid") {
      if (!payment.stripe_charge_id) {
        await backfillChargeDetailsForPayment({
          payment,
          connectedAccountId,
          paymentIntentId,
        });
      }

      await finalizePaidPaymentTaxBestEffort({ payment, chargeDetails: null });

      if (await isListingRequestCancelled(payment.listing_request_id)) {
        await refundStrayPaymentOnCancelledRequest({
          payment: await getPaymentWithStripeEventIds(payment.id),
        });

        return;
      }

      await applyPaidListingRequestPaymentWorkflow({
        paymentId: payment.id,
        paymentType: payment.payment_type,
      });

      return;
    }

    const stripeAccountId =
      payment.stripe_connected_account_id || connectedAccountId;

    const chargeDetails =
      await getChargeDetailsFromPaymentIntent({
        stripeClient: requireStripe(),
        paymentIntentId,
        stripeAccountId,
      });

    const { chargeId, applicationFeeId } = chargeDetails;

    const { error } = await supabaseAdmin
      .from("listing_request_payments")
      .update({
        status: "paid",

        stripe_connected_account_id: stripeAccountId,

        stripe_checkout_session_id: session.id,

        stripe_payment_intent_id:
          payment.stripe_payment_intent_id ||
          paymentIntentId,

        stripe_charge_id:
          payment.stripe_charge_id || chargeId,

        stripe_application_fee_id:
          payment.stripe_application_fee_id || applicationFeeId,

        stripe_event_ids: getNextStripeEventIds(
          payment,
          event.id,
        ),

        paid_at:
          payment.paid_at ||
          getStripeEventTimestamp(event),

        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (error) {
      throw new Error(error.message);
    }

    // Before the stray-payment refund below, so a refund of a taxed payment
    // always has a Stripe Tax transaction to reverse.
    await finalizePaidPaymentTaxBestEffort({
      payment: { ...payment, status: "paid" },
      chargeDetails,
    });

    if (await isListingRequestCancelled(payment.listing_request_id)) {
      await refundStrayPaymentOnCancelledRequest({
        payment: await getPaymentWithStripeEventIds(payment.id),
      });

      return;
    }

    // Fire-and-forget: this is the first time this payment has been
    // recorded as paid (the payment.status === "paid" branch above is the
    // retry path and does not resend). Never awaited into the response --
    // a slow or failing send must not delay confirming the payment.
    sendPaymentReceiptEmailBestEffort({ payment });
    // The creator's "the buyer paid" email was queued by the database when
    // the payment turned paid. Not awaited, for the same reason.
    void drainListingRequestNotifications();

    await applyPaidListingRequestPaymentWorkflow({
      paymentId: payment.id,
      paymentType: payment.payment_type,
    });
  };

// Sprint 7 (launch-scope.md section 12): once a payment is paid, record
// the post-payment location evidence (card issuing country, Checkout
// billing country) and, for a taxed payment, commit the Stripe Tax
// calculation as a transaction on the platform account -- which is what
// puts it in Stripe Tax's filing exports. Never throws: the payment is
// already taken, and a failure here is a reconciliation item (TAX-003 /
// TAX-002 in docs/support/payments/tax.md), not a reason to fail the
// webhook and block the project workflow. chargeDetails is null on the
// webhook retry path, which only retries the transaction.
const finalizePaidPaymentTaxBestEffort = async ({ payment, chargeDetails }) => {
  try {
    const evidence = chargeDetails
      ? [
          [
            "card_issuer",
            chargeDetails.cardCountry,
            "stripe_charge.payment_method_details.card.country",
          ],
          [
            "billing_address_checkout",
            chargeDetails.billingCountry,
            "stripe_charge.billing_details.address.country",
          ],
        ]
      : [];

    for (const [evidenceType, country, source] of evidence) {
      if (!country) {
        continue;
      }

      const { error } = await supabaseAdmin.rpc(
        "record_listing_request_payment_tax_evidence",
        {
          p_payment_id: payment.id,
          p_evidence_type: evidenceType,
          p_country_code: country,
          p_source: source,
        },
      );

      if (error) {
        console.error(
          `TAX-002: recording ${evidenceType} evidence failed for payment ${payment.id}: ${error.message}`,
        );
      }
    }

    if (
      payment.tax_treatment !== "calculated" ||
      !payment.stripe_tax_calculation_id ||
      payment.stripe_tax_transaction_id
    ) {
      return;
    }

    // Platform account: no stripeAccount option (see api/tax.js).
    const transaction = await requireStripe().tax.transactions.createFromCalculation(
      {
        calculation: payment.stripe_tax_calculation_id,
        reference: payment.id,
        metadata: { creatorhub_payment_id: payment.id },
      },
      { idempotencyKey: `tax_transaction_${payment.id}` },
    );

    const { error } = await supabaseAdmin.rpc(
      "set_listing_request_payment_tax_transaction",
      {
        p_payment_id: payment.id,
        p_stripe_tax_transaction_id: transaction.id,
      },
    );

    if (error) {
      throw new Error(error.message);
    }
  } catch (err) {
    console.error(
      `TAX-003: finalizing tax for payment ${payment.id} failed:`,
      err?.message || err,
    );
  }
};

// A paid payment whose charge handle never got recorded -- an earlier
// webhook attempt that landed before this column was populated, or one
// that raced with a failure between the two writes. Never regresses
// paid_at, status or any other column; only fills the two Stripe ids.
const backfillChargeDetailsForPayment = async ({
  payment,
  connectedAccountId,
  paymentIntentId,
}) => {
  const stripeAccountId =
    payment.stripe_connected_account_id || connectedAccountId;

  const effectivePaymentIntentId =
    payment.stripe_payment_intent_id || paymentIntentId;

  const { chargeId, applicationFeeId } =
    await getChargeDetailsFromPaymentIntent({
      stripeClient: requireStripe(),
      paymentIntentId: effectivePaymentIntentId,
      stripeAccountId,
    });

  if (!chargeId) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("listing_request_payments")
    .update({
      stripe_charge_id: chargeId,
      stripe_application_fee_id: applicationFeeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .is("stripe_charge_id", null);

  if (error) {
    throw new Error(error.message);
  }
};

// Sprint 6 (launch-scope.md section 7.1): shared email helpers. Every call
// site wraps these so a delivery failure never blocks the payment/workflow
// it is attached to -- see api/email.js's own "never throws" contract for
// sendTransactionalEmail; getListingRequestRecipientEmail is the one piece
// here that can throw (no email on file), so it's caught at each call site.
const getListingRequestUrl = (listingRequestId, viewer) =>
  buildListingRequestUrl(APP_ORIGIN, listingRequestId, viewer);

// Sends the commission notifications waiting in
// public.listing_request_notifications (20261007_148). The database wrote
// them; this only turns each row into an email and records what happened.
// Safe to run from several places at once: claim_listing_request_notifications
// hands each row to one caller only. Never throws.
const drainListingRequestNotifications = async ({ limit = 25 } = {}) => {
  const outcome = { sent: 0, failed: 0 };

  try {
    if (!supabaseAdmin) {
      throw new Error("Supabase admin not configured");
    }

    const { data: rows, error } = await supabaseAdmin.rpc(
      "claim_listing_request_notifications",
      { p_limit: limit },
    );

    if (error) {
      throw new Error(error.message);
    }

    for (const row of rows || []) {
      let result;

      try {
        // A chat email about an inquiry has no commission behind it.
        let request = null;

        if (row.listing_request_id) {
          const { data, error: requestError } = await supabaseAdmin
            .from("listing_requests")
            .select("id, request_title, buyer_user_id, creator_user_id")
            .eq("id", row.listing_request_id)
            .maybeSingle();

          if (requestError || !data) {
            throw new Error(requestError?.message || "The commission no longer exists.");
          }

          request = data;
        }

        // Emails name people by their handle. Best effort: if the handles
        // cannot be read the email still goes, saying "the buyer" and "the
        // creator" as it did before.
        let names = {};

        try {
          const parties =
            request ||
            (row.conversation_id
              ? (
                  await supabaseAdmin
                    .from("conversations")
                    .select("buyer_user_id, creator_user_id")
                    .eq("id", row.conversation_id)
                    .maybeSingle()
                ).data
              : null);

          if (parties) {
            const { data: profiles } = await supabaseAdmin
              .from("profiles")
              .select("user_id, handle")
              .in("user_id", [parties.buyer_user_id, parties.creator_user_id]);

            names = getNotificationNames({
              buyerUserId: parties.buyer_user_id,
              creatorUserId: parties.creator_user_id,
              recipientUserId: row.recipient_user_id,
              handleByUserId: Object.fromEntries(
                (profiles || []).map((profile) => [profile.user_id, profile.handle]),
              ),
            });
          }
        } catch {
          names = {};
        }

        const rendered = renderNotificationEmail({
          kind: row.kind,
          requestTitle: request?.request_title,
          payload: row.payload,
          requestUrl: getNotificationUrl(APP_ORIGIN, row, request?.buyer_user_id ?? null),
          names,
        });

        if (!rendered) {
          throw new Error(`NOTIF-002: no email template for kind "${row.kind}".`);
        }

        result = await sendTransactionalEmail(supabaseAdmin, {
          to: await getSupabaseUserEmail(row.recipient_user_id),
          ...rendered,
        });
      } catch (err) {
        result = {
          status: "failed",
          providerMessageId: null,
          failedReason: String(err?.message || err),
        };
      }

      outcome[result.status === "sent" ? "sent" : "failed"] += 1;

      if (result.status !== "sent") {
        console.error(
          `NOTIF-003: ${row.kind} for commission ${row.listing_request_id || row.conversation_id} was not sent: ${result.failedReason}`,
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("listing_request_notifications")
        .update({
          email_status: result.status === "sent" ? "sent" : "failed",
          email_provider_message_id: result.providerMessageId,
          email_failed_reason: result.failedReason,
        })
        .eq("id", row.id);

      if (updateError) {
        console.error(`NOTIF-001: could not record a send: ${updateError.message}`);
      }
    }
  } catch (err) {
    console.error(`NOTIF-001: notification run failed: ${String(err?.message || err)}`);
    outcome.error = String(err?.message || err);
  }

  return outcome;
};

// Sprint 6 checklist: "Templates: payment receipt, ... The last is not
// optional once the payout hold ships (§6.3)." A receipt only makes sense
// for the buyer who paid, so this always resolves the payer's email, not
// the creator's.
const sendPaymentReceiptEmailBestEffort = async ({ payment }) => {
  try {
    const { data: request, error } = await supabaseAdmin
      .from("listing_requests")
      .select("id, buyer_user_id, request_title")
      .eq("id", payment.listing_request_id)
      .maybeSingle();

    if (error || !request) {
      return;
    }

    const email = await getSupabaseUserEmail(request.buyer_user_id);

    const { subject, html, text } = renderPaymentReceiptEmail({
      requestTitle: request.request_title || "your project",
      amountCents: payment.total_checkout_cents ?? payment.base_amount_cents,
      currency: payment.currency,
      requestUrl: getListingRequestUrl(request.id, "buyer"),
    });

    await sendTransactionalEmail(supabaseAdmin, { to: email, subject, html, text });
  } catch (err) {
    console.error("sendPaymentReceiptEmailBestEffort failed:", err?.message || err);
  }
};

const sendPayoutReleasedEmailBestEffort = async ({ payout, event }) => {
  try {
    const connectedAccountId = getStripeEventAccountId(event);

    if (!connectedAccountId) {
      return;
    }

    const { data: account, error } = await supabaseAdmin
      .from("creator_payment_accounts")
      .select("user_id")
      .eq("stripe_account_id", connectedAccountId)
      .maybeSingle();

    if (error || !account) {
      return;
    }

    const email = await getSupabaseUserEmail(account.user_id);

    const { subject, html, text } = renderPayoutReleasedEmail({
      amountCents: payout.amount,
      currency: payout.currency,
      arrivalDate: payout.arrival_date
        ? new Date(payout.arrival_date * 1000).toLocaleDateString()
        : null,
      requestUrl: `${APP_ORIGIN}/settings/profile`,
    });

    await sendTransactionalEmail(supabaseAdmin, { to: email, subject, html, text });
  } catch (err) {
    console.error("sendPayoutReleasedEmailBestEffort failed:", err?.message || err);
  }
};

const markListingRequestPaymentCancelledFromCheckoutSession =
  async ({ session, event }) => {
    const paymentId = getPaymentIdFromStripeObject(session);

    if (!paymentId) {
      throw new Error(
        "Stripe checkout session is missing Made for Stream payment metadata.",
      );
    }

    const payment =
      await getPaymentWithStripeEventIds(paymentId);

    if (payment.status === "paid") {
      return;
    }

    const { error } = await supabaseAdmin
      .from("listing_request_payments")
      .update({
        status: "cancelled",

        stripe_connected_account_id:
          payment.stripe_connected_account_id ||
          getStripeEventAccountId(event),

        stripe_checkout_session_id:
          payment.stripe_checkout_session_id ||
          session.id,

        stripe_payment_intent_id:
          payment.stripe_payment_intent_id ||
          getPaymentIntentIdFromCheckoutSession(session),

        stripe_event_ids: getNextStripeEventIds(
          payment,
          event.id,
        ),

        cancelled_at: getStripeEventTimestamp(event),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (error) {
      throw new Error(error.message);
    }
  };

const markListingRequestPaymentFailedFromPaymentIntent =
  async ({ paymentIntent, event }) => {
    const paymentId =
      getPaymentIdFromStripeObject(paymentIntent);

    // Stripe may send PaymentIntent events unrelated to
    // Made for Stream's payment ledger.
    if (!paymentId) {
      return;
    }

    const payment =
      await getPaymentWithStripeEventIds(paymentId);

    if (payment.status === "paid") {
      return;
    }

    const { error } = await supabaseAdmin
      .from("listing_request_payments")
      .update({
        status: "failed",

        stripe_connected_account_id:
          payment.stripe_connected_account_id ||
          getStripeEventAccountId(event),

        stripe_payment_intent_id:
          payment.stripe_payment_intent_id ||
          paymentIntent.id,

        stripe_event_ids: getNextStripeEventIds(
          payment,
          event.id,
        ),

        failed_at: getStripeEventTimestamp(event),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    if (error) {
      throw new Error(error.message);
    }
  };

// Look up the internal payment row a Charge or Dispute webhook event is
// about. Charges created from a PaymentIntent inherit its metadata, so the
// same creatorhub_payment_id lookup used everywhere else usually works --
// but a charge.refunded can arrive before checkout.session.completed has
// had a chance to record stripe_charge_id on our row (Stripe does not
// guarantee event order), so this also matches on the charge id itself for
// any row that already has it.
const getPaymentForStripeChargeEvent = async (chargeObjectOrId) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const chargeId =
    typeof chargeObjectOrId === "string"
      ? chargeObjectOrId
      : chargeObjectOrId?.id || null;

  const selectColumns = `
    id,
    payment_type,
    status,
    stripe_event_ids,
    stripe_refund_id,
    stripe_dispute_id,
    refunded_at,
    disputed_at
  `;

  if (chargeId) {
    const { data, error } = await supabaseAdmin
      .from("listing_request_payments")
      .select(selectColumns)
      .eq("stripe_charge_id", chargeId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data;
    }
  }

  const paymentId =
    typeof chargeObjectOrId === "object"
      ? getPaymentIdFromStripeObject(chargeObjectOrId)
      : "";

  if (!paymentId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("listing_request_payments")
    .select(selectColumns)
    .eq("id", paymentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

// Sprint 5: the refund ledger and apply_refunded_listing_request_payment
// (launch-scope.md section 6.2) mean this can now do a real reconciling
// write instead of only recording a pointer. Two cases:
//
//  - The refund was issued through this app's own admin route, which
//    already called apply_refunded_listing_request_payment synchronously
//    with the precise base/fee/tip/contribution split before this event
//    ever arrived. The RPC's stripe_refund_id idempotency check makes this
//    a no-op -- the ledger row already exists.
//  - The refund was issued by hand in Stripe (REF-002's whole scenario).
//    There is no stored intent to read a split from, so the entire refund
//    amount is attributed to base -- a best-effort figure, not a known one.
//    initiated_via = 'webhook_external' keeps this distinguishable in the
//    ledger from a refund this app actually decided on, and the amount
//    should be spot-checked against Stripe directly (same as REF-002 always
//    recommended) rather than trusted as an exact fee split.
const recordChargeRefundedFromWebhook = async ({ charge, event }) => {
  const payment = await getPaymentForStripeChargeEvent(charge);

  if (!payment) {
    return;
  }

  if ((payment.stripe_event_ids || []).includes(event.id)) {
    return;
  }

  const latestRefund = charge.refunds?.data?.[0] || null;
  const refundAmountCents =
    typeof latestRefund?.amount === "number"
      ? latestRefund.amount
      : charge.amount_refunded;

  if (latestRefund?.id && Number.isFinite(refundAmountCents) && refundAmountCents > 0) {
    const { error: applyError } = await supabaseAdmin.rpc(
      "apply_refunded_listing_request_payment",
      {
        p_payment_id: payment.id,
        p_base_refund_cents: refundAmountCents,
        p_stripe_refund_id: latestRefund.id,
        p_reason: "Recorded from a Stripe charge.refunded event.",
        p_initiated_via: "webhook_external",
      },
    );

    // A refund this app already recorded (admin route or an earlier
    // delivery of this same event) or one whose amount can no longer be
    // applied (e.g. already fully refunded by other means) should not fail
    // the whole webhook -- the event-id dedupe below still needs to write
    // so a retry does not loop forever. Real, unexpected apply failures are
    // still visible in the webhook_events processing log for REF-002-style
    // investigation.
    if (applyError) {
      console.error(
        `charge.refunded: apply_refunded_listing_request_payment failed for payment ${payment.id}: ${applyError.message}`,
      );
    }
  }

  const { error } = await supabaseAdmin
    .from("listing_request_payments")
    .update({
      stripe_event_ids: getNextStripeEventIds(payment, event.id),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (error) {
    throw new Error(error.message);
  }
};

const recordChargeDisputeCreatedFromWebhook = async ({ dispute, event }) => {
  const payment = await getPaymentForStripeChargeEvent(dispute.charge);

  if (!payment) {
    return;
  }

  if ((payment.stripe_event_ids || []).includes(event.id)) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("listing_request_payments")
    .update({
      stripe_dispute_id: dispute.id,
      disputed_at: payment.disputed_at || getStripeEventTimestamp(event),
      stripe_event_ids: getNextStripeEventIds(payment, event.id),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (error) {
    throw new Error(error.message);
  }
};

// Closed just records that the event was seen -- launch-scope.md section 6.1
// scopes automated dispute response as out, and the outcome (won/lost, any
// refund already issued) is read live from Stripe on the admin surface
// rather than mirrored into a column here, so there is nothing derived to
// get out of step in the meantime.
const recordChargeDisputeClosedFromWebhook = async ({ dispute, event }) => {
  const payment = await getPaymentForStripeChargeEvent(dispute.charge);

  if (!payment) {
    return;
  }

  if ((payment.stripe_event_ids || []).includes(event.id)) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("listing_request_payments")
    .update({
      stripe_event_ids: getNextStripeEventIds(payment, event.id),
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  if (error) {
    throw new Error(error.message);
  }
};

// A recovery settlement session carries creatorhub_recovery_settlement_id
// instead of creatorhub_payment_id -- it is not a listing_request_payments
// row at all, so it needs its own webhook path rather than going through
// getPaymentIdFromStripeObject.
const getRecoverySettlementIdFromStripeObject = (stripeObject) =>
  typeof stripeObject?.metadata?.creatorhub_recovery_settlement_id ===
    "string"
    ? stripeObject.metadata.creatorhub_recovery_settlement_id
    : null;

const applyPaidCreatorRecoverySettlementFromCheckoutSession = async ({
  session,
}) => {
  const settlementId = getRecoverySettlementIdFromStripeObject(session);

  if (!settlementId) {
    return false;
  }

  const { error } = await supabaseAdmin.rpc(
    "apply_paid_creator_recovery_settlement",
    { p_settlement_id: settlementId },
  );

  if (error) {
    throw new Error(error.message);
  }

  return true;
};

const processStripeWebhookEvent = async (event) => {
  const stripeObject = event.data.object;

  if (event.type === "checkout.session.completed") {
    if (getRecoverySettlementIdFromStripeObject(stripeObject)) {
      if (stripeObject.payment_status === "paid") {
        await applyPaidCreatorRecoverySettlementFromCheckoutSession({
          session: stripeObject,
        });
      }

      return "processed";
    }

    if (stripeObject.payment_status === "paid") {
      await markListingRequestPaymentPaidFromCheckoutSession({
        session: stripeObject,
        event,
      });
    } else {
      await markListingRequestPaymentProcessingFromCheckoutSession(
        {
          session: stripeObject,
          event,
        },
      );
    }

    return "processed";
  }

  if (
    event.type ===
    "checkout.session.async_payment_succeeded"
  ) {
    await markListingRequestPaymentPaidFromCheckoutSession({
      session: stripeObject,
      event,
    });

    return "processed";
  }

  if (event.type === "checkout.session.expired") {
    await markListingRequestPaymentCancelledFromCheckoutSession(
      {
        session: stripeObject,
        event,
      },
    );

    return "processed";
  }

  if (event.type === "payment_intent.payment_failed") {
    await markListingRequestPaymentFailedFromPaymentIntent({
      paymentIntent: stripeObject,
      event,
    });

    return "processed";
  }

  if (event.type === "charge.refunded") {
    await recordChargeRefundedFromWebhook({
      charge: stripeObject,
      event,
    });

    return "processed";
  }

  if (event.type === "charge.dispute.created") {
    await recordChargeDisputeCreatedFromWebhook({
      dispute: stripeObject,
      event,
    });

    return "processed";
  }

  if (event.type === "charge.dispute.closed") {
    await recordChargeDisputeClosedFromWebhook({
      dispute: stripeObject,
      event,
    });

    return "processed";
  }

  // Sprint 6 checklist: "Templates: ... payout released. The last is not
  // optional once the payout hold ships (§6.3)." Section 6.3 found that the
  // hold is Stripe's own account-level payout schedule, not something this
  // app tracks or releases itself (docs/launch-scope.md section 6.3) -- so
  // the only real signal that a payout has actually gone out is Stripe's
  // own payout.paid event on the connected account. This requires the
  // webhook endpoint to be receiving Connect (not just platform-account)
  // events, which is a Stripe Dashboard setting the checklist flags as
  // needing confirmation -- see docs/support/messaging/transactional-email.md.
  if (event.type === "payout.paid") {
    await sendPayoutReleasedEmailBestEffort({ payout: stripeObject, event });
    return "processed";
  }

  return "ignored";
};

const normalizeCountryCode = (value) => {
  const country = String(value || "")
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{2}$/.test(country)) {
    throw new Error("A valid two-letter country code is required.");
  }

  return country;
};

const normalizeCurrencyCode = (value, fallback = "usd") => {
  const currency = String(value || fallback)
    .trim()
    .toLowerCase();

  if (!/^[a-z]{3}$/.test(currency)) {
    throw new Error("A valid three-letter currency code is required.");
  }

  return currency;
};

const requireApprovedCreator = async (userId) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("seller_applications")
    .select("id")
    .eq("profile_user_id", userId)
    .eq("status", "approved")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Only approved creators can connect Stripe payouts.");
  }
};

const getExistingCreatorPaymentAccount = async (userId) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("creator_payment_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "stripe")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

// Every write to creator_payment_accounts goes through
// buildCreatorPaymentAccountPatch (api/connectAccountState.js) -- the one
// mapping from a v2 Account shared by the settings sync, onboarding, the
// thin-event handler and the scheduled resync. `observedAt` must be taken
// before the Stripe read that produced `stripeAccount`: the database
// (20260924_139) keeps the newer observation when two writes race.
const upsertCreatorPaymentAccount = async ({
  userId,
  stripeAccount,
  country,
  defaultCurrency,
  onboardingStartedAt,
  observedAt,
  existing = null,
}) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const patch = buildCreatorPaymentAccountPatch({
    userId,
    stripeAccount,
    country: normalizeCountryCode(country),
    defaultCurrency: normalizeCurrencyCode(defaultCurrency),
    onboardingStartedAt,
    observedAt,
    existing,
  });

  const { data, error } = await supabaseAdmin
    .from("creator_payment_accounts")
    .upsert(patch, {
      onConflict: "user_id,provider",
    })
    .select(
      "id, user_id, provider, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, country, default_currency, onboarding_started_at, onboarding_completed_at, last_synced_at, stripe_state_observed_at, readiness_lost_at, requirements_due_count, requirements_past_due_count",
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

// Re-reads one creator's account from Stripe and records it. Used by the
// settings sync, the thin-event handler and the scheduled resync, so all
// three record exactly the same thing. A replayed or late event only ever
// triggers a fresh read, and the database refuses an older read that lands
// after a newer one, so nothing here can move an account backwards.
const resyncCreatorPaymentAccountFromStripe = async ({
  stripeClient,
  existing,
  source,
}) => {
  const observedAt = new Date().toISOString();

  const stripeAccount = await stripeClient.v2.core.accounts.retrieve(
    existing.stripe_account_id,
    { include: CONNECT_ACCOUNT_RETRIEVE_INCLUDE },
  );

  const account = await upsertCreatorPaymentAccount({
    userId: existing.user_id,
    stripeAccount,
    country: existing.country,
    defaultCurrency: existing.default_currency,
    onboardingStartedAt: existing.onboarding_started_at,
    observedAt,
    existing,
  });

  // CON-003's API signal. The hourly alert run emails it while the creator
  // still has live listings.
  if (didCreatorPaymentAccountLoseReadiness(existing, account)) {
    console.warn(
      `CON-003: creator payment account ${existing.stripe_account_id} lost readiness (source=${source}, charges_enabled=${account.charges_enabled}, payouts_enabled=${account.payouts_enabled}, details_submitted=${account.details_submitted}, requirements_past_due=${account.requirements_past_due_count})`,
    );
  }

  return account;
};

// The account already has an email on file as a Supabase auth user; v2
// accounts require contact_email whenever a recipient configuration
// (payouts) is requested, so this has to be resolved before account
// creation rather than left blank.
const getSupabaseUserEmail = async (userId) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error) {
    throw new Error(error.message);
  }

  const email = data?.user?.email;

  if (!email) {
    throw new Error("This account has no email on file to connect Stripe payouts.");
  }

  return email;
};

// Payout timing (launch-scope.md section 6.3). Balance Settings is a
// separate v2-era endpoint from account creation, addressed with the
// account's own Stripe-Account header. Only interval is set: overriding
// settlement_timing.delay_days_override is restricted to platforms that own
// fraud/dispute liability, and this platform's defaults.responsibilities
// deliberately leave losses_collector as "stripe" (2026-09-22 decision) --
// confirmed live that delay_days_override is rejected under that
// configuration ("You cannot change ... via API once an account has been
// activated"), so the actual delay is whatever Stripe assigns for the
// account's country rather than a guaranteed 14 days.
const setStripeConnectDailyPayoutSchedule = async ({
  stripeClient,
  accountId,
}) => {
  await stripeClient.balanceSettings.update(
    {
      payments: {
        payouts: {
          schedule: {
            interval: "daily",
          },
        },
      },
    },
    { stripeAccount: accountId },
  );
};

// CON-009: answers true (and has replied) when Stripe no longer has the
// creator's account.
const respondIfStripeAccountGone = (res, err, route) => {
  if (!isStripeAccountGoneError(err)) {
    return false;
  }

  console.warn(
    `CON-009: Stripe account is closed or missing (route=${route}): ${String(err?.message || err)}`,
  );
  res.status(409).json({
    code: "stripe_account_gone",
    error: CONNECT_ACCOUNT_GONE_MESSAGE,
  });

  return true;
};

const getStripeConnectSetupRequiredResponse = (message) => {
  if (!/signed up for Connect|dashboard\.stripe\.com\/connect/i.test(message)) {
    return null;
  }

  return {
    status: 424,
    body: {
      code: "stripe_connect_platform_setup_required",
      error:
        "Made for Stream's Stripe platform account needs Connect setup before creator payout onboarding can start.",
      actionUrl: STRIPE_CONNECT_SETUP_URL,
    },
  };
};

const CHECKOUT_OPENABLE_PAYMENT_STATUSES = new Set([
  "requires_checkout",
  "checkout_opened",
  "failed",
  "cancelled",
]);

const getCheckoutReturnUrl = (paymentId) =>
  `${APP_ORIGIN}${STRIPE_CHECKOUT_RETURN_PATH}?payment_id=${encodeURIComponent(
    paymentId,
  )}&session_id={CHECKOUT_SESSION_ID}`;

// Recovery balance settlement is a straight, non-Connect charge on the
// creator's own card -- so it returns to their settings page rather than
// the buyer-facing payment-return route above.
const getRecoverySettlementReturnUrl = () =>
  `${APP_ORIGIN}/settings?recovery_settlement=1`;

const getReadyCreatorPaymentAccount = async (creatorUserId) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin not configured");
  }

  const { data, error } = await supabaseAdmin
    .from("creator_payment_accounts")
    .select(
      "stripe_account_id, charges_enabled, payouts_enabled, details_submitted, default_currency",
    )
    .eq("user_id", creatorUserId)
    .eq("provider", "stripe")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.stripe_account_id) {
    throw new Error("Creator has not connected Stripe payouts.");
  }

  if (!data.details_submitted || !data.charges_enabled || !data.payouts_enabled) {
    throw new Error("Creator Stripe account is not ready for payments.");
  }

  return data;
};

const assertCheckoutPaymentCanBeOpened = ({ payment, userId }) => {
  if (payment.payer_user_id !== userId) {
    throw new Error("Only the buyer for this payment can open checkout.");
  }

  if (!CHECKOUT_OPENABLE_PAYMENT_STATUSES.has(payment.status)) {
    throw new Error("This payment is not available for checkout.");
  }

  if (payment.base_amount_cents <= 0 || payment.total_checkout_cents <= 0) {
    throw new Error("This payment amount is invalid.");
  }

  // Backstop for public.supported_currencies (20260923_138), which refuses an
  // unsupported currency when the agreement and schedule are written.
  if (!isSupportedCurrency(payment.currency)) {
    throw new Error(getUnsupportedCurrencyMessage(payment.currency));
  }

  if (payment.application_fee_cents >= payment.total_checkout_cents) {
    throw new Error("This payment fee setup is invalid.");
  }
};

// The checkout page gates on the buyer having accepted the current refund,
// payment-terms and early-service-request policies for this listing request
// (CheckoutPolicyAcceptance.tsx). That gate is client-side only -- nothing on
// the API re-checked it before this, so it was not a real boundary
// (launch-scope.md section 11). Re-checked on every call, including a reused
// session, because an acceptance of an older version does not count once a
// policy has changed.
const assertCheckoutPoliciesAccepted = async ({ payment, userId }) => {
  const requiredPolicyTypes = Object.keys(CHECKOUT_POLICY_VERSIONS);

  const { data, error } = await supabaseAdmin
    .from("policy_acceptances")
    .select("policy_type, policy_version")
    .eq("user_id", userId)
    .eq("related_listing_request_id", payment.listing_request_id)
    .in("policy_type", requiredPolicyTypes);

  if (error) {
    throw new Error(error.message);
  }

  const missingPolicyTypes = getMissingCheckoutPolicyTypes(
    CHECKOUT_POLICY_VERSIONS,
    data || [],
  );

  if (missingPolicyTypes.length > 0) {
    throw new Error(
      `You must accept the current ${missingPolicyTypes.join(", ")} policy before checkout can open.`,
    );
  }
};

const getPaymentCheckoutTitle = (payment) => {
  const labelByType = {
    one_time: "Made for Stream one-time payment",
    starting_payment: "Made for Stream starting payment",
    milestone_payment: "Made for Stream milestone payment",
    change_order_payment: "Made for Stream change-order payment",
    final_balance: "Made for Stream final balance",
  };

  return labelByType[payment.payment_type] || "Made for Stream project payment";
};

const getStripePaymentMetadata = (payment) => ({
  creatorhub_payment_id: payment.id,
  listing_request_id: payment.listing_request_id,
  payment_type: payment.payment_type,
  related_entity_type: payment.related_entity_type || "",
  related_entity_id: payment.related_entity_id || "",
});

// Sprint 7 (launch-scope.md section 12): records the buyer's pre-payment
// location evidence, then either calculates tax with Stripe Tax (only for
// a country in STRIPE_TAX_COLLECTION_COUNTRIES) or records that none is
// collected. set_listing_request_payment_tax recomputes both totals from
// the stored lines and refuses a jurisdiction that does not match the
// buyer's recorded billing country -- the enforcement is there, not here.
const recordTaxEvidence = async (paymentId, evidenceType, country, source) => {
  const { error } = await supabaseAdmin.rpc(
    "record_listing_request_payment_tax_evidence",
    {
      p_payment_id: paymentId,
      p_evidence_type: evidenceType,
      p_country_code: country,
      p_source: source,
    },
  );

  if (error) {
    throw new Error(`Location evidence could not be recorded: ${error.message}`);
  }
};

const applyCheckoutTax = async ({ stripeClient, payment, req, userId }) => {
  if (TAX_CONFIG.configError) {
    throw new Error(TAX_CONFIG.configError);
  }

  // The buyer's billing location is the address in their private account
  // details (public.user_account_details, 20261008_150), never what the
  // checkout page sends, so it cannot be changed for one payment. Nobody
  // pays without those details.
  const { data: accountDetails, error: accountDetailsError } = await supabaseAdmin
    .from("user_account_details")
    .select("country_code, region, postal_code")
    .eq("user_id", userId)
    .maybeSingle();

  if (accountDetailsError) {
    throw new Error("Your account details could not be read. Please try again.");
  }

  const billingCountry = normalizeTaxCountry(accountDetails?.country_code);

  if (!billingCountry) {
    throw new Error("Add your account details in Settings before paying.");
  }

  const billingPostalCode =
    String(accountDetails.postal_code || "").trim().slice(0, 20) || null;
  // Stripe Tax wants a state only where it is a code (Canada and the
  // United States, where the database stores two letters).
  const billingRegion = /^[A-Z]{2}$/.test(accountDetails.region || "")
    ? accountDetails.region
    : null;

  await recordTaxEvidence(
    payment.id,
    "billing_address_declared",
    billingCountry,
    "account_details",
  );

  const ipCountry = getIpCountryFromRequest(req, TAX_CONFIG.ipCountryHeader);

  if (ipCountry) {
    await recordTaxEvidence(
      payment.id,
      "ip_address",
      ipCountry,
      `request_header:${TAX_CONFIG.ipCountryHeader}`,
    );
  }

  const taxTreatment = decideTaxTreatment(billingCountry, TAX_CONFIG);

  let taxLines = {
    tax_on_base_cents: 0,
    tax_on_buyer_fee_cents: 0,
    tax_on_tip_cents: 0,
    tax_on_support_cents: 0,
    jurisdictionRegion: billingRegion,
  };
  let calculationId = null;

  if (taxTreatment === "calculated") {
    // Platform account: no stripeAccount option (see api/tax.js for why).
    const calculation = await stripeClient.tax.calculations.create({
      currency: payment.currency,
      line_items: buildTaxCalculationLineItems(payment, TAX_CONFIG.taxCodes),
      customer_details: {
        address: {
          country: billingCountry,
          ...(billingPostalCode ? { postal_code: billingPostalCode } : {}),
          ...(billingRegion ? { state: billingRegion } : {}),
        },
        address_source: "billing",
      },
      expand: ["line_items"],
    });

    taxLines = extractTaxLinesFromCalculation(calculation);
    calculationId = calculation.id;
  }

  const { data, error } = await supabaseAdmin.rpc(
    "set_listing_request_payment_tax",
    {
      p_payment_id: payment.id,
      p_tax_treatment: taxTreatment,
      p_jurisdiction_country: billingCountry,
      p_jurisdiction_region: taxLines.jurisdictionRegion,
      p_tax_on_base_cents: taxLines.tax_on_base_cents,
      p_tax_on_buyer_fee_cents: taxLines.tax_on_buyer_fee_cents,
      p_tax_on_tip_cents: taxLines.tax_on_tip_cents,
      p_tax_on_support_cents: taxLines.tax_on_support_cents,
      p_stripe_tax_calculation_id: calculationId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

// Stripe checkout sessions are single-use and cannot be recreated, so
// reopening checkout for the same payment (a page refresh, a second
// browser tab, the buyer navigating back) should reuse the still-open
// session instead of minting a new one for every request.
const getReusableCheckoutSession = async ({
  stripeClient,
  payment,
  stripeAccountId,
}) => {
  if (!payment.stripe_checkout_session_id) {
    return null;
  }

  let existingSession;

  try {
    existingSession = await stripeClient.checkout.sessions.retrieve(
      payment.stripe_checkout_session_id,
      { stripeAccount: stripeAccountId },
    );
  } catch {
    // The session may be gone, expired past retrieval, or tied to a
    // stale connected account. Fall through and create a fresh one.
    return null;
  }

  if (existingSession.status === "complete") {
    throw new Error(
      "This payment has already been completed with Stripe. Refresh the page to see its latest status.",
    );
  }

  if (existingSession.status !== "open") {
    return null;
  }

  return existingSession;
};

const getEmbeddedConnectAccountSessionComponents = () => ({
  account_onboarding: {
    enabled: true,
    features: {
      external_account_collection: true,
    },
  },
});

const getStripeAccountIdFromCreatorPaymentAccount = (account) =>
  typeof account?.stripe_account_id === "string" &&
    account.stripe_account_id.trim().length > 0
    ? account.stripe_account_id.trim()
    : null;

const getStripeConnectAccountSummary = ({ account, existingAccount }) => ({
  stripeAccountId: account.id,
  chargesEnabled: Boolean(
    "charges_enabled" in account
      ? account.charges_enabled
      : existingAccount?.charges_enabled,
  ),
  payoutsEnabled: Boolean(
    "payouts_enabled" in account
      ? account.payouts_enabled
      : existingAccount?.payouts_enabled,
  ),
  detailsSubmitted: Boolean(
    "details_submitted" in account
      ? account.details_submitted
      : existingAccount?.details_submitted,
  ),
  country: account.country || existingAccount?.country || null,
  defaultCurrency:
    account.default_currency || existingAccount?.default_currency || null,
});

const getOrCreateStripeAccountForEmbeddedConnect = async ({
  stripeClient,
  userId,
  country,
  defaultCurrency,
}) => {
  const existingAccount = await getExistingCreatorPaymentAccount(userId);
  const existingStripeAccountId =
    getStripeAccountIdFromCreatorPaymentAccount(existingAccount);

  if (existingStripeAccountId) {
    return {
      account: {
        id: existingStripeAccountId,
        country: existingAccount.country,
        default_currency: existingAccount.default_currency,
        charges_enabled: existingAccount.charges_enabled,
        payouts_enabled: existingAccount.payouts_enabled,
        details_submitted: existingAccount.details_submitted,
      },
      existingAccount,
      wasCreated: false,
    };
  }

  // Accounts v2, not v1 type: "express" -- this platform's own Connect
  // settings (Dashboard: Settings > Connect > Platform setup) are already
  // configured for v2: fees_collector "stripe" (the connected account bears
  // Stripe's 2.9%+0.30, not the platform) and losses_collector "stripe"
  // (Stripe, not the platform, owns fraud/dispute/negative-balance
  // liability). dashboard: "none" matches what's already built here --
  // onboarding and account management happen entirely through the embedded
  // components below, never a Stripe-hosted dashboard. See launch-scope.md
  // section 3.2 for the full 2026-09-22 correction and how this was verified
  // live against Stripe's API before being written here.
  const contactEmail = await getSupabaseUserEmail(userId);

  const observedAt = new Date().toISOString();

  const account = await stripeClient.v2.core.accounts.create({
    contact_email: contactEmail,
    identity: {
      country: country.toLowerCase(),
    },
    dashboard: "none",
    defaults: {
      currency: defaultCurrency,
      responsibilities: {
        fees_collector: "stripe",
        losses_collector: "stripe",
      },
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: {
            requested: true,
          },
        },
      },
      // "recipient" is what makes payouts to this account possible at all --
      // confirmed live that Stripe requires contact_email the moment this is
      // requested, which is why it's resolved above rather than left out.
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: {
              requested: true,
            },
          },
        },
      },
    },
    metadata: {
      creatorhub_user_id: userId,
    },
    include: CONNECT_ACCOUNT_RETRIEVE_INCLUDE,
  });

  await setStripeConnectDailyPayoutSchedule({
    stripeClient,
    accountId: account.id,
  });

  const upsertedAccount = await upsertCreatorPaymentAccount({
    userId,
    stripeAccount: account,
    country,
    defaultCurrency,
    observedAt,
  });

  return {
    account: {
      id: upsertedAccount.stripe_account_id,
      country: upsertedAccount.country,
      default_currency: upsertedAccount.default_currency,
      charges_enabled: upsertedAccount.charges_enabled,
      payouts_enabled: upsertedAccount.payouts_enabled,
      details_submitted: upsertedAccount.details_submitted,
    },
    existingAccount: null,
    wasCreated: true,
  };
};

const signState = (payload) => {
  if (!OAUTH_STATE_SECRET) throw new Error("OAUTH_STATE_SECRET missing");

  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", OAUTH_STATE_SECRET)
    .update(data)
    .digest("base64url");

  return `${data}.${sig}`;
};

const verifyState = (state) => {
  if (!OAUTH_STATE_SECRET) throw new Error("OAUTH_STATE_SECRET missing");

  const [data, sig] = String(state || "").split(".");
  if (!data || !sig) throw new Error("Bad state");

  const expected = crypto
    .createHmac("sha256", OAUTH_STATE_SECRET)
    .update(data)
    .digest("base64url");

  if (sig !== expected) throw new Error("State signature mismatch");

  const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  if (!payload?.uid || !payload?.exp) throw new Error("Bad state payload");
  if (Date.now() > payload.exp) throw new Error("State expired");

  return payload;
};

const isAtLeastOneYearOld = (createdAtIso) => {
  const createdMs = Date.parse(String(createdAtIso || ""));
  if (!Number.isFinite(createdMs)) return false;

  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
  return Date.now() - createdMs >= ONE_YEAR_MS;
};

const getTwitchAuthorizeUrl = (state) => {
  if (!TWITCH_CLIENT_ID || !TWITCH_REDIRECT_URI) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_REDIRECT_URI");
  }

  const url = new URL("https://id.twitch.tv/oauth2/authorize");
  url.searchParams.set("client_id", TWITCH_CLIENT_ID);
  url.searchParams.set("redirect_uri", TWITCH_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "user:read:email");
  url.searchParams.set("state", state);

  return url.toString();
};

const exchangeCodeForToken = async (code) => {
  if (!TWITCH_CLIENT_SECRET) throw new Error("Missing TWITCH_CLIENT_SECRET");

  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", TWITCH_CLIENT_ID);
  url.searchParams.set("client_secret", TWITCH_CLIENT_SECRET);
  url.searchParams.set("code", String(code || ""));
  url.searchParams.set("grant_type", "authorization_code");
  url.searchParams.set("redirect_uri", TWITCH_REDIRECT_URI);

  const r = await fetch(url.toString(), { method: "POST" });
  const text = await r.text();

  if (!r.ok) throw new Error(`Token exchange failed (${r.status}): ${text}`);

  const json = JSON.parse(text);
  if (!json?.access_token) throw new Error("No access_token from Twitch");

  return json.access_token;
};

const fetchTwitchMe = async (userAccessToken) => {
  const r = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      Authorization: `Bearer ${userAccessToken}`,
    },
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`Twitch users failed (${r.status}): ${text}`);

  const json = JSON.parse(text);
  const u = (json.data || [])[0];
  if (!u?.id || !u?.login) throw new Error("No Twitch user returned");

  return u;
};

const getAppAccessToken = async () => {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpMs - 30_000) return cachedToken; // 30s buffer

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET");
  }

  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", TWITCH_CLIENT_ID);
  url.searchParams.set("client_secret", TWITCH_CLIENT_SECRET);
  url.searchParams.set("grant_type", "client_credentials");

  const r = await fetch(url.toString(), { method: "POST" });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Token request failed (${r.status}): ${text}`);
  }

  const json = await r.json();
  cachedToken = json.access_token;
  cachedTokenExpMs = now + json.expires_in * 1000;
  return cachedToken;
};

// Periodic cleanup + size enforcement
const cleanupTick = () => {
  cleanupExpired(streamsCache);
  cleanupExpired(usersCache);

  // Safety: enforce hard caps even if lots of non-expired keys exist
  pruneOldest(streamsCache, STREAMS_CACHE_MAX);
  pruneOldest(usersCache, USERS_CACHE_MAX);
};

// run once on boot
cleanupTick();

// run periodically (won’t keep Node alive if nothing else is running)
const cleanupInterval = setInterval(cleanupTick, CACHE_CLEANUP_INTERVAL_MS);
if (typeof cleanupInterval.unref === "function") cleanupInterval.unref();

// GET /api/twitch/streams?logins=a,b,c
app.get("/api/twitch/streams", async (req, res) => {
  try {
    const logins = normalizeLogins(req.query.logins);
    if (logins.length === 0) return res.json({ data: [] });

    const cacheKey = `streams:${logins.join(",")}`;

    const data = await getOrSetInflight(
      streamsCache,
      streamsInflight,
      cacheKey,
      STREAMS_CACHE_TTL_MS,
      STREAMS_CACHE_MAX,
      async () => {
        const token = await getAppAccessToken();

        const url = new URL("https://api.twitch.tv/helix/streams");
        logins.forEach((login) => url.searchParams.append("user_login", login));

        const r = await fetch(url.toString(), {
          headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            Authorization: `Bearer ${token}`,
          },
        });

        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Twitch streams failed (${r.status}): ${text}`);
        }

        const json = await r.json();

        return (json.data || []).map((s) => ({
          login: s.user_login,
          displayName: s.user_name,
          isLive: true,
          title: s.title,
          gameName: s.game_name,
          viewerCount: s.viewer_count,
          startedAt: s.started_at,
          thumbnailUrl: s.thumbnail_url,
        }));
      }
    );

    res.setHeader("Cache-Control", "public, max-age=15");
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// GET /api/twitch/users?logins=a,b,c
app.get("/api/twitch/users", async (req, res) => {
  try {
    const logins = normalizeLogins(req.query.logins);
    if (logins.length === 0) return res.json({ data: [] });

    const cacheKey = `users:${logins.join(",")}`;

    const data = await getOrSetInflight(
      usersCache,
      usersInflight,
      cacheKey,
      USERS_CACHE_TTL_MS,
      USERS_CACHE_MAX,
      async () => {
        const token = await getAppAccessToken();

        const url = new URL("https://api.twitch.tv/helix/users");
        logins.forEach((login) => url.searchParams.append("login", login));

        const r = await fetch(url.toString(), {
          headers: {
            "Client-ID": TWITCH_CLIENT_ID,
            Authorization: `Bearer ${token}`,
          },
        });

        if (!r.ok) {
          const text = await r.text();
          throw new Error(`Twitch users failed (${r.status}): ${text}`);
        }

        const json = await r.json();

        return (json.data || []).map((u) => ({
          id: u.id,
          login: u.login,
          displayName: u.display_name,
          profileImageUrl: u.profile_image_url,
        }));
      }
    );

    // short browser cache; server cache is the main benefit
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.json({ data });
  } catch (err) {
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// POST /api/twitch/connect/start
app.post("/api/twitch/connect/start", async (req, res) => {
  try {
    const uid = await requireSupabaseUserId(req);

    const state = signState({
      uid,
      exp: Date.now() + 10 * 60 * 1000, // 10 min
    });

    const url = getTwitchAuthorizeUrl(state);
    return res.json({ url });
  } catch (err) {
    return res.status(401).json({ error: String(err?.message || err) });
  }
});

// GET /api/twitch/connect/callback
app.get("/api/twitch/connect/callback", async (req, res) => {
  try {
    if (!supabaseAdmin) throw new Error("Supabase admin not configured");

    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code) throw new Error("Missing code");

    const { uid } = verifyState(state);

    const token = await exchangeCodeForToken(code);
    const me = await fetchTwitchMe(token);

    const ageOk = isAtLeastOneYearOld(me.created_at);

    const patch = {
      profile_user_id: uid,
      platform: "twitch",
      platform_user_id: me.id,
      platform_login: me.login,
      platform_display_name: me.display_name ?? me.login,
      profile_url: `https://twitch.tv/${me.login}`,
      account_created_at: me.created_at,
      connected_at: new Date().toISOString(),
      metadata: {
        age_ok: ageOk,
        email: me.email ?? null,
        profile_image_url: me.profile_image_url ?? null,
      },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("profile_platform_accounts")
      .upsert(patch, {
        onConflict: "profile_user_id,platform",
      });

    if (error) throw new Error(error.message);

    const twitchAvatarUrl =
      typeof me.profile_image_url === "string" && me.profile_image_url.trim()
        ? me.profile_image_url
        : null;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        avatar_url: twitchAvatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", uid);

    if (profileError) throw new Error(profileError.message);

    const next = new URL("/settings/profile", APP_ORIGIN);
    next.searchParams.set("twitch", "connected");
    return res.redirect(next.toString());
  } catch (err) {
    const next = new URL("/settings/profile", APP_ORIGIN);
    next.searchParams.set("twitch", "error");
    next.searchParams.set("msg", String(err?.message || err));
    return res.redirect(next.toString());
  }
});

// The old /api/stripe/connect/start (Stripe-hosted Account Link onboarding,
// v1 accounts.create) was removed 2026-09-22 as part of the v1-to-v2 account
// migration. It had no caller anywhere in src/ -- confirmed by grep, and by
// useStripeConnectOnboarding.ts defining request/response types for a
// "start" mutation that was never wired up. The live onboarding path is
// POST /api/stripe/connect/account-session (embedded components), below.

app.post("/api/stripe/connect/sync", async (req, res) => {
  try {
    const stripeClient = requireStripe();
    const userId = await requireSupabaseUserId(req);

    const existingAccount = await getExistingCreatorPaymentAccount(userId);

    if (!existingAccount?.stripe_account_id) {
      return res.status(404).json({
        error: "No Stripe payout account found for this creator.",
      });
    }

    const account = await resyncCreatorPaymentAccountFromStripe({
      stripeClient,
      existing: existingAccount,
      source: "settings_sync",
    });

    return res.json({
      account: {
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        country: account.country,
        defaultCurrency: account.default_currency,
      },
    });
  } catch (err) {
    if (respondIfStripeAccountGone(res, err, "connect/sync")) {
      return;
    }

    const message = String(err?.message || err);
    const status = /session|authorization/i.test(message) ? 401 : 400;

    return res.status(status).json({ error: message });
  }
});

app.post("/api/stripe/checkout/session", async (req, res) => {
  try {
    const stripeClient = requireStripe();
    const userId = await requireSupabaseUserId(req);
    const paymentId = String(req.body?.paymentId || "").trim();

    if (!paymentId) {
      return res.status(400).json({ error: "paymentId is required." });
    }

    // Re-derive base, fees and total from the schedule item and agreement
    // this payment was created from, rather than trusting whatever the row
    // currently says. Self-heals drift when found; raises if the recipient
    // does not match the agreement (launch-scope.md section 11). Also doubles
    // as the existence check for paymentId.
    const { data: recomputedPayment, error: recomputeError } =
      await supabaseAdmin.rpc("recompute_listing_request_payment_amounts", {
        p_payment_id: paymentId,
      });

    if (recomputeError) {
      throw new Error(recomputeError.message);
    }

    let payment = recomputedPayment;

    assertCheckoutPaymentCanBeOpened({ payment, userId });
    await assertCheckoutPoliciesAccepted({ payment, userId });

    const creatorPaymentAccount = await getReadyCreatorPaymentAccount(
      payment.creator_user_id,
    );

    if (
      payment.stripe_connected_account_id &&
      payment.stripe_connected_account_id !==
      creatorPaymentAccount.stripe_account_id
    ) {
      throw new Error("This payment is linked to a different Stripe account.");
    }

    // Sprint 7: tax is determined after the amounts are recomputed (which
    // clears stale tax) and before any session is reused or created, so the
    // stored total -- which the webhook checks against amount_total -- is
    // always the one Stripe charges.
    payment = await applyCheckoutTax({ stripeClient, payment, req, userId });

    const metadata = getStripePaymentMetadata(payment);

    const reusableSession = await getReusableCheckoutSession({
      stripeClient,
      payment,
      stripeAccountId: creatorPaymentAccount.stripe_account_id,
    });

    if (reusableSession) {
      return res.json({
        payment: {
          id: payment.id,
          status: payment.status,
          stripe_connected_account_id: creatorPaymentAccount.stripe_account_id,
          stripe_checkout_session_id: reusableSession.id,
        },
        checkout: {
          sessionId: reusableSession.id,
          clientSecret: reusableSession.client_secret,
        },
      });
    }

    const session = await stripeClient.checkout.sessions.create(
      {
        mode: "payment",
        ui_mode: "embedded_page",
        client_reference_id: payment.id,
        return_url: getCheckoutReturnUrl(payment.id),
        // Fee Schedule section 6: every component, tax included, is its
        // own line so the buyer sees tax separately before paying.
        line_items: buildCheckoutLineItems({
          payment,
          title: getPaymentCheckoutTitle(payment),
          metadata,
        }),
        // A taxed payment needs Checkout's billing address as location
        // evidence (docs/support/payments/tax.md).
        ...(payment.tax_treatment === "calculated"
          ? { billing_address_collection: "required" }
          : {}),
        payment_intent_data: {
          application_fee_amount: payment.application_fee_cents,
          metadata,
        },
        metadata,
      },
      {
        stripeAccount: creatorPaymentAccount.stripe_account_id,
        idempotencyKey: `checkout_session_${payment.id}_${payment.updated_at}`,
      },
    );

    const { data, error } = await supabaseAdmin
      .from("listing_request_payments")
      .update({
        status: "checkout_opened",
        stripe_connected_account_id: creatorPaymentAccount.stripe_account_id,
        stripe_checkout_session_id: session.id,
        checkout_opened_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .eq("payer_user_id", userId)
      .select(
        "id, status, stripe_connected_account_id, stripe_checkout_session_id",
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return res.json({
      payment: data,
      checkout: {
        sessionId: session.id,
        clientSecret: session.client_secret,
      },
    });
  } catch (err) {
    const message = String(err?.message || err);
    const status = /session|authorization/i.test(message) ? 401 : 400;

    return res.status(status).json({ error: message });
  }
});

// Sprint 5 (launch-scope.md section 6.1): admin-only, full or partial refund
// of any paid payment. The reversal of the application fee has to happen
// atomically with the base refund, and the money sits on the creator's
// connected account -- so this is the one place a refund is issued, not a
// UI convenience wired to several.
//
// Two Stripe calls rather than a single refund_application_fee: true,
// deliberately. refund_application_fee's automatic proportion is based on
// (refund amount / original charge amount), which is not the same ratio
// section 6.2's cumulative, bps-rounded arithmetic produces once tips,
// support or prior partial refunds are in the mix -- and section 6.2
// explicitly requires the cumulative figure, with a final refund returning
// the exact rounding remainder. Explicitly refunding the buyer's fee share
// as part of the charge refund, then reversing the buyer-fee-plus-creator-fee
// share from the application fee directly (the Application Fee Refunds
// API), gives byte-exact control matching the ledger instead of trusting
// Stripe's own generic ratio.
// Shared by the admin refund route and the cancellation-acceptance drain
// route below -- both end up doing the same thing (refund a payment's
// unearned amount and record it), differing only in who may trigger it and
// how the base amount is decided. Throws on any failure; the caller decides
// how to report it (a single 4xx for the admin route, a per-payment
// skip-and-continue for the drain route so one bad payment does not block
// the rest of the queue).
const issueListingRequestPaymentRefund = async ({
  paymentId,
  baseRefundCents,
  reason,
  initiatedVia,
  actorUserId = null,
  tipRefundCents = 0,
  contributionRefundCents = 0,
  tipContributionOverrideReason = null,
}) => {
  const stripeClient = requireStripe();

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("listing_request_payments")
    .select(
      `
      id,
      status,
      currency,
      base_amount_cents,
      buyer_service_fee_cents,
      creator_platform_fee_cents,
      creator_tip_cents,
      platform_support_cents,
      tax_on_base_cents,
      tax_on_buyer_fee_cents,
      tax_on_tip_cents,
      tax_on_support_cents,
      stripe_tax_transaction_id,
      creator_user_id,
      stripe_charge_id,
      stripe_application_fee_id,
      stripe_connected_account_id
    `,
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  if (!payment) {
    throw new Error("Payment not found.");
  }

  if (!["paid", "partially_refunded"].includes(payment.status)) {
    throw new Error(
      `This payment is not refundable (currently ${payment.status}).`,
    );
  }

  if (!payment.stripe_charge_id || !payment.stripe_connected_account_id) {
    throw new Error("This payment has no recorded Stripe charge to refund.");
  }

  const { data: existingRefunds, error: refundsError } = await supabaseAdmin
    .from("listing_request_payment_refunds")
    .select(
      "base_refund_cents, buyer_fee_refund_cents, creator_fee_reversal_cents, tip_refund_cents, contribution_refund_cents, base_tax_refund_cents, buyer_fee_tax_refund_cents, tip_tax_refund_cents, support_tax_refund_cents",
    )
    .eq("payment_id", paymentId);

  if (refundsError) {
    throw new Error(refundsError.message);
  }

  const sumField = (field) =>
    (existingRefunds || []).reduce((sum, row) => sum + row[field], 0);

  const alreadyTipRefunded = sumField("tip_refund_cents");
  const alreadyContributionRefunded = sumField("contribution_refund_cents");

  if (alreadyTipRefunded + tipRefundCents > payment.creator_tip_cents) {
    throw new Error("Tip refund would exceed the tip actually paid.");
  }

  if (
    alreadyContributionRefunded + contributionRefundCents >
    payment.platform_support_cents
  ) {
    throw new Error(
      "Contribution refund would exceed the contribution actually paid.",
    );
  }

  const refundAmounts = computeCumulativeRefund(
    payment,
    existingRefunds,
    baseRefundCents,
    { tipRefundCents, contributionRefundCents },
  );

  const { thisBuyerFeeRefund, thisCreatorFeeReversal, thisTaxRefund } =
    refundAmounts;

  // Sprint 7: tax attributable to the refunded lines goes back to the buyer
  // too (Refund Policy section 8).
  const stripeRefundAmount =
    baseRefundCents +
    thisBuyerFeeRefund +
    tipRefundCents +
    contributionRefundCents +
    thisTaxRefund;

  // Section 6.5: take from the held balance first, and only fund a
  // shortfall from the platform once it is genuinely insufficient (the hold
  // has released and the creator has been paid out and spent it, or simply
  // never had enough). Checking the connected account's own available
  // balance up front -- rather than reacting to a Stripe error -- means
  // "take from the held balance first" falls out naturally: while the hold
  // is in effect there is normally plenty of available balance, so no
  // top-up happens and shortfallCents stays 0.
  const balance = await stripeClient.balance.retrieve(
    {},
    { stripeAccount: payment.stripe_connected_account_id },
  );

  const availableForCurrency = (balance.available || [])
    .filter((entry) => entry.currency === payment.currency)
    .reduce((sum, entry) => sum + entry.amount, 0);

  const shortfallCents = Math.max(0, stripeRefundAmount - availableForCurrency);

  if (shortfallCents > 0) {
    await stripeClient.transfers.create({
      amount: shortfallCents,
      currency: payment.currency,
      destination: payment.stripe_connected_account_id,
      metadata: {
        creatorhub_payment_id: payment.id,
        creatorhub_reason: "recovery_balance_top_up",
      },
    });
  }

  const refund = await stripeClient.refunds.create(
    {
      charge: payment.stripe_charge_id,
      amount: stripeRefundAmount,
      reason: "requested_by_customer",
      metadata: {
        creatorhub_payment_id: payment.id,
        creatorhub_refund_reason: reason,
        creatorhub_actor_user_id: actorUserId || "",
      },
    },
    { stripeAccount: payment.stripe_connected_account_id },
  );

  // Contribution refunds also have to come back out of the application
  // fee -- a contribution is included in it (section 4), so returning one
  // needs the same connected-account top-up as a fee reversal does.
  // Tax, like the contribution, reached the platform inside the application
  // fee (api/tax.js), so returning it needs the same reversal.
  const applicationFeeRefundAmount =
    thisBuyerFeeRefund +
    thisCreatorFeeReversal +
    contributionRefundCents +
    thisTaxRefund;

  let applicationFeeRefundId = null;

  if (applicationFeeRefundAmount > 0 && payment.stripe_application_fee_id) {
    const applicationFeeRefund = await stripeClient.applicationFees.createRefund(
      payment.stripe_application_fee_id,
      { amount: applicationFeeRefundAmount },
    );

    applicationFeeRefundId = applicationFeeRefund.id;
  }

  const { data: result, error: applyError } = await supabaseAdmin.rpc(
    "apply_refunded_listing_request_payment",
    {
      p_payment_id: payment.id,
      p_base_refund_cents: baseRefundCents,
      p_stripe_refund_id: refund.id,
      p_reason: reason,
      p_initiated_via: initiatedVia,
      p_actor_user_id: actorUserId,
      p_stripe_application_fee_refund_id: applicationFeeRefundId,
      p_tip_refund_cents: tipRefundCents,
      p_contribution_refund_cents: contributionRefundCents,
      p_tip_contribution_override_reason: tipContributionOverrideReason,
    },
  );

  if (applyError) {
    // The Stripe refund has already happened at this point. This payment
    // now needs manual reconciliation -- the next charge.refunded webhook
    // delivery will also attempt (and likely also fail, for the same
    // reason) rather than silently drop it, but this is exactly the
    // REF-002 divergence until someone looks at it.
    throw new Error(
      `Stripe refund ${refund.id} succeeded but recording it failed: ${applyError.message}. This must be reconciled manually.`,
    );
  }

  const refundResult = Array.isArray(result) ? result[0] : result;

  if (payment.stripe_tax_transaction_id || thisTaxRefund > 0) {
    await reverseRefundTaxBestEffort({
      payment,
      refundId: refundResult?.refund_id ?? null,
      stripeRefundId: refund.id,
      refundAmounts: { ...refundAmounts, baseRefundCents, tipRefundCents, contributionRefundCents },
    });
  }

  if (shortfallCents > 0) {
    const { error: recoveryDebitError } = await supabaseAdmin.rpc(
      "apply_creator_recovery_debit",
      {
        p_creator_user_id: payment.creator_user_id,
        p_amount_cents: shortfallCents,
        p_currency: payment.currency,
        p_reason: `Platform-funded shortfall on refund ${refund.id}.`,
        p_related_refund_id: refundResult?.refund_id ?? null,
      },
    );

    if (recoveryDebitError) {
      // The refund and the Stripe-side top-up have both already happened.
      // The creator's recovery balance is now understated until this is
      // fixed by hand -- see docs/support/payments/creator-recovery-balances.md.
      throw new Error(
        `Refund ${refund.id} succeeded and the platform funded a ${shortfallCents}-cent shortfall, but opening the recovery balance failed: ${recoveryDebitError.message}. This must be reconciled manually.`,
      );
    }
  }

  return refundResult;
};

// Sprint 7: after a refund is recorded, confirm the ledger's tax matches
// what was just sent to Stripe (the SQL function and api/refundArithmetic.js
// must never diverge), then reverse the refunded lines on the platform's
// Stripe Tax transaction so the filing exports net it off. Never throws --
// the money has already moved; a failure here is TAX-004 in
// docs/support/payments/tax.md.
const reverseRefundTaxBestEffort = async ({
  payment,
  refundId,
  stripeRefundId,
  refundAmounts,
}) => {
  try {
    if (!refundId) {
      throw new Error("the refund ledger row id was not returned");
    }

    const { data: ledgerRow, error: ledgerError } = await supabaseAdmin
      .from("listing_request_payment_refunds")
      .select(
        "base_tax_refund_cents, buyer_fee_tax_refund_cents, tip_tax_refund_cents, support_tax_refund_cents",
      )
      .eq("id", refundId)
      .maybeSingle();

    if (ledgerError || !ledgerRow) {
      throw new Error(ledgerError?.message || "refund ledger row not found");
    }

    if (
      ledgerRow.base_tax_refund_cents !== refundAmounts.thisBaseTaxRefund ||
      ledgerRow.buyer_fee_tax_refund_cents !== refundAmounts.thisBuyerFeeTaxRefund ||
      ledgerRow.tip_tax_refund_cents !== refundAmounts.thisTipTaxRefund ||
      ledgerRow.support_tax_refund_cents !== refundAmounts.thisSupportTaxRefund
    ) {
      throw new Error(
        `ledger tax ${JSON.stringify(ledgerRow)} does not match the tax refunded through Stripe`,
      );
    }

    if (!payment.stripe_tax_transaction_id || refundAmounts.thisTaxRefund === 0) {
      return;
    }

    const stripeClient = requireStripe();

    const originalLines = await stripeClient.tax.transactions.listLineItems(
      payment.stripe_tax_transaction_id,
      { limit: 10 },
    );

    const reversal = await stripeClient.tax.transactions.createReversal(
      {
        mode: "partial",
        original_transaction: payment.stripe_tax_transaction_id,
        reference: stripeRefundId,
        line_items: buildTaxReversalLineItems(originalLines.data, refundAmounts),
        metadata: {
          creatorhub_payment_id: payment.id,
          creatorhub_refund_id: refundId,
        },
      },
      { idempotencyKey: `tax_reversal_${stripeRefundId}` },
    );

    const { error: reversalRecordError } = await supabaseAdmin.rpc(
      "set_listing_request_payment_refund_tax_reversal",
      { p_refund_id: refundId, p_stripe_tax_reversal_id: reversal.id },
    );

    if (reversalRecordError) {
      throw new Error(reversalRecordError.message);
    }
  } catch (err) {
    console.error(
      `TAX-004: tax reversal for refund ${stripeRefundId} on payment ${payment.id} failed:`,
      err?.message || err,
    );
  }
};

app.post("/api/stripe/refunds", async (req, res) => {
  try {
    const adminUserId = await requireAdminUserId(req);

    const paymentId = String(req.body?.paymentId || "").trim();
    const baseRefundCents = Math.round(Number(req.body?.baseRefundCents));
    const reason = String(req.body?.reason || "").trim();
    const tipRefundCents = Math.round(Number(req.body?.tipRefundCents || 0));
    const contributionRefundCents = Math.round(
      Number(req.body?.contributionRefundCents || 0),
    );
    const overrideReason = req.body?.tipContributionOverrideReason
      ? String(req.body.tipContributionOverrideReason).trim()
      : null;

    if (!paymentId) {
      return res.status(400).json({ error: "paymentId is required." });
    }

    if (!Number.isFinite(baseRefundCents) || baseRefundCents <= 0) {
      return res
        .status(400)
        .json({ error: "baseRefundCents must be greater than zero." });
    }

    if (reason.length < 3) {
      return res.status(400).json({ error: "A refund reason is required." });
    }

    const refund = await issueListingRequestPaymentRefund({
      paymentId,
      baseRefundCents,
      reason,
      initiatedVia: "admin",
      actorUserId: adminUserId,
      tipRefundCents,
      contributionRefundCents,
      tipContributionOverrideReason: overrideReason,
    });

    return res.json({ refund });
  } catch (err) {
    const message = String(err?.message || err);
    const status = /session|authorization|administrator/i.test(message)
      ? 401
      : 400;

    return res.status(status).json({ error: message });
  }
});

// Sprint 5 (launch-scope.md section 6, and the Sprint 4 handoff note in
// docs/support/requests/cancellation.md's Known gaps): an accepted
// post-payment cancellation flags unearned amounts
// (listing_request_cancellation_proposal_items.flagged_for_refund_at) but a
// Postgres RPC cannot call Stripe, so nothing actually refunds them without
// this. Fired as a best-effort follow-up by
// useRespondListingRequestCancellationProposal immediately after an
// acceptance, the same pattern expire-cancelled-sessions already uses for
// the Stripe-side half of a DB-side cascade. Callable by either participant
// on the request -- the amounts are already locked in by the accepted
// statement, so there is no discretion left to gate behind an admin check.
// Pays out every amount the database has flagged for refund on one
// commission: an accepted cancellation statement, an administrative closure,
// or an automatic cancellation after a cancellation warning. The amounts
// were fixed by the database; nothing here decides how much. Safe to run
// again: an item is skipped once its refund is recorded.
const refundFlaggedAmountsForListingRequest = async (listingRequestId) => {
  const { data: proposals, error: proposalsError } = await supabaseAdmin
    .from("listing_request_cancellation_proposals")
    .select("id")
    .eq("listing_request_id", listingRequestId);

  if (proposalsError) {
    throw new Error(proposalsError.message);
  }

  const proposalIds = (proposals || []).map((proposal) => proposal.id);

  const { data: flaggedItems, error: itemsError } = proposalIds.length
    ? await supabaseAdmin
        .from("listing_request_cancellation_proposal_items")
        .select("payment_id, unearned_amount_cents")
        .in("proposal_id", proposalIds)
        .eq("is_operative", true)
        .not("flagged_for_refund_at", "is", null)
        .is("refunded_at", null)
    : { data: [], error: null };

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  // Sprint 6 (launch-scope.md section 7): the creator-unresponsive
  // administrative closure branch flags unearned amounts the same way
  // Sprint 4's cancellation acceptance does, into its own table since
  // a closure has no cancellation proposal to hang an item off.
  const { data: closures, error: closuresError } = await supabaseAdmin
    .from("listing_request_closures")
    .select("id")
    .eq("listing_request_id", listingRequestId);

  if (closuresError) {
    throw new Error(closuresError.message);
  }

  const closureIds = (closures || []).map((closure) => closure.id);

  const { data: closureFlaggedItems, error: closureItemsError } =
    closureIds.length
      ? await supabaseAdmin
          .from("listing_request_closure_refund_items")
          .select("payment_id, unearned_amount_cents")
          .in("closure_id", closureIds)
          .not("flagged_for_refund_at", "is", null)
          .is("refunded_at", null)
      : { data: [], error: null };

  if (closureItemsError) {
    throw new Error(closureItemsError.message);
  }

  const refunded = [];
  const skipped = [];

  for (const item of flaggedItems || []) {
    if (item.unearned_amount_cents <= 0) {
      continue;
    }

    try {
      await issueListingRequestPaymentRefund({
        paymentId: item.payment_id,
        baseRefundCents: item.unearned_amount_cents,
        reason:
          "Cancellation accepted: unearned prepaid amount flagged for refund.",
        initiatedVia: "cancellation_cascade",
      });

      refunded.push(item.payment_id);
    } catch (err) {
      skipped.push({
        paymentId: item.payment_id,
        reason: String(err?.message || err),
      });
    }
  }

  for (const item of closureFlaggedItems || []) {
    if (item.unearned_amount_cents <= 0) {
      continue;
    }

    try {
      await issueListingRequestPaymentRefund({
        paymentId: item.payment_id,
        baseRefundCents: item.unearned_amount_cents,
        reason:
          "Administrative closure (creator unresponsive): unearned prepaid amount flagged for refund.",
        initiatedVia: "closure_cascade",
      });

      refunded.push(item.payment_id);
    } catch (err) {
      skipped.push({
        paymentId: item.payment_id,
        reason: String(err?.message || err),
      });
    }
  }

  return { refunded, skipped };
};

app.post(
  "/api/stripe/refunds/drain-flagged-for-request",
  async (req, res) => {
    try {
      const userId = await requireSupabaseUserId(req);
      const listingRequestId = String(
        req.body?.listingRequestId || "",
      ).trim();

      if (!listingRequestId) {
        return res
          .status(400)
          .json({ error: "listingRequestId is required." });
      }

      const { data: request, error: requestError } = await supabaseAdmin
        .from("listing_requests")
        .select("id, buyer_user_id, creator_user_id")
        .eq("id", listingRequestId)
        .maybeSingle();

      if (requestError) {
        throw new Error(requestError.message);
      }

      if (
        !request ||
        (request.buyer_user_id !== userId && request.creator_user_id !== userId)
      ) {
        return res
          .status(404)
          .json({ error: "Listing request not found or not accessible." });
      }

      return res.json(await refundFlaggedAmountsForListingRequest(listingRequestId));
    } catch (err) {
      const message = String(err?.message || err);
      const status = /session|authorization/i.test(message) ? 401 : 400;

      return res.status(status).json({ error: message });
    }
  },
);

// Sprint 6 (launch-scope.md section 7 / 7.1): the notice RPCs
// (send_listing_request_first_notice / send_listing_request_final_notice,
// 20260922_131) write the notice row directly from the frontend via
// supabase.rpc, the same way Sprint 4's cancellation RPCs do -- they run as
// the calling user (auth.uid()), not the service role, so the 7+7 day
// clock's permission checks work correctly. A Postgres RPC cannot send an
// email, so the frontend calls this immediately afterward with the new
// notice's id, the same "write the DB state via RPC, then a best-effort
// Express follow-up" pattern as the cancellation drain route above.
// The website calls this after any action, so the other person's email goes
// out within seconds instead of waiting for the hourly run. It sends
// whatever is waiting, for anyone: nothing here depends on who is calling,
// beyond being signed in.
app.post("/api/notifications/drain", async (req, res) => {
  try {
    await requireSupabaseUserId(req);
  } catch {
    return res.status(401).json({ error: "Sign in to continue." });
  }

  const outcome = await drainListingRequestNotifications({ limit: 10 });

  return res.status(outcome.error ? 500 : 200).json(outcome);
});

app.post("/api/notices/:noticeId/send-email", async (req, res) => {
  try {
    const userId = await requireSupabaseUserId(req);
    const noticeId = String(req.params.noticeId || "").trim();

    if (!noticeId) {
      return res.status(400).json({ error: "noticeId is required." });
    }

    const { data: notice, error: noticeError } = await supabaseAdmin
      .from("listing_request_notices")
      .select(
        "id, listing_request_id, notice_type, sender_user_id, recipient_user_id, requested_action, expires_at, email_status",
      )
      .eq("id", noticeId)
      .maybeSingle();

    if (noticeError) {
      throw new Error(noticeError.message);
    }

    if (!notice || notice.sender_user_id !== userId) {
      return res
        .status(404)
        .json({ error: "Notice not found or not accessible." });
    }

    if (notice.email_status === "sent") {
      return res.json({ status: "sent", alreadySent: true });
    }

    const { data: request, error: requestError } = await supabaseAdmin
      .from("listing_requests")
      .select("id, request_title, buyer_user_id")
      .eq("id", notice.listing_request_id)
      .maybeSingle();

    if (requestError) {
      throw new Error(requestError.message);
    }

    const recipientViewer =
      request?.buyer_user_id === notice.recipient_user_id ? "buyer" : "creator";

    const templateData = {
      requestTitle: request?.request_title || "your project",
      requestedAction: notice.requested_action,
      expiresAt: notice.expires_at,
      requestUrl: getListingRequestUrl(notice.listing_request_id, recipientViewer),
    };

    const { subject, html, text } =
      notice.notice_type === "final"
        ? renderFinalNoticeEmail(templateData)
        : renderFirstNoticeEmail(templateData);

    const attemptedAt = new Date().toISOString();
    let result;

    try {
      const email = await getSupabaseUserEmail(notice.recipient_user_id);
      result = await sendTransactionalEmail(supabaseAdmin, {
        to: email,
        subject,
        html,
        text,
      });
    } catch (err) {
      result = {
        status: "failed",
        providerMessageId: null,
        failedReason: String(err?.message || err),
      };
    }

    const { error: updateError } = await supabaseAdmin
      .from("listing_request_notices")
      .update({
        email_status: result.status,
        email_provider_message_id: result.providerMessageId,
        email_attempted_at: attemptedAt,
        email_delivered_at: result.status === "sent" ? attemptedAt : null,
        email_failed_reason: result.failedReason,
      })
      .eq("id", noticeId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return res.json({ status: result.status, failedReason: result.failedReason });
  } catch (err) {
    const message = String(err?.message || err);
    const status = /session|authorization/i.test(message) ? 401 : 400;

    return res.status(status).json({ error: message });
  }
});

// Creator application decisions. The admin page writes the decision to
// seller_applications (RLS: admins only), then calls this so the applicant
// hears about it. The decision and the recipient are read from the database,
// never from the request, and only an administrator may trigger it. One
// email per decision (api/creatorApplicationEmail.js); every attempt is
// recorded in seller_application_decision_emails. Best-effort: a failed
// email never undoes the decision. Playbook: creators/applications.md APP-006.
app.post("/api/creator-applications/:applicationId/send-decision-email", async (req, res) => {
  try {
    const adminUserId = await requireAdminUserId(req);
    const applicationId = String(req.params.applicationId || "").trim();

    if (!/^[0-9a-f-]{36}$/i.test(applicationId)) {
      return res.status(400).json({ error: "applicationId is required." });
    }

    const { data: application, error: applicationError } = await supabaseAdmin
      .from("seller_applications")
      .select("id, profile_user_id, status, submitted_at, reviewer_notes, rejection_reason")
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationError) {
      throw new Error(applicationError.message);
    }

    if (!application) {
      return res.status(404).json({ error: "Application not found." });
    }

    const { data: lastSent, error: lastSentError } = await supabaseAdmin
      .from("seller_application_decision_emails")
      .select("status, attempted_at")
      .eq("application_id", applicationId)
      .eq("email_status", "sent")
      .order("attempted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSentError) {
      throw new Error(lastSentError.message);
    }

    const decision = shouldSendApplicationDecisionEmail({ application, lastSent });

    if (!decision.send) {
      return res.json({ status: "skipped", reason: decision.reason });
    }

    let result;

    try {
      const email = await getSupabaseUserEmail(application.profile_user_id);
      const { subject, html, text } = renderCreatorApplicationDecisionEmail({
        status: application.status,
        note: getApplicantVisibleNote(application),
      });

      result = await sendTransactionalEmail(supabaseAdmin, {
        to: email,
        subject,
        html,
        text,
      });
    } catch (err) {
      result = {
        status: "failed",
        providerMessageId: null,
        failedReason: String(err?.message || err),
      };
    }

    if (result.status !== "sent") {
      console.error(
        `APP-006: decision email (${application.status}) for creator application ${applicationId} failed: ${result.failedReason}`,
      );
    }

    const { error: recordError } = await supabaseAdmin
      .from("seller_application_decision_emails")
      .insert({
        application_id: applicationId,
        status: application.status,
        email_status: result.status === "sent" ? "sent" : "failed",
        provider_message_id: result.providerMessageId,
        failed_reason: result.failedReason,
        sent_by_admin_user_id: adminUserId,
      });

    if (recordError) {
      // The email may have gone; without the record a retry could send it
      // twice, so say so loudly rather than silently.
      console.error(
        `APP-006: decision email for creator application ${applicationId} was ${result.status} but could not be recorded: ${recordError.message}`,
      );
    }

    return res.json({ status: result.status, decision: application.status });
  } catch (err) {
    const message = String(err?.message || err);
    const status = /session|authorization/i.test(message)
      ? 401
      : /Administrator access/.test(message)
        ? 403
        : 400;

    return res.status(status).json({ error: message });
  }
});

// Sprint 6 (launch-scope.md section 7.1): "Suppression-list handling, so a
// hard bounce does not silently restart a notice clock that nobody
// received." Cloudflare Email Service's exact bounce/complaint webhook
// payload could not be verified against real account configuration in this
// session (the domain is not onboarded yet -- see the Sprint 6 checklist),
// so this parses a handful of plausible field names defensively and drops
// anything it cannot make sense of rather than guessing. **Re-verify the
// actual field names against a real Cloudflare payload before relying on
// this in production** -- see
// docs/support/messaging/transactional-email.md.
//
// No signature verification implemented for the same reason (the signing
// scheme cannot be confirmed without a real account). Treat this endpoint's
// URL as unguessable-but-not-secret until that is added; it can only ever
// suppress an email address or mark a notice bounced, neither of which
// moves money.
app.post("/api/webhooks/email", async (req, res) => {
  try {
    const body = req.body || {};
    const eventType = String(
      body.type || body.event || body.EventType || "",
    ).toLowerCase();
    const email = String(
      body.email || body.recipient || body.to || "",
    ).trim();
    const providerMessageId = String(
      body.messageId || body.message_id || body.MessageID || "",
    ).trim() || null;
    const detail = String(body.reason || body.detail || "").trim() || null;

    if (!email || !eventType) {
      return res
        .status(400)
        .json({ error: "Unrecognised email webhook payload." });
    }

    const isBounce = /bounce|failed|undelivered/.test(eventType);
    const isComplaint = /complaint|spam|abuse/.test(eventType);

    if (isBounce || isComplaint) {
      await suppressEmail(supabaseAdmin, {
        email,
        reason: isComplaint ? "complaint" : "hard_bounce",
        detail,
        sourceProviderMessageId: providerMessageId,
      });

      // Only correlate back to a specific notice when the provider gave us
      // its message id -- recipient_user_id is a uuid, not an email
      // address, so there is no other reliable join key here. Without a
      // message id the suppression above still protects future sends;
      // this specific notice's status just stays whatever it was.
      if (providerMessageId) {
        await supabaseAdmin
          .from("listing_request_notices")
          .update({
            email_status: "bounced",
            email_failed_reason: detail || eventType,
          })
          .eq("email_provider_message_id", providerMessageId)
          .neq("email_status", "bounced");
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: String(err?.message || err) });
  }
});

// Sprint 5 (launch-scope.md section 6.5): "the creator can settle the
// balance in the app at any time, by card." A straight Stripe Checkout
// session on the platform's own account -- no stripeAccount header, no
// application_fee_amount -- since this is the creator paying Made for
// Stream back directly, not a marketplace transaction.
app.post("/api/stripe/recovery/settlement-session", async (req, res) => {
  try {
    const stripeClient = requireStripe();
    const userId = await requireSupabaseUserId(req);
    const amountCents = Math.round(Number(req.body?.amountCents));

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res
        .status(400)
        .json({ error: "amountCents must be greater than zero." });
    }

    const { data: balance, error: balanceError } = await supabaseAdmin
      .from("creator_recovery_balances")
      .select("creator_user_id, currency, outstanding_cents")
      .eq("creator_user_id", userId)
      .maybeSingle();

    if (balanceError) {
      throw new Error(balanceError.message);
    }

    if (!balance || balance.outstanding_cents <= 0) {
      return res
        .status(400)
        .json({ error: "You have no outstanding recovery balance." });
    }

    if (amountCents > balance.outstanding_cents) {
      return res.status(400).json({
        error: `You can settle at most ${balance.outstanding_cents} cents.`,
      });
    }

    const { data: settlement, error: insertError } = await supabaseAdmin
      .from("creator_recovery_settlement_payments")
      .insert({
        creator_user_id: userId,
        amount_cents: amountCents,
        currency: balance.currency,
      })
      .select("id, amount_cents, currency")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    const session = await stripeClient.checkout.sessions.create(
      {
        mode: "payment",
        ui_mode: "embedded_page",
        client_reference_id: settlement.id,
        return_url: getRecoverySettlementReturnUrl(),
        line_items: [
          {
            price_data: {
              currency: settlement.currency,
              unit_amount: settlement.amount_cents,
              product_data: {
                name: "Made for Stream recovery balance settlement",
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          creatorhub_recovery_settlement_id: settlement.id,
        },
      },
      {
        idempotencyKey: `recovery_settlement_${settlement.id}`,
      },
    );

    const { error: updateError } = await supabaseAdmin
      .from("creator_recovery_settlement_payments")
      .update({
        status: "checkout_opened",
        stripe_checkout_session_id: session.id,
        checkout_opened_at: new Date().toISOString(),
      })
      .eq("id", settlement.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return res.json({
      settlementId: settlement.id,
      checkout: {
        sessionId: session.id,
        clientSecret: session.client_secret,
      },
    });
  } catch (err) {
    const message = String(err?.message || err);
    const status = /session|authorization/i.test(message) ? 401 : 400;

    return res.status(status).json({ error: message });
  }
});

// Sprint 4 (launch-scope.md section 5.1 / 5.2): cancel_listing_request_before_payment
// and respond_listing_request_cancellation_proposal (accepted) move any
// requires_checkout / checkout_opened payment to status "cancelled" in the
// database, but neither RPC can reach the Stripe API -- Postgres has no way
// to call Stripe. This route is the other half: it expires the live
// checkout session for every payment those RPCs already cancelled, so a
// buyer with the old checkout page still open cannot complete it into a
// payment_intent against a project that no longer exists. Always re-derives
// which sessions to expire from the database rather than trusting
// client-supplied Stripe ids, and is safe to call more than once --
// expiring an already-expired or already-completed session just fails that
// one entry, which is caught and reported rather than thrown.
app.post(
  "/api/stripe/checkout/expire-cancelled-sessions",
  async (req, res) => {
    try {
      const stripeClient = requireStripe();
      const userId = await requireSupabaseUserId(req);
      const listingRequestId = String(
        req.body?.listingRequestId || "",
      ).trim();

      if (!listingRequestId) {
        return res
          .status(400)
          .json({ error: "listingRequestId is required." });
      }

      const { data: request, error: requestError } = await supabaseAdmin
        .from("listing_requests")
        .select("id, buyer_user_id, creator_user_id")
        .eq("id", listingRequestId)
        .maybeSingle();

      if (requestError) {
        throw new Error(requestError.message);
      }

      if (
        !request ||
        (request.buyer_user_id !== userId &&
          request.creator_user_id !== userId)
      ) {
        return res
          .status(404)
          .json({ error: "Listing request not found or not accessible." });
      }

      const { data: payments, error: paymentsError } = await supabaseAdmin
        .from("listing_request_payments")
        .select(
          "id, status, stripe_checkout_session_id, stripe_connected_account_id",
        )
        .eq("listing_request_id", listingRequestId)
        .eq("status", "cancelled")
        .not("stripe_checkout_session_id", "is", null)
        .not("stripe_connected_account_id", "is", null);

      if (paymentsError) {
        throw new Error(paymentsError.message);
      }

      const expired = [];
      const skipped = [];

      for (const payment of payments || []) {
        try {
          await stripeClient.checkout.sessions.expire(
            payment.stripe_checkout_session_id,
            {},
            { stripeAccount: payment.stripe_connected_account_id },
          );

          expired.push(payment.id);
        } catch (err) {
          skipped.push({
            paymentId: payment.id,
            reason: String(err?.message || err),
          });
        }
      }

      return res.json({ expired, skipped });
    } catch (err) {
      const message = String(err?.message || err);
      const status = /session|authorization/i.test(message) ? 401 : 400;

      return res.status(status).json({ error: message });
    }
  },
);

app.get("/api/stripe/checkout/session-status", async (req, res) => {
  try {
    const stripeClient = requireStripe();
    const userId = await requireSupabaseUserId(req);

    const paymentId = String(
      req.query.paymentId || req.query.payment_id || "",
    ).trim();
    const sessionId = String(
      req.query.sessionId || req.query.session_id || "",
    ).trim();

    if (!paymentId) {
      return res.status(400).json({ error: "paymentId is required." });
    }

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required." });
    }

    const { data: payment, error } = await supabaseAdmin
      .from("listing_request_payments")
      .select(
        `
        id,
        status,
        payment_type,
        currency,
        base_amount_cents,
        creator_tip_cents,
        buyer_service_fee_cents,
        creator_platform_fee_cents,
        platform_support_cents,
        application_fee_cents,
        total_checkout_cents,
        payer_user_id,
        creator_user_id,
        stripe_connected_account_id,
        stripe_checkout_session_id,
        paid_at,
        updated_at
      `,
      )
      .eq("id", paymentId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!payment?.id) {
      return res.status(404).json({ error: "Payment record was not found." });
    }

    if (
      payment.payer_user_id !== userId &&
      payment.creator_user_id !== userId
    ) {
      return res.status(403).json({
        error: "You do not have access to this payment.",
      });
    }

    if (!payment.stripe_connected_account_id) {
      return res.status(400).json({
        error: "Payment is missing a Stripe connected account.",
      });
    }

    if (
      payment.stripe_checkout_session_id &&
      payment.stripe_checkout_session_id !== sessionId
    ) {
      return res.status(400).json({
        error: "Checkout session does not match this payment.",
      });
    }

    const session = await stripeClient.checkout.sessions.retrieve(
      sessionId,
      {},
      {
        stripeAccount: payment.stripe_connected_account_id,
      },
    );

    return res.json({
      payment,
      checkout: {
        sessionId: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email ?? null,
      },
    });
  } catch (err) {
    const message = String(err?.message || err);
    const status = /session|authorization/i.test(message) ? 401 : 400;

    return res.status(status).json({ error: message });
  }
});

// Sprint 9: scheduled jobs. Cloud Scheduler calls these hourly with
// "Authorization: Bearer $OPS_CRON_SECRET". Both are safe to run twice.
// Playbook: docs/support/operations/alerting.md.
const OPS_PLAYBOOK_BASE_URL =
  process.env.OPS_PLAYBOOK_BASE_URL ||
  "https://github.com/Alvintol/creator-hub/blob/main";

const rejectUnauthorizedOpsRequest = (req, res) => {
  if (
    isAuthorizedOpsRequest(
      req.headers.authorization,
      OPS_CRON_SECRET,
      crypto.timingSafeEqual,
    )
  ) {
    return false;
  }

  console.warn(`OPS-002: ops request to ${req.path} was not authorized.`);
  res.status(401).json({ error: "Not authorized." });
  return true;
};

// Backstop for missed thin events: re-reads the stalest mirror rows (never
// synced, or older than 6 hours), up to OPS_RESYNC_BATCH_SIZE per run.
app.post("/api/internal/ops/connect-resync", async (req, res) => {
  if (rejectUnauthorizedOpsRequest(req, res)) {
    return;
  }

  try {
    const stripeClient = requireStripe();

    if (!supabaseAdmin) {
      throw new Error("Supabase admin not configured");
    }

    const { data: rows, error } = await supabaseAdmin
      .from("creator_payment_accounts")
      .select("*")
      .eq("provider", "stripe")
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(OPS_RESYNC_BATCH_SIZE * 2);

    if (error) {
      throw new Error(error.message);
    }

    const selected = selectAccountsForResync(rows, {
      limit: OPS_RESYNC_BATCH_SIZE,
    });

    let refreshed = 0;
    let lostReadiness = 0;
    let failed = 0;

    for (const existing of selected) {
      try {
        const account = await resyncCreatorPaymentAccountFromStripe({
          stripeClient,
          existing,
          source: "scheduled_resync",
        });

        refreshed += 1;

        if (didCreatorPaymentAccountLoseReadiness(existing, account)) {
          lostReadiness += 1;
        }
      } catch (err) {
        failed += 1;
        console.error(
          `CON-006: scheduled resync of creator payment account ${existing.stripe_account_id} failed: ${String(err?.message || err)}`,
        );
      }
    }

    return res.status(failed > 0 && refreshed === 0 ? 502 : 200).json({
      selected: selected.length,
      refreshed,
      lostReadiness,
      failed,
    });
  } catch (err) {
    const message = String(err?.message || err);
    console.error(`CON-006: scheduled resync failed: ${message}`);
    return res.status(500).json({ error: message });
  }
});

// Runs list_ops_alerts() and emails OPS_ALERT_EMAIL when something is new,
// or daily while it stays open. A failed send returns 502, so the Cloud
// Scheduler job shows the failure, and the next run tries again.
app.post("/api/internal/ops/alerts/run", async (req, res) => {
  if (rejectUnauthorizedOpsRequest(req, res)) {
    return;
  }

  try {
    if (!supabaseAdmin) {
      throw new Error("Supabase admin not configured");
    }

    // Commission emails ride on this hourly run: add reminders for things
    // left waiting, then send anything not yet sent. Its failures are
    // logged (NOTIF-001) and never stop the ops alerts below.
    const { error: remindersError } = await supabaseAdmin.rpc(
      "enqueue_listing_request_reminders",
    );

    if (remindersError) {
      console.error(`NOTIF-001: reminders could not be queued: ${remindersError.message}`);
    }

    const { error: unreadError } = await supabaseAdmin.rpc(
      "enqueue_unread_message_notifications",
    );

    if (unreadError) {
      console.error(`NOTIF-001: unread messages could not be queued: ${unreadError.message}`);
    }

    // Cancellation warnings that ran out with no reply (20261007_149). The
    // database cancels the commission and fixes any refund; this pays it.
    const { data: autoCancelled, error: warningsError } = await supabaseAdmin.rpc(
      "close_expired_listing_request_cancellation_warnings",
    );

    if (warningsError) {
      console.error(`WARN-003: expired cancellation warnings were not processed: ${warningsError.message}`);
    }

    for (const cancelled of autoCancelled || []) {
      if (cancelled.flagged_refunds > 0) {
        try {
          const { skipped } = await refundFlaggedAmountsForListingRequest(
            cancelled.listing_request_id,
          );

          for (const item of skipped) {
            console.error(
              `WARN-004: refund not made for payment ${item.paymentId} on commission ${cancelled.listing_request_id}: ${item.reason}`,
            );
          }
        } catch (err) {
          console.error(
            `WARN-004: refunds failed for commission ${cancelled.listing_request_id}: ${String(err?.message || err)}`,
          );
        }
      }
    }

    const notifications = await drainListingRequestNotifications({ limit: 100 });

    const { data: rows, error: alertsError } =
      await supabaseAdmin.rpc("list_ops_alerts");

    if (alertsError) {
      throw new Error(alertsError.message);
    }

    const { data: state, error: stateError } = await supabaseAdmin
      .from("ops_alert_notifications")
      .select("alert_id, subject_id, playbook_issue, first_seen_at, last_notified_at");

    if (stateError) {
      throw new Error(stateError.message);
    }

    const plan = planOpsAlertDigest({ rows, state });

    if (plan.unknown.length > 0) {
      console.error(
        `OPS-003: list_ops_alerts returned unregistered alert ids: ${plan.unknown.join(", ")}`,
      );
    }

    let emailStatus = "not_needed";

    if (plan.send) {
      const { subject, text, html } = renderOpsAlertDigest({
        rows: plan.rows,
        repoUrl: OPS_PLAYBOOK_BASE_URL,
        siteUrl: process.env.EMAIL_SITE_URL || "https://madeforstream.com",
      });

      const result = await sendTransactionalEmail(supabaseAdmin, {
        to: OPS_ALERT_EMAIL,
        subject,
        html,
        text,
      });

      emailStatus = result.status;

      if (result.status !== "sent") {
        console.error(
          `OPS-001: alert digest to ${OPS_ALERT_EMAIL} failed: ${result.failedReason}`,
        );
      }
    }

    const emailFailed = plan.send && emailStatus !== "sent";
    const writes = emailFailed ? plan.pending : plan.upserts;

    if (writes.length > 0) {
      const { error } = await supabaseAdmin
        .from("ops_alert_notifications")
        .upsert(writes, { onConflict: "alert_id,subject_id" });

      if (error) {
        throw new Error(error.message);
      }
    }

    for (const resolved of plan.deletes) {
      const { error } = await supabaseAdmin
        .from("ops_alert_notifications")
        .delete()
        .match(resolved);

      if (error) {
        throw new Error(error.message);
      }
    }

    return res.status(emailFailed ? 502 : 200).json({
      open: Array.isArray(rows) ? rows.length : 0,
      emailed: plan.send ? plan.rows.length : 0,
      resolved: plan.deletes.length,
      emailStatus,
      notifications,
      autoCancelled: (autoCancelled || []).length,
    });
  } catch (err) {
    const message = String(err?.message || err);
    console.error(`OPS-001: alert run failed: ${message}`);
    return res.status(500).json({ error: message });
  }
});

app.post("/api/stripe/connect/account-session", async (req, res) => {
  try {
    const stripeClient = requireStripe();
    const userId = await requireSupabaseUserId(req);

    if (!stripeClient?.v2?.core?.accounts?.create) {
      return res.status(500).json({
        error:
          "Stripe Accounts v2 API is unavailable. Check the API Stripe package version and STRIPE_SECRET_KEY.",
      });
    }

    if (!stripeClient?.accountSessions?.create) {
      return res.status(500).json({
        error:
          "Stripe account sessions API is unavailable. Run `cd api && npm install stripe@latest`.",
      });
    }

    await requireApprovedCreator(userId);

    // No default: a Stripe account's country is permanent, so a request
    // that does not name one must not quietly open a Canadian account.
    if (!req.body?.country || !req.body?.defaultCurrency) {
      return res.status(400).json({
        error: "Choose your payout country and currency before starting Stripe setup.",
      });
    }

    const country = normalizeCountryCode(req.body.country);
    const defaultCurrency = normalizeCurrencyCode(req.body.defaultCurrency);

    // Payout accounts can only be opened where Stripe lets this platform
    // onboard creators and pay them in a currency we support
    // (api/supportedCountries.js). No account existed outside this list when
    // the check was added (2026-10-05).
    if (!isSupportedPayoutCountry(country)) {
      return res.status(400).json({
        error: getUnsupportedPayoutCountryMessage(country),
      });
    }

    // Projects can only be priced in a supported currency (20260923_138), so
    // onboarding a creator whose default is anything else would set up
    // listings that cannot be paid.
    if (!isSupportedCurrency(defaultCurrency)) {
      return res.status(400).json({
        error: getUnsupportedCurrencyMessage(defaultCurrency),
      });
    }

    const { account, existingAccount, wasCreated } =
      await getOrCreateStripeAccountForEmbeddedConnect({
        stripeClient,
        userId,
        country,
        defaultCurrency,
      });

    const accountSession = await stripeClient.accountSessions.create({
      account: account.id,
      components: getEmbeddedConnectAccountSessionComponents(),
    });

    return res.json({
      account: getStripeConnectAccountSummary({
        account,
        existingAccount,
      }),
      accountSession: {
        clientSecret: accountSession.client_secret,
        expiresAt: accountSession.expires_at,
      },
      meta: {
        wasCreated,
      },
    });
  } catch (err) {
    if (respondIfStripeAccountGone(res, err, "connect/account-session")) {
      return;
    }

    const message = String(err?.message || err);
    const connectSetupResponse = getStripeConnectSetupRequiredResponse(message);

    if (connectSetupResponse) {
      return res
        .status(connectSetupResponse.status)
        .json(connectSetupResponse.body);
    }

    const status = /session|authorization|approved creator/i.test(message)
      ? 401
      : 400;

    return res.status(status).json({ error: message });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(500).json({
    error: err?.message || "Unexpected API error.",
  });
});

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
  console.log(
    `[stripe] mode=${STRIPE_KEY_MODE} secret=${STRIPE_SECRET_KEY ? "configured" : "missing"} webhook=${STRIPE_WEBHOOK_SECRET ? "configured" : "missing"}`,
  );
});