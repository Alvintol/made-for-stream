import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_EMAILS,
  getListingRequestUrl,
  getNotificationNames,
  getNotificationUrl,
  renderNotificationEmail,
} from "../notificationEmails.js";

// Tests run from the repository root.
const migration = [
  "supabase/migrations/20261007_148_add_listing_request_notifications.sql",
  "supabase/migrations/20261007_149_add_presence_message_emails_and_cancellation_warnings.sql",
]
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

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

      // Chat emails are about a person, not a commission title.
      if (!["conversation_started", "message_received"].includes(kind)) {
        expect(email.subject, kind).toContain("Emote pack");
      }
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

  it("names people by their handle, with no @, when they have one", () => {
    const names = { buyer: "ImAllBeans", creator: "meowington", other: "meowington" };
    const render = (kind, payload = {}) =>
      renderNotificationEmail({
        kind,
        requestTitle: "Emote pack",
        payload,
        requestUrl: "https://example.test/requests/1",
        names,
      });

    expect(render("request_received").text).toContain('ImAllBeans sent you a commission request, "Emote pack".');
    expect(render("request_accepted").html).toContain("meowington accepted your commission request");
    expect(render("request_declined", { reason: "Fully booked" }).text).toContain("meowington's reason");
    expect(render("payment_received").text).toContain("ImAllBeans paid");
    expect(render("cancellation_warning").text).toContain('meowington on "Emote pack" has not heard from you');
    // The database's own name for a chat sender gives way to the handle.
    expect(render("message_received", { sender: "Meow Ington" }).subject).toBe("New message from meowington");

    for (const kind of Object.keys(NOTIFICATION_EMAILS)) {
      expect(render(kind).text, kind).not.toContain("@");
    }
  });

  it("falls back to the role when a handle is missing or could not be read", () => {
    const render = (kind, names, payload = {}) =>
      renderNotificationEmail({
        kind,
        requestTitle: "Emote pack",
        payload,
        requestUrl: "https://example.test/requests/1",
        names,
      });

    expect(render("request_received", undefined).text).toContain("A buyer sent you a commission request");
    expect(render("request_accepted", { buyer: "", creator: "" }).html).toContain(
      "The creator accepted your commission request",
    );
    expect(render("payment_reminder", {}).text).toContain("so the creator knows");
    expect(render("message_received", {}, { sender: "Meow Ington" }).subject).toBe(
      "New message from Meow Ington",
    );
    // Rules about buyers and creators in general keep the plain words.
    expect(render("cancellation_warning", { buyer: "a", creator: "b", other: "b" }).text).toContain(
      "If the buyer is the one who does not respond",
    );
  });

  it("works out who is who from the commission and the recipient", () => {
    const handleByUserId = { "buyer-1": "ImAllBeans", "creator-1": " meowington " };
    const ids = { buyerUserId: "buyer-1", creatorUserId: "creator-1", handleByUserId };

    expect(getNotificationNames({ ...ids, recipientUserId: "buyer-1" })).toEqual({
      buyer: "ImAllBeans",
      creator: "meowington",
      other: "meowington",
    });
    expect(getNotificationNames({ ...ids, recipientUserId: "creator-1" }).other).toBe("ImAllBeans");
    // An account with no handle is simply left unnamed.
    expect(
      getNotificationNames({ ...ids, recipientUserId: "buyer-1", handleByUserId: { "buyer-1": null } }),
    ).toEqual({ buyer: "", creator: "", other: "" });
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

  it("opens the conversation for chat emails and the commission for the rest", () => {
    const row = {
      listing_request_id: "req",
      conversation_id: "conv",
      recipient_user_id: "buyer",
    };

    expect(getNotificationUrl("https://x.test", { ...row, kind: "message_received" }, "buyer")).toBe(
      "https://x.test/messages/conv",
    );
    expect(getNotificationUrl("https://x.test", { ...row, kind: "payment_required" }, "buyer")).toBe(
      "https://x.test/requests/req",
    );
    expect(
      getNotificationUrl(
        "https://x.test",
        { ...row, listing_request_id: null, kind: "conversation_started" },
        null,
      ),
    ).toBe("https://x.test/messages/conv");
  });

  it("states the deadline in a cancellation warning", () => {
    const email = renderNotificationEmail({
      kind: "cancellation_warning",
      requestTitle: "Emote pack",
      payload: { reason: "Please pay", response_days: 10, expires_at: "2026-10-17T12:00:00Z" },
      requestUrl: "https://example.test/requests/1",
    });

    expect(email.subject).toContain("October 17, 2026");
    expect(email.text).toContain("10-day cancellation timer");
    expect(email.text).toContain("Please pay");
  });
});
