// Sprint 9: operational alerting. public.list_ops_alerts() (20260924_139)
// returns every open alert; this module decides what to email and renders
// the digest. Delivery is api/email.js to OPS_ALERT_EMAIL. The route is
// POST /api/internal/ops/alerts/run, called hourly by Cloud Scheduler.
// Playbook: docs/support/operations/alerting.md.

// One entry per branch of list_ops_alerts(). `remind: false` means the alert
// is emailed once per subject and never repeated -- used where a row never
// resolves on its own. opsAlerts.test.js checks this list against the
// migration and against the playbooks.
//
// `meaning` and `todo` are what the digest shows a person; `describe(detail,
// row)` turns one row into a sentence, and `link(detail, row)` is the admin
// page path to open (or null when there is none).
const requestLink = (id) => (id ? `/admin/requests/${id}` : null);

export const OPS_ALERTS = {
  stuck_payment: {
    playbookIssue: "PAY-005",
    playbook: "docs/support/payments/checkout.md",
    title: "Payment stuck in checkout",
    meaning: "A buyer opened checkout and the payment never finished or expired. If they paid, we never heard back from Stripe.",
    todo: "Check the payment in Stripe. If it was paid, reconcile it; if not, it can be left to expire.",
    remind: true,
    describe: (d) =>
      `${formatMoney(d.total_checkout_cents, d.currency)} payment, still "${String(d.status || "").replace("_", " ")}"`,
    link: (d) => requestLink(d.listing_request_id),
  },
  change_order_payment_missing: {
    playbookIssue: "CHG-003",
    playbook: "docs/support/requests/change-orders.md",
    title: "Accepted change order has no payment",
    meaning: "The buyer accepted a price increase, but the payment for the difference was never created, so they have no way to pay it.",
    todo: "Do not create the payment by hand. Escalate with the change order and the request's payments.",
    remind: true,
    describe: (d) =>
      `Price raised by ${formatAmount(d.price_delta)}; ${d.has_schedule_item ? "the payment row is missing" : "the schedule item and payment are both missing"}`,
    link: (d) => requestLink(d.listing_request_id),
  },
  stale_request: {
    playbookIssue: "REQ-003",
    playbook: "docs/support/requests/request-lifecycle.md",
    title: "Project gone quiet",
    meaning: "An active project has had no messages or updates for over 14 days. One side may have stopped responding.",
    todo: "Open the request and decide whether to nudge, send a notice, or close it.",
    remind: true,
    describe: (d) =>
      `No activity for ${Math.round(Number(d.days_since_activity) || 0)} days; ${d.has_open_notice ? "a notice is waiting for a reply" : "no notice has been sent"}`,
    link: (_d, row) => requestLink(row.subject_id),
  },
  tax_evidence_insufficient: {
    playbookIssue: "TAX-002",
    playbook: "docs/support/payments/tax.md",
    title: "Tax location evidence is weak",
    meaning: "We charged tax for a country but don't have two matching pieces of evidence that the buyer is there.",
    todo: "Check the payment's evidence rows. Contradictory evidence goes to whoever handles tax filings.",
    remind: true,
    describe: (d) =>
      `Taxed as ${d.tax_jurisdiction_country || "?"}; evidence is ${d.evidence_status}${d.conflicting_country ? ` (points to ${d.conflicting_country})` : ""}`,
    link: () => "/admin/payment-issues",
  },
  tax_transaction_missing: {
    playbookIssue: "TAX-003",
    playbook: "docs/support/payments/tax.md",
    title: "Collected tax not recorded with Stripe Tax",
    meaning: "The buyer paid tax, but it isn't in Stripe Tax's records, so it would be missing from the tax filing.",
    todo: "Create the Stripe Tax transaction by hand before the filing period closes (steps in the playbook).",
    remind: true,
    describe: () => "Paid, with tax, but no Stripe Tax transaction",
    link: () => "/admin/payment-issues",
  },
  tax_reversal_missing: {
    playbookIssue: "TAX-004",
    playbook: "docs/support/payments/tax.md",
    title: "Refunded tax not reversed in Stripe Tax",
    meaning: "A refund gave tax back to the buyer, but Stripe Tax still counts it, so the filing would over-report.",
    todo: "Create the partial reversal by hand, matching the refund ledger row exactly.",
    remind: true,
    describe: (d) => `Refund ${d.stripe_refund_id || ""} returned ${formatAmount((Number(d.tax_refund_cents) || 0) / 100)} of tax`.replace("  ", " "),
    link: () => "/admin/payment-issues",
  },
  paid_wave2_currency: {
    playbookIssue: "TAX-007",
    playbook: "docs/support/payments/tax.md",
    title: "Sale in a currency other than CAD or USD",
    meaning: "Someone paid in a currency where our tax advice is still open. EU VAT, for example, applies from the first sale.",
    todo: "Nothing to fix on the payment. Use this as the prompt to chase the tax advice.",
    remind: false,
    describe: (d) => `Paid in ${String(d.currency || "").toUpperCase()}`,
    link: () => "/admin/payment-issues",
  },
  payment_account_lost_readiness: {
    playbookIssue: "CON-003",
    playbook: "docs/support/payments/connect-onboarding.md",
    title: "Creator restricted by Stripe, listings still live",
    meaning: "Stripe restricted a creator's account. New paid work is already blocked, but their listings are still published.",
    todo: "Tell the creator what Stripe needs, and decide whether to unpublish their listings.",
    remind: true,
    describe: (d) =>
      `${plural(d.active_listing_count, "live listing")}; ${plural(d.requirements_past_due_count, "past-due Stripe requirement")}`,
    link: () => "/admin/listings",
  },
  payment_account_mirror_stale: {
    playbookIssue: "CON-006",
    playbook: "docs/support/payments/connect-onboarding.md",
    title: "Creator's Stripe status not refreshed",
    meaning: "We haven't re-checked this creator's Stripe account in over 48 hours, so the hourly resync is probably failing.",
    todo: "Check the mfs-connect-resync job in Cloud Scheduler and the CON-006 log lines.",
    remind: true,
    describe: (d) => `Stripe account ${d.stripe_account_id || "?"}`,
    link: () => null,
  },
};

export const OPS_ALERT_REMINDER_MS = 24 * 60 * 60 * 1000;

const alertKey = (alertId, subjectId) => `${alertId}\u0000${subjectId}`;

// rows: list_ops_alerts() output. state: ops_alert_notifications rows.
// Returns what to email and how to update the state table:
//   send       -- whether to send a digest this run
//   rows       -- the rows to include (each with isNew), when sending
//   unknown    -- alert ids the registry does not know (a code bug; they
//                 are still emailed, under their own id)
//   upserts    -- state rows to write if the send succeeds
//   pending    -- state rows to write if it does not (records first sight
//                 without claiming a notification, so the next run retries)
//   deletes    -- resolved subjects to remove from state
export const planOpsAlertDigest = ({
  rows,
  state,
  now = Date.now(),
  reminderMs = OPS_ALERT_REMINDER_MS,
}) => {
  const current = Array.isArray(rows) ? rows : [];
  const known = new Map(
    (Array.isArray(state) ? state : []).map((entry) => [
      alertKey(entry.alert_id, entry.subject_id),
      entry,
    ]),
  );

  const nowIso = new Date(now).toISOString();
  const seen = new Set();
  const included = [];
  const upserts = [];
  const pending = [];
  const unknown = new Set();

  for (const row of current) {
    const key = alertKey(row.alert_id, row.subject_id);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    const definition = OPS_ALERTS[row.alert_id];

    if (!definition) {
      unknown.add(row.alert_id);
    }

    const previous = known.get(key);
    const lastNotified = previous?.last_notified_at
      ? Date.parse(previous.last_notified_at)
      : null;
    const isNew = lastNotified === null;
    const remind = definition ? definition.remind : true;
    const reminderDue =
      !isNew && remind && now - lastNotified >= reminderMs;

    const base = {
      alert_id: row.alert_id,
      subject_id: row.subject_id,
      playbook_issue: row.playbook_issue,
      first_seen_at: previous?.first_seen_at || nowIso,
    };

    if (isNew || reminderDue) {
      included.push({ ...row, isNew });
      upserts.push({ ...base, last_notified_at: nowIso });
      pending.push({ ...base, last_notified_at: previous?.last_notified_at ?? null });
    } else {
      upserts.push({ ...base, last_notified_at: previous.last_notified_at });
      pending.push({ ...base, last_notified_at: previous.last_notified_at });
    }
  }

  const deletes = [...known.values()]
    .filter((entry) => !seen.has(alertKey(entry.alert_id, entry.subject_id)))
    .map((entry) => ({ alert_id: entry.alert_id, subject_id: entry.subject_id }));

  return {
    send: included.length > 0,
    rows: included,
    unknown: [...unknown],
    upserts,
    pending,
    deletes,
  };
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// ponytail: one fixed display zone (the operator is in Calgary); make it a
// parameter if ops is ever read from elsewhere.
const DISPLAY_TIME_ZONE = "America/Edmonton";

function formatMoney(cents, currency) {
  return `${((Number(cents) || 0) / 100).toFixed(2)} ${String(currency || "").toUpperCase()}`.trim();
}

function formatAmount(value) {
  return (Number(value) || 0).toFixed(2);
}

function plural(count, noun) {
  const n = Number(count) || 0;
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

// "20 Jun 2026 (98 days ago)" -- the date something went wrong, and how long
// it has been, since that is what decides urgency.
export const formatSince = (iso, now = Date.now()) => {
  const at = Date.parse(iso);

  if (Number.isNaN(at)) {
    return "";
  }

  const date = new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(at);

  const hours = Math.floor((now - at) / 3_600_000);
  const ago =
    hours < 1 ? "under an hour ago" : hours < 48 ? `${plural(hours, "hour")} ago` : `${plural(Math.round(hours / 24), "day")} ago`;

  return `${date} (${ago})`;
};

const describeRow = (definition, row) => {
  const detail = row.detail && typeof row.detail === "object" ? row.detail : {};

  if (!definition) {
    return {
      sentence: Object.entries(detail)
        .map(([key, value]) => `${key}=${value}`)
        .join(", "),
      path: null,
    };
  }

  return {
    sentence: definition.describe(detail, row),
    path: definition.link(detail, row),
  };
};

// One section per alert type: what it means, what to do, then one line per
// affected item with its date and an admin link. The raw id is kept, small,
// for searching logs and the database.
export const renderOpsAlertDigest = ({
  rows,
  repoUrl = "",
  siteUrl = "https://madeforstream.com",
  now = Date.now(),
}) => {
  const groups = new Map();

  for (const row of rows) {
    if (!groups.has(row.alert_id)) {
      groups.set(row.alert_id, []);
    }

    groups.get(row.alert_id).push(row);
  }

  const newCount = rows.filter((row) => row.isNew).length;
  const titles = [...groups.keys()].map(
    (alertId) => OPS_ALERTS[alertId]?.title || alertId,
  );

  const subject = `[Made for Stream ops] ${titles.length === 1 ? titles[0] : plural(rows.length, "open alert")}${
    newCount ? ` (${newCount} new)` : ""
  }`;

  const textSections = [];
  const htmlSections = [];

  for (const [alertId, groupRows] of groups) {
    const definition = OPS_ALERTS[alertId];
    const issue = groupRows[0].playbook_issue;
    const title = definition?.title || `Unregistered alert ${alertId}`;
    const playbook = definition?.playbook || "docs/support/operations/alerting.md";
    const playbookUrl = repoUrl ? `${repoUrl}/${playbook}` : playbook;

    const items = groupRows.map((row) => {
      const { sentence, path } = describeRow(definition, row);
      return {
        row,
        sentence,
        url: path ? `${siteUrl}${path}` : null,
        since: row.observed_at ? formatSince(row.observed_at, now) : "",
      };
    });

    textSections.push(
      [
        `${title.toUpperCase()} (${plural(groupRows.length, "item")})`,
        definition ? `What happened: ${definition.meaning}` : null,
        definition ? `What to do: ${definition.todo}` : null,
        "",
        ...items.map(
          ({ row, sentence, url, since }) =>
            `- ${row.isNew ? "NEW: " : ""}${sentence}${since ? `, since ${since}` : ""}` +
            `${url ? `\n  Open: ${url}` : ""}\n  ID: ${row.subject_id}`,
        ),
        "",
        `Full steps: ${issue} in ${playbookUrl}`,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    );

    htmlSections.push(`
<div style="border:1px solid #e4e4e7;border-radius:8px;padding:16px 18px;margin:0 0 16px;">
  <p style="margin:0 0 4px;font-size:12px;color:#71717a;">${escapeHtml(issue)} &middot; ${plural(groupRows.length, "item")}</p>
  <h2 style="margin:0 0 10px;font-size:17px;color:#18181b;">${escapeHtml(title)}</h2>
  ${
    definition
      ? `<p style="margin:0 0 6px;font-size:14px;line-height:1.5;"><strong>What happened:</strong> ${escapeHtml(definition.meaning)}</p>
  <p style="margin:0 0 12px;font-size:14px;line-height:1.5;"><strong>What to do:</strong> ${escapeHtml(definition.todo)}</p>`
      : ""
  }
  ${items
    .map(
      ({ row, sentence, url, since }) => `
  <div style="background:#f4f4f5;border-radius:6px;padding:10px 12px;margin:0 0 8px;">
    <p style="margin:0;font-size:14px;line-height:1.4;">${row.isNew ? '<span style="background:#dc2626;color:#fff;font-size:11px;font-weight:bold;padding:1px 6px;border-radius:4px;margin-right:6px;">NEW</span>' : ""}${escapeHtml(sentence)}</p>
    ${since ? `<p style="margin:4px 0 0;font-size:13px;color:#52525b;">Since ${escapeHtml(since)}</p>` : ""}
    ${url ? `<p style="margin:8px 0 0;"><a href="${escapeHtml(url)}" style="background:#18181b;color:#fff;padding:6px 12px;border-radius:5px;text-decoration:none;font-size:13px;">Open in admin</a></p>` : ""}
    <p style="margin:6px 0 0;font-size:11px;color:#a1a1aa;">ID ${escapeHtml(row.subject_id)}</p>
  </div>`,
    )
    .join("")}
  <p style="margin:10px 0 0;font-size:12px;"><a href="${escapeHtml(playbookUrl)}" style="color:#52525b;">Full troubleshooting steps (${escapeHtml(issue)})</a></p>
</div>`);
  }

  const footer =
    "You get each alert once, then a daily reminder while it's still open (currency alerts are sent once only).";

  return {
    subject,
    text: `${textSections.join("\n\n")}\n\n${footer}\n`,
    html: `<!doctype html><html><body style="margin:0;padding:24px 0;background:#fafafa;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
<div style="max-width:560px;margin:0 auto;padding:0 16px;">
<p style="margin:0 0 16px;font-size:13px;font-weight:bold;color:#52525b;">Made for Stream &middot; Ops alerts</p>
${htmlSections.join("")}
<p style="margin:16px 0 0;font-size:12px;color:#71717a;">${escapeHtml(footer)}</p>
</div></body></html>`,
  };
};

// Cloud Scheduler sends "Authorization: Bearer <OPS_CRON_SECRET>". Returns
// false when the secret is unset, so an unconfigured deploy refuses rather
// than running the jobs for anyone. Constant-time over equal-length input.
export const isAuthorizedOpsRequest = (authorizationHeader, secret, timingSafeEqual) => {
  if (!secret || typeof secret !== "string" || secret.length < 32) {
    return false;
  }

  const match = /^Bearer (.+)$/.exec(String(authorizationHeader || ""));

  if (!match) {
    return false;
  }

  const given = Buffer.from(match[1]);
  const expected = Buffer.from(secret);

  if (given.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(given, expected);
};
