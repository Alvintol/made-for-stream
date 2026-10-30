import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  inboxPreviewText,
  nameSystemMessagePeople,
  offSiteSubjectText,
  systemLineText,
  type SystemLine,
} from "../conversations/conversations";
import { english, hasMessage, translate, type Translate } from "../../lib/i18n/i18n";

const names = { buyerName: "@ImAllBeans", creatorName: "@meowington" };
const french: Translate = (key, values) => translate("fr", key, values);

// The list in the migration, run here so the site and the database can be
// compared without a database.
const sql = readFileSync("supabase/migrations/20261030_174_add_system_line_codes.sql", "utf8");
const rows = [...sql.matchAll(/^\s+\('(chat\.line\.\w+)', '(.+)', '\{(.*)\}'\),?\r?$/gm)].map(
  ([, key, pattern, parts]) => ({
    key,
    pattern: new RegExp(pattern, "s"),
    parts: parts ? parts.split(",") : [],
  }),
);

const lineFor = (body: string): SystemLine | null => {
  for (const row of rows) {
    const found = body.match(row.pattern);

    if (found) {
      return {
        key: row.key,
        values: Object.fromEntries(row.parts.map((part, index) => [part, found[index + 1]])),
      };
    }
  }

  return null;
};

// One saved line for each wording, as the database functions write them.
const saved = [
  "Request accepted by the creator.",
  "Request cancelled by the buyer.",
  "Request archived by the creator.",
  "Request archived.",
  "Request moved back to under review.",
  "This request has been cancelled. The conversation is now read-only.",
  "Conversation ended because the request was declined.",
  "Conversation ended.",
  "This request was cancelled before any payment was collected: test complete",
  "Project agreement sent for buyer review.",
  "Project agreement accepted by the buyer.",
  "Project agreement declined by the buyer.",
  "The creator sent a project agreement for buyer review.",
  "The creator sent a project change order for buyer review: discount",
  "The creator withdrew the project change order before it was answered: discount",
  "The buyer accepted the project change order: discount",
  "The buyer declined the project change order: discount",
  "The creator submitted the final project delivery for buyer review: delivery title",
  "The buyer approved the final project delivery: delivery title",
  "The buyer requested revisions to the final project delivery: delivery title",
  "The buyer approved the final delivery. The project is complete and this conversation is now read-only.",
  "The creator submitted milestone 2 for buyer review: rigged model",
  "The buyer requested revisions for milestone 2: rigged model",
  "The buyer approved milestone 1: sketches. The milestone payment is now required.",
  "The creator posted a project progress update: first pass",
  "Stripe confirmed the required starting payment. Work may now begin.",
  "Stripe confirmed payment for milestone 2: coloured. The creator can continue with the next milestone.",
  "Stripe confirmed the required change-order payment: Change order: discount.",
  "Stripe confirmed the required final-balance payment: Final balance.",
  "An administrator manually confirmed the required starting payment, bypassing Stripe verification. Work may now begin.",
  "An administrator manually confirmed payment for milestone 1: sketches, bypassing Stripe verification. The creator can continue with the next milestone.",
  "An administrator manually confirmed the required change-order payment: Change order: discount, bypassing Stripe verification.",
  "An administrator manually confirmed the required final-balance payment: Final balance, bypassing Stripe verification.",
  "Creator allowed buyer image uploads.",
  "Creator disabled buyer image uploads.",
  "Buyer requested permission to send images.",
  "An early review was requested for this project. Made for Stream will review and decide.",
  "A cancellation was proposed: too slow. An itemised earned-value statement is attached; the buyer can now accept or dispute it.",
  "A cancellation was proposed: too slow. The creator has until 2026-11-06 17:32 UTC to provide an itemised earned-value statement.",
  "The creator submitted an itemised earned-value statement. The buyer can now accept or dispute it.",
  "The buyer accepted the cancellation statement. Unpaid items are cancelled and any unearned prepaid amounts are flagged for refund.",
  "The buyer disputed the cancellation statement: wrong amounts. Made for Stream will review and decide.",
  "A cancellation warning was sent: please reply. Unless the other person replies here or takes the next step in the project by 2026-11-06 17:32 UTC, this commission will be cancelled automatically.",
  "The cancellation warning was answered, so its timer has stopped. The commission continues.",
  "The cancellation warning was withdrawn. The commission continues.",
  "This commission was cancelled automatically: No reply to a cancellation warning within 7 days.",
  "This commission was cancelled automatically: No reply to a cancellation warning within 7 days. Amounts paid for work not reached are being refunded to the buyer.",
  "This commission was cancelled automatically: No reply to a cancellation warning within 7 days. Amounts already paid stay with the creator.",
  "A first notice was sent: please reply. A reply is needed by 2026-11-06 17:32 UTC or a final notice may follow.",
  "A final notice was sent, granting 7 further days (until 2026-11-13 17:32 UTC). Administrative closure may be requested after that if there is still no substantive reply.",
  "This request was administratively closed (buyer_unresponsive): gone. This is not a finding that the work delivered so far was satisfactory.",
  "This request was administratively closed (creator_unresponsive): gone. This is not a finding that the work delivered so far was satisfactory. Unearned prepaid amounts have been flagged for refund.",
  "This request was administratively closed (buyer_unresponsive): gone. This is not a finding that the work delivered so far was satisfactory. Unearned prepaid amounts remain available to refund on request.",
  "The creator reports that the work for the final delivery (test delivery) was also sent outside Made for Stream, by: Discord. Made for Stream has no copy of what was sent and cannot confirm that it arrived.",
  "The buyer confirmed receiving the work for the final delivery (test delivery) that was sent outside Made for Stream.",
  "The buyer says the work for milestone 2 (coloured), sent outside Made for Stream, has not arrived.",
  "The buyer approved milestone 2 (coloured), which confirms that the work sent outside Made for Stream arrived.",
  "Made for Stream recorded the work for this commission as received. Note: confirmed by email",
];

describe("the list of automatic lines in the migration", () => {
  it("reads every row of the list", () => {
    expect(rows.length).toBe((sql.match(/\('chat\.line\./g) ?? []).length);
    expect(rows.length).toBeGreaterThan(50);
  });

  it("has wording on the site for every key", () => {
    expect(rows.filter((row) => !hasMessage(row.key))).toEqual([]);
  });

  it("is covered by a saved line for each wording", () => {
    const seen = new Set(saved.map((body) => lineFor(body)?.key));

    expect(rows.map((row) => row.key).filter((key) => !seen.has(key))).toEqual([]);
  });
});

describe("English stays as it was", () => {
  it.each(saved)("%s", (body) => {
    const before = nameSystemMessagePeople(body, names)
      // The one intended change: the closure reason in plain words.
      .replace("creator_unresponsive", "creator not responding")
      .replace("buyer_unresponsive", "buyer not responding");

    expect(systemLineText(lineFor(body), body, names)).toBe(before);
  });
});

describe("French", () => {
  const show = (body: string) => systemLineText(lineFor(body), body, names, french);

  it("translates a line and leaves what someone typed as written", () => {
    expect(show("The buyer approved milestone 1: sketches. The milestone payment is now required.")).toBe(
      "@ImAllBeans a approuvé l’étape 1 : sketches. Le paiement de l’étape est maintenant requis.",
    );
  });

  it("does not read braces someone typed as a placeholder", () => {
    expect(show("The buyer accepted the project change order: {creator}")).toBe(
      "@ImAllBeans a accepté la modification du projet : {creator}",
    );
  });

  it("keeps a title that contains the line's own wording", () => {
    expect(show("The buyer accepted the project change order: The creator. Then more")).toBe(
      "@ImAllBeans a accepté la modification du projet : The creator. Then more",
    );
  });

  it("translates where the off-site work was and how it was sent", () => {
    expect(
      show(
        "The creator reports that the work for milestone 2 (coloured) was also sent outside Made for Stream, by: email, Discord, text message, another way (a, b). Made for Stream has no copy of what was sent and cannot confirm that it arrived.",
      ),
    ).toBe(
      "@meowington indique que le travail pour l’étape 2 (coloured) a aussi été envoyé hors de Made for Stream, par : courriel, Discord, texto, un autre moyen (a, b). Made for Stream n’a aucune copie de ce qui a été envoyé et ne peut pas confirmer que c’est arrivé.",
    );
  });

  it("shows a subject it does not recognise as saved", () => {
    expect(offSiteSubjectText("something else", french)).toBe("something else");
  });

  it("gives the closure reason in words", () => {
    expect(
      show(
        "This request was administratively closed (creator_unresponsive): parti. This is not a finding that the work delivered so far was satisfactory.",
      ),
    ).toContain("(créateur sans réponse) : parti.");
  });
});

describe("a line the site cannot show from its code", () => {
  it("reads as saved when there is no code", () => {
    expect(systemLineText(null, "The buyer did something new.", names, french)).toBe(
      "@ImAllBeans did something new.",
    );
  });

  it("reads as saved when this version of the site does not know the code", () => {
    expect(
      systemLineText({ key: "chat.line.fromTheFuture", values: {} }, "The buyer did something new.", names, french),
    ).toBe("@ImAllBeans did something new.");
  });
});

describe("the inbox preview", () => {
  const body = "The creator sent a project change order for buyer review: discount";

  it("shows a message someone wrote as saved", () => {
    expect(inboxPreviewText(null, "hello", english)).toBe("hello");
    expect(inboxPreviewText(undefined, null, english)).toBeNull();
  });

  it("starts with a capital when a person starts the line", () => {
    expect(inboxPreviewText(lineFor(body), body, english)).toBe(
      "The creator sent a project change order for the buyer to review: discount",
    );
    expect(inboxPreviewText(lineFor(body), body, french)).toBe(
      "Le créateur a envoyé une modification du projet pour examen par l’acheteur : discount",
    );
  });
});
