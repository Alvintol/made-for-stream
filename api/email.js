// Sprint 6 (launch-scope.md section 7.1): transactional email over
// authenticated SMTP, per the decision to use Cloudflare Email Service
// without any Workers code. SMTP rather than Cloudflare's REST endpoint
// specifically because the REST API's exact request/response contract for
// this newer (Beta) product could not be verified against real credentials
// in this session -- SMTP is a stable, well-understood protocol nodemailer
// already speaks, and Cloudflare Email Sending explicitly supports it
// alongside the REST API and a Workers binding (docs/launch-scope.md
// section 7.1). Supabase's custom SMTP can point at the same credentials,
// which is the whole point of consolidating on one provider.
//
// Connection details confirmed against Cloudflare's own docs
// (developers.cloudflare.com/email-service/api/send-emails/smtp/): the
// endpoint is always smtp.mx.cloudflare.net:465 (implicit TLS -- Cloudflare
// does not offer STARTTLS on 587), the username is always the literal
// string "api_token", and the password is a Cloudflare API token scoped to
// Account > Email Sending > Edit. None of that is account-specific
// configuration; only EMAIL_SMTP_PASS (the token) is a real secret.
//
// Verified live 2026-09-23: send.madeforstream.com onboarded, Workers Paid
// active, a real send through this module's sendTransactionalEmail was
// accepted by Cloudflare's SMTP endpoint end to end. Not yet verified:
// production volume (this was one test send, not domain warming) and a real
// bounce arriving through the queue (parseEmailEvent below) -- see
// docs/support/messaging/transactional-email.md.
// Every call site treats a send failure as non-fatal to the workflow it's
// attached to.

import nodemailer from "nodemailer";

const SMTP_HOST = process.env.EMAIL_SMTP_HOST || "";
const SMTP_PORT = Number(process.env.EMAIL_SMTP_PORT || 465);
const SMTP_USER = process.env.EMAIL_SMTP_USER || "";
const SMTP_PASS = process.env.EMAIL_SMTP_PASS || "";
const EMAIL_FROM_ADDRESS =
  process.env.EMAIL_FROM_ADDRESS || "notifications@send.madeforstream.com";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "Made for Stream";

let cachedTransport = null;

export const isEmailConfigured = () =>
  Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const getTransport = () => {
  if (!isEmailConfigured()) {
    return null;
  }

  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  return cachedTransport;
};

// Sprint 6 checklist: "Suppression-list handling, so a hard bounce does not
// silently restart a notice clock that nobody received." Checked before
// every send against email_suppressions (20260922_134), which only the
// service role can read.
export const isEmailSuppressed = async (supabaseAdmin, email) => {
  const normalized = String(email || "").trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from("email_suppressions")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
};

export const suppressEmail = async (
  supabaseAdmin,
  { email, reason, detail = null, sourceProviderMessageId = null },
) => {
  const normalized = String(email || "").trim().toLowerCase();

  if (!normalized) {
    return;
  }

  const { error } = await supabaseAdmin.from("email_suppressions").upsert(
    {
      email: normalized,
      reason,
      detail,
      source_provider_message_id: sourceProviderMessageId,
      suppressed_at: new Date().toISOString(),
    },
    { onConflict: "email" },
  );

  if (error) {
    throw new Error(error.message);
  }
};

// Reads one Cloudflare Email Sending event, as published to the
// email-events queue and forwarded by workers/email-events
// (developers.cloudflare.com/email-service/reference/event-subscriptions/).
// Returns what to suppress, or null when the address should stay: a soft
// bounce (retries ran out on a temporary failure) is not a dead address.
export const parseEmailEvent = (event) => {
  const type = String(event?.type || "");
  const payload = event?.payload || {};
  const email = String(payload.recipient || "").trim();
  const isComplaint = type === "cf.email.sending.message.complained";
  const isHardBounce =
    type === "cf.email.sending.message.bounced" && payload.bounce?.type === "hard";

  if (!email || (!isComplaint && !isHardBounce)) {
    return null;
  }

  return {
    email,
    reason: isComplaint ? "complaint" : "hard_bounce",
    detail: String(payload.bounce?.reason || payload.delivery?.smtpResponse || "").trim() || null,
    providerMessageId: String(payload.messageId || "").trim() || null,
  };
};

// Returns { status, providerMessageId, failedReason }. Never throws --
// every call site records the outcome and moves on, since a failed
// transactional email must not block the workflow it's documenting (a
// notice is still legally sent when the RPC records it; delivery is a
// separate, tracked concern -- see listing_request_notices.email_status).
export const sendTransactionalEmail = async (
  supabaseAdmin,
  { to, subject, html, text },
) => {
  const normalizedTo = String(to || "").trim().toLowerCase();

  if (!normalizedTo) {
    return { status: "failed", providerMessageId: null, failedReason: "No recipient address." };
  }

  if (await isEmailSuppressed(supabaseAdmin, normalizedTo)) {
    return {
      status: "failed",
      providerMessageId: null,
      failedReason: "Recipient address is on the suppression list (a prior hard bounce or complaint).",
    };
  }

  const transport = getTransport();

  if (!transport) {
    return {
      status: "failed",
      providerMessageId: null,
      failedReason:
        "Email is not configured (EMAIL_SMTP_HOST/EMAIL_SMTP_USER/EMAIL_SMTP_PASS missing). See docs/support/messaging/transactional-email.md.",
    };
  }

  try {
    const info = await transport.sendMail({
      from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM_ADDRESS}>`,
      to: normalizedTo,
      subject,
      html,
      text,
    });

    return {
      status: "sent",
      providerMessageId: info?.messageId || null,
      failedReason: null,
    };
  } catch (err) {
    return {
      status: "failed",
      providerMessageId: null,
      failedReason: String(err?.message || err),
    };
  }
};
