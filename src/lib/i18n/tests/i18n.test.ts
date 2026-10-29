import { describe, expect, it } from "vitest";

import { translate } from "../i18n";
import { resolveLanguage } from "../languages";
import { en, type Message, type MessageKey } from "../messages/en";
import { fr } from "../messages/fr";

const placeholders = (message: Message) =>
  [...(typeof message === "string" ? message : `${message.one} ${message.other}`).matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort();

describe("translate", () => {
  it("fills in values and leaves unknown placeholders alone", () => {
    expect(translate("en", "footer.copyright", { year: 2026 })).toBe(
      "© 2026 Made for Stream • Marketplace for creator assets & services",
    );
    expect(translate("fr", "region.button", { label: "FR · CAD" })).toBe("Langue et devise (FR · CAD)");
    expect(translate("en", "region.button")).toBe("Language and currency ({label})");
  });

  it("picks the plural form by each language's rules", () => {
    expect(translate("en", "nav.unread", { count: 1 })).toBe("1 unread message");
    expect(translate("en", "nav.unread", { count: 0 })).toBe("0 unread messages");
    // French treats 0 and 1 as singular.
    expect(translate("fr", "nav.unread", { count: 0 })).toBe("0 message non lu");
    expect(translate("fr", "nav.unread", { count: 2 })).toBe("2 messages non lus");
    // A form a message does not have ("many" in French for millions) falls
    // back to "other".
    expect(translate("fr", "nav.unread", { count: 1_000_000 })).toBe("1000000 messages non lus");
  });
});

describe("the French text", () => {
  it("keeps every placeholder of the English, and leaves nothing empty", () => {
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(placeholders(fr[key]), key).toEqual(placeholders(en[key]));
      expect(typeof fr[key] === "string" ? fr[key] : fr[key].other, key).not.toBe("");
    }
  });
});

describe("resolveLanguage", () => {
  // Vitest runs as a development server, so French is offered here.
  it("uses the saved choice, then the browser, then English", () => {
    expect(resolveLanguage("fr", ["en-US"])).toBe("fr");
    expect(resolveLanguage(null, ["fr-CA", "en"])).toBe("fr");
    expect(resolveLanguage(null, ["de-DE", "en-GB"])).toBe("en");
    expect(resolveLanguage("xx", ["de"])).toBe("en");
  });
});
