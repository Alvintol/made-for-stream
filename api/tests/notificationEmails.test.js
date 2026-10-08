import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_EMAILS,
  getListingRequestUrl,
  renderNotificationEmail,
} from "../notificationEmails.js";

// Tests run from the repository root.
const migration = readFileSync(
  "supabase/migrations/20261007_148_add_listing_request_notifications.sql",
  "utf8",
);

// Every kind the database can queue: the third argument of each enqueue
// call, and the kinds named in the reminders query.
const queuedKinds = [
  ...new Set(
    [
      ...migration.matchAll(/enqueue_listing_request_notification\(\s*[^,]+,[^,]+,\s*'([a-z_]+)'/g),
      ...migration.matchAll(/'([a-z_]+_(?:reminder|overdue))'/g),
    ].map((match) => match[1]),
  ),
];

describe("commission notification emails", () => {
  it("has a template for every kind the database queues, and no others", () => {
    expect(queuedKinds.length).toBeGreaterThan(25);
    expect(queuedKinds.sort()).toEqual(Object.keys(NOTIFICATION_EMAILS).sort());
  });

  it("renders every kind with a subject, a link and no leftover placeholders", () => {
    for (const kind of Object.keys(NOTIFICATION_EMAILS)) {
      const email = renderNotificationEmail({
        kind,
        requestTitle: "Emote pack",
        payload: {},
        requestUrl: "https://example.test/requests/1",
      });

      expect(email.subject, kind).toContain("Emote pack");
      expect(email.html, kind).toContain("https://example.test/requests/1");
      expect(email.text, kind).not.toMatch(/undefined|null|\[object/);
      expect(email.html, kind).not.toMatch(/undefined|\[object/);
    }
  });

  it("shows amounts with their currency and escapes what people typed", () => {
    const email = renderNotificationEmail({
      kind: "payment_required",
      requestTitle: "<b>Logo</b>",
      payload: { title: "Deposit", amount_cents: 4200, currency: "eur" },
      requestUrl: "https://example.test/requests/1",
    });

    expect(email.text).toContain("€42.00 EUR");
    expect(email.html).toContain("&lt;b&gt;Logo&lt;/b&gt;");
    expect(email.html).not.toContain("<b>Logo</b>");
  });

  it("returns null for a kind it does not know", () => {
    expect(renderNotificationEmail({ kind: "nope", payload: {} })).toBeNull();
  });

  it("links buyers and creators to pages that exist", () => {
    expect(getListingRequestUrl("https://x.test", "abc", "buyer")).toBe(
      "https://x.test/requests/abc",
    );
    expect(getListingRequestUrl("https://x.test", "abc", "creator")).toBe(
      "https://x.test/creator/requests/abc",
    );
  });
});
