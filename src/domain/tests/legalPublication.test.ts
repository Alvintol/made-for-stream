import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { copyrightPolicySections } from "../legal/copyrightPolicy";
import { currentPolicyVersions } from "../legal/policyAcceptance";
import { privacySections } from "../legal/privacyPolicy";
import { serviceProviderRegisterSections } from "../legal/serviceProviderRegister";

// Every policy is published, with no placeholder left in any of them.
const legalDir = resolve(process.cwd(), "src/domain/legal");
const legalFiles = readdirSync(legalDir).filter((file) => file.endsWith(".ts"));
const readLegal = (file: string) => readFileSync(resolve(legalDir, file), "utf8");

const PLACEHOLDER = /\[[A-Z_]{4,}\]/g;

describe("published legal documents", () => {
  it.each(legalFiles)("%s has no review-draft marker", (file) => {
    expect(readLegal(file)).not.toContain("REVIEW DRAFT");
  });

  it.each(legalFiles)("%s has no placeholder", (file) => {
    expect(readLegal(file).match(PLACEHOLDER) ?? []).toEqual([]);
  });

  it("cuts a non-draft version of every accepted policy", () => {
    Object.values(currentPolicyVersions).forEach((version) => {
      expect(version).not.toContain("draft");
    });
  });

  it("publishes the DMCA agent exactly as registered with the US Copyright Office", () => {
    expect(copyrightPolicySections[1].body).toEqual(
      expect.arrayContaining([
        "- Agent name or designated role: Made for Stream",
        "- Organisation: Made for Stream",
        "- Postal address: P.O. Box 34086, Calgary RPO Westbrook, Calgary, Alberta T3C 3W2, Canada",
        "- Telephone: +1 403-609-9839",
        "- Email: copyright@madeforstream.com",
      ]),
    );
  });

  it("uses only the platform's designated addresses", () => {
    const allowed = new Set([
      "support@madeforstream.com",
      "legal@madeforstream.com",
      "privacy@madeforstream.com",
      "copyright@madeforstream.com",
      "disputes@madeforstream.com",
      "safety@madeforstream.com",
      "appeals@madeforstream.com",
    ]);
    const used = legalFiles.flatMap(
      (file) => readLegal(file).match(/[a-z]+@madeforstream\.com/g) ?? [],
    );
    expect(used.length).toBeGreaterThan(0);
    used.forEach((address) => expect(allowed).toContain(address));
  });

  it("points the Privacy Policy at the published Service Provider Register", () => {
    const privacyText = JSON.stringify(privacySections);
    expect(privacyText).toContain("/policies/service-providers");
    expect(privacyText).toContain("Cloudflare");
    expect(privacyText).not.toContain("must include the verified Service Provider Register");
  });
});

describe("Service Provider Register", () => {
  const providerRows = serviceProviderRegisterSections
    .flatMap((section) => section.body)
    .filter((line) => line.startsWith("Provider: "));

  it("lists Supabase, Google Cloud, Stripe (with Stripe Tax), Cloudflare and Google Fonts", () => {
    const providers = providerRows.map((row) => row.split(";")[0]);
    expect(providers).toEqual([
      "Provider: Supabase, Inc.",
      "Provider: Google LLC (Google Cloud)",
      "Provider: Stripe",
      "Provider: Cloudflare, Inc.",
      "Provider: Google Fonts",
    ]);
    expect(providerRows[2]).toContain("Stripe Tax");
  });

  // LegalPolicySections renders "Label: value; ..." as a table only when every
  // segment has a label, so a stray semicolon would collapse a row into text.
  it("gives every provider a function, information and processing location", () => {
    providerRows.forEach((row) => {
      expect(row.split(";").map((segment) => segment.trim().split(":")[0])).toEqual([
        "Provider",
        "Function",
        "Information",
        "Processing location",
      ]);
    });
  });
});
