import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import {
  OPS_ALERTS,
  OPS_ALERT_REMINDER_MS,
  isAuthorizedOpsRequest,
  planOpsAlertDigest,
  renderOpsAlertDigest,
} from "../opsAlerts.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readRepoFile = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const migration = readRepoFile(
  "supabase/migrations/20260924_139_add_connect_account_state_and_ops_alerts.sql",
);

const listOpsAlertsBody = migration.slice(
  migration.indexOf("create or replace function public.list_ops_alerts()"),
  migration.indexOf("revoke all on function public.list_ops_alerts()"),
);

describe("alert registry", () => {
  it("matches list_ops_alerts() branch for branch, with the same playbook issue", () => {
    const pairs = [
      ...listOpsAlertsBody.matchAll(
        /select\s+'([a-z0-9_]+)'(?:::text)?,\s+'([A-Z]+-\d{3})'/g,
      ),
    ].map((match) => [match[1], match[2]]);

    expect(pairs.length).toBe(Object.keys(OPS_ALERTS).length);
    expect(Object.fromEntries(pairs)).toEqual(
      Object.fromEntries(
        Object.entries(OPS_ALERTS).map(([id, alert]) => [id, alert.playbookIssue]),
      ),
    );
  });

  it.each(Object.entries(OPS_ALERTS))(
    "%s points at a playbook issue that exists",
    (_id, alert) => {
      const playbook = readRepoFile(alert.playbook);
      expect(playbook).toContain(`## \`${alert.playbookIssue}\``);
      expect(playbook).toContain(`id: ${alert.playbookIssue}`);
    },
  );

  it("names only columns that exist on the tables each branch reads", () => {
    // Columns this sprint's alert queries reference, per table. Verified
    // against the live schema (information_schema.columns) on 2026-09-24,
    // plus 20260924_139's own additions to creator_payment_accounts.
    const knownColumns = {
      p: [
        "id", "status", "updated_at", "currency", "total_checkout_cents",
        "listing_request_id", "tax_treatment", "paid_at",
        "tax_jurisdiction_country", "stripe_tax_calculation_id",
        "stripe_tax_transaction_id", "payment_schedule_item_id",
      ],
      co: [
        "id", "status", "changes_price", "price_delta", "buyer_accepted_at",
        "updated_at", "listing_request_id", "revised_total_amount",
      ],
      si: ["id", "change_order_id"],
      s: ["listing_request_id", "last_activity_at", "days_since_activity", "has_open_notice"],
      e: ["evidence_status", "conflicting_country"],
      r: [
        "id", "created_at", "payment_id", "stripe_refund_id",
        "tax_refund_cents", "stripe_tax_reversal_id",
      ],
      a: [
        "user_id", "stripe_account_id", "charges_enabled", "payouts_enabled",
        "details_submitted", "readiness_lost_at", "requirements_due_count",
        "requirements_past_due_count", "last_synced_at",
      ],
      l: ["user_id", "status", "is_active"],
    };

    const references = [
      ...listOpsAlertsBody.matchAll(/\b([a-z]{1,2})\.([a-z_]+)\b/g),
    ].filter(([, alias]) => alias in knownColumns);

    expect(references.length).toBeGreaterThan(40);

    for (const [whole, alias, column] of references) {
      expect(knownColumns[alias], whole).toContain(column);
    }
  });

  it("adds every creator_payment_accounts column the CON alerts read", () => {
    for (const column of [
      "readiness_lost_at",
      "requirements_due_count",
      "requirements_past_due_count",
      "stripe_state_observed_at",
    ]) {
      expect(migration).toMatch(new RegExp(`add column if not exists ${column}\\b`));
    }
  });
});

describe("planOpsAlertDigest", () => {
  const now = Date.parse("2026-09-24T12:00:00.000Z");
  const row = (alertId, subjectId, extra = {}) => ({
    alert_id: alertId,
    playbook_issue: OPS_ALERTS[alertId]?.playbookIssue ?? "OPS-003",
    subject_id: subjectId,
    observed_at: "2026-09-23T00:00:00.000Z",
    detail: {},
    ...extra,
  });

  it("sends nothing when nothing is open", () => {
    const plan = planOpsAlertDigest({ rows: [], state: [], now });

    expect(plan.send).toBe(false);
    expect(plan.upserts).toEqual([]);
  });

  it("emails a new alert and records that it was notified", () => {
    const plan = planOpsAlertDigest({
      rows: [row("stuck_payment", "pay-1")],
      state: [],
      now,
    });

    expect(plan.send).toBe(true);
    expect(plan.rows).toEqual([expect.objectContaining({ subject_id: "pay-1", isNew: true })]);
    expect(plan.upserts[0]).toMatchObject({
      alert_id: "stuck_payment",
      subject_id: "pay-1",
      playbook_issue: "PAY-005",
      last_notified_at: new Date(now).toISOString(),
    });
    expect(plan.pending[0].last_notified_at).toBeNull();
  });

  it("does not repeat an alert inside the reminder window", () => {
    const plan = planOpsAlertDigest({
      rows: [row("stuck_payment", "pay-1")],
      state: [
        {
          alert_id: "stuck_payment",
          subject_id: "pay-1",
          first_seen_at: "2026-09-24T10:00:00.000Z",
          last_notified_at: "2026-09-24T10:00:00.000Z",
        },
      ],
      now,
    });

    expect(plan.send).toBe(false);
    expect(plan.upserts[0].last_notified_at).toBe("2026-09-24T10:00:00.000Z");
  });

  it("reminds daily while an alert stays open, and includes it as not new", () => {
    const plan = planOpsAlertDigest({
      rows: [row("stuck_payment", "pay-1")],
      state: [
        {
          alert_id: "stuck_payment",
          subject_id: "pay-1",
          first_seen_at: "2026-09-23T11:00:00.000Z",
          last_notified_at: new Date(now - OPS_ALERT_REMINDER_MS).toISOString(),
        },
      ],
      now,
    });

    expect(plan.send).toBe(true);
    expect(plan.rows[0].isNew).toBe(false);
    expect(plan.upserts[0].first_seen_at).toBe("2026-09-23T11:00:00.000Z");
  });

  it("sends TAX-007 once only", () => {
    const plan = planOpsAlertDigest({
      rows: [row("paid_wave2_currency", "pay-eur")],
      state: [
        {
          alert_id: "paid_wave2_currency",
          subject_id: "pay-eur",
          first_seen_at: "2026-09-01T00:00:00.000Z",
          last_notified_at: "2026-09-01T00:00:00.000Z",
        },
      ],
      now,
    });

    expect(plan.send).toBe(false);
  });

  it("retries next run when the email fails, without losing first sight", () => {
    const plan = planOpsAlertDigest({
      rows: [row("tax_reversal_missing", "refund-1")],
      state: [],
      now,
    });

    expect(plan.pending).toEqual([
      expect.objectContaining({
        subject_id: "refund-1",
        first_seen_at: new Date(now).toISOString(),
        last_notified_at: null,
      }),
    ]);

    const nextRun = planOpsAlertDigest({
      rows: [row("tax_reversal_missing", "refund-1")],
      state: plan.pending,
      now: now + 3600 * 1000,
    });

    expect(nextRun.send).toBe(true);
    expect(nextRun.rows[0].isNew).toBe(true);
  });

  it("forgets resolved alerts, so a recurrence is new again", () => {
    const plan = planOpsAlertDigest({
      rows: [],
      state: [
        {
          alert_id: "stale_request",
          subject_id: "req-1",
          first_seen_at: "2026-09-20T00:00:00.000Z",
          last_notified_at: "2026-09-20T00:00:00.000Z",
        },
      ],
      now,
    });

    expect(plan.deletes).toEqual([{ alert_id: "stale_request", subject_id: "req-1" }]);
  });

  it("still emails an alert id the registry does not know, and reports it", () => {
    const plan = planOpsAlertDigest({
      rows: [row("mystery", "x")],
      state: [],
      now,
    });

    expect(plan.send).toBe(true);
    expect(plan.unknown).toEqual(["mystery"]);
  });

  it("collapses duplicate rows for the same subject", () => {
    const plan = planOpsAlertDigest({
      rows: [row("stale_request", "req-1"), row("stale_request", "req-1")],
      state: [],
      now,
    });

    expect(plan.rows).toHaveLength(1);
    expect(plan.upserts).toHaveLength(1);
  });
});

describe("renderOpsAlertDigest", () => {
  const now = Date.parse("2026-09-26T22:10:00.000Z");
  const render = (rows) =>
    renderOpsAlertDigest({
      rows,
      repoUrl: "https://github.com/Alvintol/creator-hub/blob/main",
      siteUrl: "https://madeforstream.com",
      now,
    });

  it("explains a stale request in plain language, with a readable date and an admin link", () => {
    const { subject, text, html } = render([
      {
        alert_id: "stale_request",
        playbook_issue: "REQ-003",
        subject_id: "e1ee74b1-a947-45a4-bbb6-b77cde0b5c05",
        observed_at: "2026-06-20T22:59:20.301036+00:00",
        detail: { has_open_notice: false, days_since_activity: 98 },
        isNew: true,
      },
    ]);

    expect(subject).toBe("[Made for Stream ops] Project gone quiet (1 new)");
    expect(text).toContain("What happened: An active project has had no messages");
    expect(text).toContain("- NEW: No activity for 98 days; no notice has been sent, since Jun 20, 2026 (98 days ago)");
    expect(text).toContain("Open: https://madeforstream.com/admin/requests/e1ee74b1-a947-45a4-bbb6-b77cde0b5c05");
    expect(text).toContain(
      "Full steps: REQ-003 in https://github.com/Alvintol/creator-hub/blob/main/docs/support/requests/request-lifecycle.md",
    );
    expect(html).toContain('href="https://madeforstream.com/admin/requests/e1ee74b1-a947-45a4-bbb6-b77cde0b5c05"');
    expect(html).not.toContain("has_open_notice");
  });

  it("describes every registered alert without leaking raw keys", () => {
    const detailFor = {
      stuck_payment: { status: "checkout_opened", currency: "cad", total_checkout_cents: 5250, listing_request_id: "req-1" },
      change_order_payment_missing: { listing_request_id: "req-2", price_delta: 25, revised_total_amount: 125, has_schedule_item: true },
      stale_request: { days_since_activity: 20, has_open_notice: true },
      tax_evidence_insufficient: { evidence_status: "contradictory", tax_jurisdiction_country: "GB", conflicting_country: "IE" },
      tax_transaction_missing: { stripe_tax_calculation_id: "taxcalc_1" },
      tax_reversal_missing: { payment_id: "pay-1", stripe_refund_id: "re_1", tax_refund_cents: 150 },
      paid_wave2_currency: { currency: "eur", status: "paid" },
      payment_account_lost_readiness: { stripe_account_id: "acct_1", active_listing_count: 1, requirements_past_due_count: 2 },
      payment_account_mirror_stale: { stripe_account_id: "acct_2" },
    };

    const rows = Object.entries(OPS_ALERTS).map(([alertId, alert]) => ({
      alert_id: alertId,
      playbook_issue: alert.playbookIssue,
      subject_id: `subject-${alertId}`,
      observed_at: "2026-09-26T20:00:00.000Z",
      detail: detailFor[alertId],
      isNew: false,
    }));

    const { subject, text, html } = render(rows);

    expect(subject).toBe("[Made for Stream ops] 9 open alerts");
    expect(text).toContain("52.50 CAD payment, still \"checkout opened\"");
    expect(text).toContain("Price raised by 25.00; the payment row is missing");
    expect(text).toContain("Taxed as GB; evidence is contradictory (points to IE)");
    expect(text).toContain("Refund re_1 returned 1.50 of tax");
    expect(text).toContain("Paid in EUR");
    expect(text).toContain("1 live listing; 2 past-due Stripe requirements");
    expect(text).toContain("(2 hours ago)");
    for (const alert of Object.values(OPS_ALERTS)) {
      expect(text).toContain(alert.title.toUpperCase());
    }
    expect(html).not.toMatch(/undefined|NaN|\[object Object\]/);
    expect(text).not.toMatch(/undefined|NaN|\[object Object\]/);
  });

  it("still renders an unregistered alert, and escapes HTML", () => {
    const { text, html } = render([
      {
        alert_id: "mystery",
        playbook_issue: "OPS-003",
        subject_id: "x<1>",
        observed_at: null,
        detail: { a: "<b>" },
        isNew: true,
      },
    ]);

    expect(text).toContain("UNREGISTERED ALERT MYSTERY");
    expect(text).toContain("a=<b>");
    expect(html).toContain("x&lt;1&gt;");
    expect(html).not.toContain("<b>");
  });
});

describe("isAuthorizedOpsRequest", () => {
  const secret = "s".repeat(40);

  it("accepts the exact bearer secret", () => {
    expect(isAuthorizedOpsRequest(`Bearer ${secret}`, secret, crypto.timingSafeEqual)).toBe(true);
  });

  it("refuses a wrong, missing or differently sized secret", () => {
    expect(isAuthorizedOpsRequest(`Bearer ${"t".repeat(40)}`, secret, crypto.timingSafeEqual)).toBe(false);
    expect(isAuthorizedOpsRequest(`Bearer ${secret}x`, secret, crypto.timingSafeEqual)).toBe(false);
    expect(isAuthorizedOpsRequest(undefined, secret, crypto.timingSafeEqual)).toBe(false);
    expect(isAuthorizedOpsRequest(secret, secret, crypto.timingSafeEqual)).toBe(false);
  });

  it("refuses everything when the secret is unset or too short", () => {
    expect(isAuthorizedOpsRequest("Bearer ", "", crypto.timingSafeEqual)).toBe(false);
    expect(isAuthorizedOpsRequest("Bearer short", "short", crypto.timingSafeEqual)).toBe(false);
  });
});
