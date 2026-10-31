import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SUPPORTED_LANGUAGES } from "../../src/lib/i18n/languages";
import { EMAIL_LANGUAGES, getEmailLanguage, pickEmailLanguage } from "../emailLanguage.js";
import {
  EMAIL_TRANSLATIONS,
  formatArrivalDate,
  renderCreatorApplicationDecisionEmail,
  renderFinalNoticeEmail,
  renderFirstNoticeEmail,
  renderPaymentReceiptEmail,
  renderPayoutReleasedEmail,
} from "../emailTemplates.js";
import { NOTIFICATION_EMAILS, renderNotificationEmail } from "../notificationEmails.js";

const languages = Object.keys(EMAIL_TRANSLATIONS);
const url = "https://example.test/requests/1";

// A row with everything an email can use, so every branch is read.
const fullPayload = {
  title: "Sketches",
  reason: "Please pay",
  amount_cents: 4200,
  currency: "eur",
  waiting_days: 3,
  response_days: 10,
  expires_at: "2026-10-17T12:00:00Z",
  subject: "milestone 2 (coloured)",
  methods: "email, Discord, text message, another way (a, b)",
  sender: "Meow Ington",
};

describe("which language an email is in", () => {
  it("offers the same languages as the site, and marks the same ones ready", () => {
    expect(EMAIL_LANGUAGES).toEqual(SUPPORTED_LANGUAGES.map(({ code, ready }) => ({ code, ready })));
    expect(Object.keys(EMAIL_TRANSLATIONS).sort()).toEqual(
      EMAIL_LANGUAGES.map(({ code }) => code).filter((code) => code !== "en").sort(),
    );
  });

  it("uses the choice, then the browser, then English", () => {
    expect(pickEmailLanguage({ language: "es", browser_language: "fr" }, true)).toBe("es");
    expect(pickEmailLanguage({ language: null, browser_language: "fr" }, true)).toBe("fr");
    expect(pickEmailLanguage({ language: null, browser_language: null }, true)).toBe("en");
    expect(pickEmailLanguage(null, true)).toBe("en");
    expect(pickEmailLanguage({ language: "xx" }, true)).toBe("en");
  });

  it("stays in English until the language is ready", () => {
    expect(pickEmailLanguage({ language: "es" }, false)).toBe("en");
    expect(pickEmailLanguage({ browser_language: "fr" }, false)).toBe("en");
  });

  it("falls back to English when the language cannot be read", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabaseAdmin = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "nope" } }) }),
        }),
      }),
    };

    await expect(getEmailLanguage(supabaseAdmin, "user-1")).resolves.toBe("en");
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("EMAIL-005"));
    consoleError.mockRestore();
  });

  it("is deployed: the API image only copies top-level files", () => {
    expect(readFileSync("api/Dockerfile", "utf8")).toContain("COPY --chown=node:node *.js ./");
  });
});

describe.each(languages)("the %s emails", (language) => {
  const pack = EMAIL_TRANSLATIONS[language];

  it("has every kind of notification, and no others", () => {
    expect(Object.keys(pack.notifications).sort()).toEqual(Object.keys(NOTIFICATION_EMAILS).sort());
  });

  it.each(Object.keys(NOTIFICATION_EMAILS))("renders %s, with and without details", (kind) => {
    for (const payload of [{}, fullPayload]) {
      for (const names of [undefined, { buyer: "ImAllBeans", creator: "meowington", other: "meowington" }]) {
        const email = renderNotificationEmail({
          kind,
          requestTitle: "Emote pack",
          payload,
          requestUrl: url,
          names,
          language,
        });

        expect(email.html).toContain(`<html lang="${language}">`);
        expect(email.html).toContain(url);
        expect(email.subject).toBeTruthy();
        expect(`${email.subject} ${email.text}`).not.toMatch(/undefined|null|\[object|\bthe buyer\b|\bthe creator\b/);
        expect(email.html).not.toMatch(/undefined|\[object/);
      }
    }
  });

  it("escapes what people typed", () => {
    const email = renderNotificationEmail({
      kind: "payment_required",
      requestTitle: "<b>Logo</b>",
      payload: {},
      requestUrl: url,
      language,
    });

    expect(email.html).toContain("&lt;b&gt;Logo&lt;/b&gt;");
    expect(email.html).not.toContain("<b>Logo</b>");
  });

  it("names a person by their handle, and shows the note they wrote", () => {
    const email = renderNotificationEmail({
      kind: "request_declined",
      requestTitle: "Emote pack",
      payload: { reason: "Fully booked" },
      requestUrl: url,
      names: { buyer: "ImAllBeans", creator: "meowington", other: "meowington" },
      language,
    });

    expect(email.text).toContain("meowington");
    expect(email.text).toContain("Fully booked");
  });

  it("translates the other templates", () => {
    const expiresAt = "2026-10-17T12:00:00Z";
    const emails = [
      renderPaymentReceiptEmail({ amountCents: 4200, currency: "eur", requestUrl: url, language }),
      renderFirstNoticeEmail({ requestedAction: "Reply", expiresAt, requestUrl: url, language }),
      renderFinalNoticeEmail({ requestTitle: "Logo", requestedAction: "Reply", expiresAt, requestUrl: url, language }),
      renderPayoutReleasedEmail({ amountCents: 4200, currency: "eur", arrivalDate: "x", requestUrl: url, language }),
      ...["approved", "needs_changes", "rejected"].map((status) =>
        renderCreatorApplicationDecisionEmail({ status, note: "A note", language }),
      ),
    ];

    for (const email of emails) {
      expect(email.html).toContain(`<html lang="${language}">`);
      expect(email.html).toContain(pack.questions);
      expect(`${email.subject} ${email.text}`).not.toMatch(/undefined|null|your project|\bReceipt\b|\bPayout\b/);
    }

    expect(emails[1].text).toContain(pack.yourProject);
    expect(emails[1].text).toContain("2026");
    expect(emails[1].text).toContain("UTC");
    expect(emails[6].text).toContain("A note");
  });

  it("still refuses an application status that has no email", () => {
    expect(() => renderCreatorApplicationDecisionEmail({ status: "suspended", language })).toThrow(
      /No creator application email/,
    );
  });

  it("writes the date of a payout in the language", () => {
    expect(formatArrivalDate(1792713600, language)).toMatch(/2026/);
  });
});

describe("French", () => {
  const render = (kind, payload) =>
    renderNotificationEmail({ kind, requestTitle: "Emote pack", payload, requestUrl: url, language: "fr" });

  it("reads the saved English parts in French", () => {
    const { text } = render("off_site_receipt_requested", fullPayload);

    expect(text).toContain("l’étape 2 (coloured)");
    expect(text).toContain("par courriel, Discord, texto, un autre moyen (a, b)");
  });

  it("writes the deadline in French", () => {
    expect(render("cancellation_warning", fullPayload).subject).toContain("17 octobre 2026");
  });

  it("translates the reason the database writes, and leaves a typed one", () => {
    expect(render("request_cancelled", { reason: "No reply to a cancellation warning within 7 days." }).text).toContain(
      "Aucune réponse à un avertissement d’annulation dans un délai de 7 jours.",
    );
    expect(render("request_cancelled", { reason: "Please pay" }).text).toContain("Please pay");
  });
});

describe("Spanish", () => {
  const render = (kind, payload) =>
    renderNotificationEmail({ kind, requestTitle: "Emote pack", payload, requestUrl: url, language: "es" });

  it("uses the same words as the site", () => {
    const { text } = render("off_site_receipt_requested", fullPayload);

    expect(text).toContain("el hito 2 (coloured)");
    expect(text).toContain("por correo electrónico, Discord, mensaje de texto, otra forma (a, b)");
    expect(text).toContain("encargo");
    expect(render("payment_received", fullPayload).text).toContain("antes de tarifas");
  });

  it("never says comisión", () => {
    const all = Object.keys(NOTIFICATION_EMAILS)
      .map((kind) => {
        const email = render(kind, fullPayload);

        return `${email.subject} ${email.text}`;
      })
      .join(" ");

    expect(all).not.toMatch(/comisi[oó]n/i);
  });

  it("writes the deadline in Spanish", () => {
    expect(render("cancellation_warning", fullPayload).subject).toContain("17 de octubre de 2026");
  });
});

describe("English", () => {
  it("is unchanged by a missing language", () => {
    const email = renderPaymentReceiptEmail({ requestTitle: "Logo", amountCents: 4200, currency: "usd", requestUrl: url });

    expect(email.subject).toBe('Receipt: $42.00 for "Logo"');
    expect(email.html).toContain('<html lang="en">');
    expect(email.html).toContain("Questions?");
  });

  it("still says your project when a commission has no title", () => {
    expect(renderFirstNoticeEmail({ requestedAction: "Reply", expiresAt: "2026-10-17T12:00:00Z", requestUrl: url }).subject).toBe(
      'Action needed on "your project"',
    );
  });
});
