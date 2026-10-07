// Sprint 6 (launch-scope.md section 7.1): the four launch templates --
// payment receipt, first notice, final notice, payout released. Deliberately
// plain (a wrapper + a heading + a paragraph or two + a link) rather than a
// branded HTML layout -- there is no design system for transactional email
// in this repo yet, and a plain, readable template beats an unfinished
// branded one.
//
// Branding is env-driven so it can be filled in later without touching this
// file again: EMAIL_LOGO_URL (a hosted image -- do NOT inline a base64 logo,
// it bloats the message and hurts spam scoring; host a small PNG/SVG
// somewhere stable, e.g. alongside the marketing site or in object storage,
// and point this at its URL), EMAIL_BRAND_NAME, EMAIL_SUPPORT_EMAIL,
// EMAIL_SITE_URL, and EMAIL_COMPANY_ADDRESS (a real physical mailing
// address -- deliberately blank by default rather than a placeholder,
// because a fabricated address is worse than none; every line below that
// depends on it just doesn't render until it's set).
const BRAND_NAME = process.env.EMAIL_BRAND_NAME || "Made for Stream";
const LOGO_URL = process.env.EMAIL_LOGO_URL || "";
const SUPPORT_EMAIL = process.env.EMAIL_SUPPORT_EMAIL || "support@madeforstream.com";
const SITE_URL = process.env.EMAIL_SITE_URL || "https://madeforstream.com";
const COMPANY_ADDRESS = process.env.EMAIL_COMPANY_ADDRESS || "";
// The published address already starts with the brand name ("Made for
// Stream, P.O. Box ..."), so don't print the name twice.
const FOOTER_ADDRESS = !COMPANY_ADDRESS
  ? BRAND_NAME
  : COMPANY_ADDRESS.startsWith(BRAND_NAME)
    ? COMPANY_ADDRESS
    : `${BRAND_NAME} &middot; ${COMPANY_ADDRESS}`;

// Text that came from a person (a title, a reviewer's note) is escaped
// before it goes into HTML.
export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// The shared look, matching the Supabase Auth templates
// (supabase/templates/build.mjs): colours from src/styles/theme.css, a
// purple-to-orange header band, the site's indigo button gradient, each
// gradient with a solid fallback for clients that drop gradients (Outlook).
// The dark version follows the reader's system setting in Apple Mail, iOS
// Mail and Outlook for Mac; Gmail ignores it and darkens the light version.
const wrap = (title, bodyHtml, ctaUrl, ctaLabel) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${title}</title>
    <style>
      @media (prefers-color-scheme: dark) {
        .mfs-bg { background:#111018 !important; }
        .mfs-card { background:#1a1922 !important; border-color:#2b2a36 !important; }
        .mfs-content p, .mfs-content td, .mfs-content li { color:#c9c5ea !important; }
        .mfs-content h1, .mfs-content strong { color:#ededf5 !important; }
        .mfs-content a { color:#b9b4e0 !important; }
        .mfs-note { background:#20202c !important; border-color:#2b2a36 !important; }
        .mfs-footer, .mfs-footer a { color:#a8a6b6 !important; border-top-color:#2b2a36 !important; }
        .mfs-btn { background-color:#ededf5 !important; background-image:linear-gradient(180deg,#ffffff,#e8e8f4) !important; }
        .mfs-content .mfs-btn a { color:#111018 !important; }
      }
    </style>
  </head>
  <body class="mfs-bg" style="margin:0;padding:0;background:#f7f7ff;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mfs-bg" style="background:#f7f7ff;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mfs-card" style="max-width:480px;background:#ffffff;border-radius:10px;border:1px solid #e6e4f5;">
            <tr><td bgcolor="#6b34e0" style="background-color:#6b34e0;background-image:linear-gradient(120deg,#6b34e0 0%,#a0459c 55%,#f05828 100%);border-radius:10px 10px 0 0;padding:22px 32px;">
              ${
                LOGO_URL
                  ? `<img src="${LOGO_URL}" alt="${BRAND_NAME}" height="28" style="display:block;border:0;" />`
                  : `<p style="margin:0;font-size:17px;font-weight:bold;letter-spacing:0.01em;color:#ffffff;">${BRAND_NAME}</p>`
              }
            </td></tr>
            <tr><td class="mfs-content" style="padding:32px;">
              <h1 style="font-size:20px;line-height:1.3;margin:0 0 16px;color:#18181b;">${title}</h1>
              ${bodyHtml}
              ${
                ctaUrl
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td bgcolor="#33209a" class="mfs-btn" style="border-radius:8px;background-color:#33209a;background-image:linear-gradient(180deg,#33209a,#271870);">
                <a href="${ctaUrl}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;border-radius:8px;">${ctaLabel}</a>
              </td></tr></table>`
                  : ""
              }
              <p class="mfs-footer" style="margin:32px 0 0;padding-top:16px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;line-height:1.6;">
                ${FOOTER_ADDRESS}<br />
                Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:#71717a;">${SUPPORT_EMAIL}</a>
                &middot; <a href="${SITE_URL}" style="color:#71717a;">${SITE_URL.replace(/^https?:\/\//, "")}</a>
              </p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

const formatCents = (cents, currency) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
  }).format((cents || 0) / 100);

export const renderPaymentReceiptEmail = ({
  requestTitle,
  amountCents,
  currency,
  requestUrl,
}) => {
  const amount = formatCents(amountCents, currency);
  const subject = `Receipt: ${amount} for "${requestTitle}"`;

  return {
    subject,
    text: `We received your payment of ${amount} for "${requestTitle}". View the commission: ${requestUrl}`,
    html: wrap(
      "Payment received",
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;">We received your payment of <strong>${amount}</strong> for "${escapeHtml(requestTitle)}".</p>`,
      requestUrl,
      "View commission",
    ),
  };
};

export const renderFirstNoticeEmail = ({
  requestTitle,
  requestedAction,
  expiresAt,
  requestUrl,
}) => {
  const subject = `Action needed on "${requestTitle}"`;
  const expiresLabel = new Date(expiresAt).toLocaleString();

  return {
    subject,
    text: `A notice was sent on "${requestTitle}": ${requestedAction}. Please reply by ${expiresLabel}. ${requestUrl}`,
    html: wrap(
      "A reply is needed",
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;">On <strong>${escapeHtml(requestTitle)}</strong>, the other party needs: ${escapeHtml(requestedAction)}</p>
       <p style="margin:0 0 8px;font-size:14px;line-height:1.5;">Please reply by <strong>${expiresLabel}</strong>. A final notice may follow if there is no reply.</p>`,
      requestUrl,
      "Open commission",
    ),
  };
};

export const renderFinalNoticeEmail = ({
  requestTitle,
  requestedAction,
  expiresAt,
  requestUrl,
}) => {
  const subject = `Final notice: "${requestTitle}"`;
  const expiresLabel = new Date(expiresAt).toLocaleString();

  return {
    subject,
    text: `Final notice on "${requestTitle}": ${requestedAction}. This grants a further 7 days, until ${expiresLabel}. Administrative closure may follow. ${requestUrl}`,
    html: wrap(
      "Final notice",
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;">This is a <strong>final notice</strong> on "${escapeHtml(requestTitle)}": ${escapeHtml(requestedAction)}</p>
       <p style="margin:0 0 8px;font-size:14px;line-height:1.5;">You have until <strong>${expiresLabel}</strong> to reply. After that, the other party may request that Made for Stream administratively close this project.</p>`,
      requestUrl,
      "Open commission",
    ),
  };
};

export const renderPayoutReleasedEmail = ({
  amountCents,
  currency,
  arrivalDate,
  requestUrl,
}) => {
  const amount = formatCents(amountCents, currency);
  const subject = `Payout released: ${amount}`;

  return {
    subject,
    text: `A payout of ${amount} was released and is on its way to your bank${
      arrivalDate ? ` (expected ${arrivalDate})` : ""
    }. ${requestUrl}`,
    html: wrap(
      "Payout released",
      `<p style="margin:0 0 8px;font-size:14px;line-height:1.5;">A payout of <strong>${amount}</strong> was released from your held balance and is on its way to your bank${
        arrivalDate ? ` (expected ${arrivalDate})` : ""
      }.</p>`,
      requestUrl,
      "View payouts",
    ),
  };
};

// Creator application decisions (api/creatorApplicationEmail.js). `note` is
// what the reviewer wrote for the applicant; it is escaped, and shown in a
// quoted box so it reads as the reviewer's words, not ours.
const applicationNote = (label, note) =>
  note
    ? `<p style="margin:16px 0 6px;font-size:13px;font-weight:bold;color:#52525b;">${label}</p>
       <p class="mfs-note" style="margin:0;padding:12px 14px;font-size:14px;line-height:1.6;color:#3f3f46;background:#f4f3fc;border:1px solid #e6e4f5;border-radius:8px;white-space:pre-wrap;">${escapeHtml(note)}</p>`
    : "";

const paragraph = (html) =>
  `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46;">${html}</p>`;

export const renderCreatorApplicationDecisionEmail = ({ status, note = "" }) => {
  const applicationUrl = `${SITE_URL}/apply/creator`;
  const cleanNote = String(note || "").trim();
  const textNote = (label) => (cleanNote ? `\n\n${label}\n${cleanNote}` : "");

  if (status === "approved") {
    const settingsUrl = `${SITE_URL}/settings`;

    return {
      subject: `You're approved as a creator on ${BRAND_NAME}`,
      text:
        `Good news: your creator application was approved.\n\n` +
        `Two steps before you can take paid work:\n` +
        `1. Set up payouts in Settings, so you can be paid. This is done through Stripe and takes a few minutes.\n` +
        `2. Publish your first listing.\n\n` +
        `Free listings don't need payouts set up.${textNote("A note from the reviewer:")}\n\n${settingsUrl}`,
      html: wrap(
        "You're approved",
        paragraph(`Good news: your creator application was approved. Welcome to ${BRAND_NAME}.`) +
          paragraph("Two steps before you can take paid work:") +
          `<ol style="margin:0 0 12px;padding-left:20px;font-size:15px;line-height:1.6;color:#3f3f46;">
             <li style="margin:0 0 6px;"><strong>Set up payouts</strong> in Settings, so you can be paid. This is done through Stripe and takes a few minutes.</li>
             <li><strong>Publish your first listing.</strong></li>
           </ol>` +
          paragraph("Free listings don't need payouts set up.") +
          applicationNote("A note from the reviewer", cleanNote),
        settingsUrl,
        "Set up payouts",
      ),
    };
  }

  if (status === "needs_changes") {
    return {
      subject: `Your ${BRAND_NAME} creator application needs changes`,
      text:
        `We've reviewed your creator application and it needs a few changes before we can approve it.` +
        `${textNote("What to change:")}\n\n` +
        `Update your application and submit it again. You don't need to start over.\n\n${applicationUrl}`,
      html: wrap(
        "Your application needs changes",
        paragraph("We've reviewed your creator application and it needs a few changes before we can approve it.") +
          applicationNote("What to change", cleanNote) +
          `<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#3f3f46;">Update your application and submit it again. You don't need to start over.</p>`,
        applicationUrl,
        "Update application",
      ),
    };
  }

  if (status === "rejected") {
    return {
      subject: `An update on your ${BRAND_NAME} creator application`,
      text:
        `Thank you for applying to be a creator on ${BRAND_NAME}. After reviewing your application, we aren't able to approve it at this time.` +
        `${textNote("Reason:")}\n\n` +
        `You can still use ${BRAND_NAME} as a buyer. If you think this decision was a mistake, reply to ${SUPPORT_EMAIL}.\n\n${applicationUrl}`,
      html: wrap(
        "An update on your application",
        paragraph(`Thank you for applying to be a creator on ${BRAND_NAME}. After reviewing your application, we aren't able to approve it at this time.`) +
          applicationNote("Reason", cleanNote) +
          `<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#3f3f46;">You can still use ${BRAND_NAME} as a buyer. If you think this decision was a mistake, contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#33209a;">${SUPPORT_EMAIL}</a>.</p>`,
        applicationUrl,
        "View application",
      ),
    };
  }

  throw new Error(`No creator application email for status "${status}".`);
};
