import { getPolicyChangeSummaries } from "../legal/policyAcceptance";
import { privacyChanges } from "../legal/privacyPolicy";
import { termsChanges } from "../legal/termsOfService";
import { afterEach, describe, expect, it } from "vitest";

import {
  checkoutPolicyTypes,
  currentPolicyVersions,
  getLatestAcceptedAt,
  getMissingPolicyTypes,
  getSignInAcceptancesToRecord,
  signupPolicyTypes,
  stripeConnectedAccountAgreementUrl,
  stripeServicesAgreementUrl,
  toCurrentPolicyAcceptances,
} from "../legal/policyAcceptance";
import { creatorTermsSections } from "../legal/creatorTerms";
import { privacyVersion } from "../legal/privacyPolicy";
import { refundPolicyVersion } from "../legal/refundPolicy";
import { termsVersion } from "../legal/termsOfService";
import {
  clearPendingPolicyAcceptance,
  readPendingPolicyAcceptance,
  savePendingPolicyAcceptance,
} from "../../lib/legal/pendingPolicyAcceptance";

describe("policy acceptance versions", () => {
  it("uses the version constants exported by each policy document", () => {
    expect(toCurrentPolicyAcceptances(signupPolicyTypes)).toEqual([
      { policyType: "terms", policyVersion: termsVersion },
      { policyType: "privacy", policyVersion: privacyVersion },
    ]);
  });

  it("ties the early-service commission to the refund policy version", () => {
    expect(checkoutPolicyTypes).toContain("early_service_request");
    expect(currentPolicyVersions.early_service_request).toBe(refundPolicyVersion);
  });
});

describe("getMissingPolicyTypes", () => {
  it("reports every policy when nothing has been accepted", () => {
    expect(getMissingPolicyTypes(signupPolicyTypes, [])).toEqual(["terms", "privacy"]);
  });

  it("treats an acceptance of an older version as missing", () => {
    expect(
      getMissingPolicyTypes(signupPolicyTypes, [
        { policy_type: "terms", policy_version: "2020-01-01-old" },
        { policy_type: "privacy", policy_version: privacyVersion },
      ]),
    ).toEqual(["terms"]);
  });

  it("is satisfied when every current version is accepted", () => {
    expect(
      getMissingPolicyTypes(signupPolicyTypes, [
        { policy_type: "terms", policy_version: termsVersion },
        { policy_type: "privacy", policy_version: privacyVersion },
      ]),
    ).toEqual([]);
  });
});

describe("getSignInAcceptancesToRecord", () => {
  const ticked = toCurrentPolicyAcceptances(signupPolicyTypes);

  it("records the sign-in box for a new account", () => {
    expect(getSignInAcceptancesToRecord(ticked, [])).toEqual(ticked);
  });

  it("leaves out a document accepted before in an older version, so its changes are shown", () => {
    expect(
      getSignInAcceptancesToRecord(ticked, [
        { policy_type: "terms", policy_version: termsVersion },
        { policy_type: "privacy", policy_version: "2020-01-01-old" },
      ]),
    ).toEqual([{ policyType: "terms", policyVersion: termsVersion }]);
  });

  it("still records a document already accepted in this version", () => {
    expect(
      getSignInAcceptancesToRecord(ticked, [
        { policy_type: "privacy", policy_version: "2020-01-01-old" },
        { policy_type: "privacy", policy_version: privacyVersion },
      ]),
    ).toEqual(ticked);
  });
});

describe("getLatestAcceptedAt", () => {
  it("returns the most recent timestamp, or null", () => {
    expect(getLatestAcceptedAt([])).toBeNull();
    expect(
      getLatestAcceptedAt([
        { accepted_at: "2026-09-18T10:00:00Z" },
        { accepted_at: "2026-09-19T10:00:00Z" },
      ]),
    ).toBe("2026-09-19T10:00:00Z");
  });
});

describe("pending policy acceptance storage", () => {
  afterEach(() => {
    clearPendingPolicyAcceptance();
  });

  it("round-trips the policies and versions the user saw", () => {
    const policies = toCurrentPolicyAcceptances(signupPolicyTypes);

    savePendingPolicyAcceptance(policies, 1_000);

    expect(readPendingPolicyAcceptance(2_000)).toEqual({ policies, savedAt: 1_000 });
  });

  it("drops intent older than a day", () => {
    savePendingPolicyAcceptance(toCurrentPolicyAcceptances(signupPolicyTypes), 0);

    expect(readPendingPolicyAcceptance(24 * 60 * 60 * 1000 + 1)).toBeNull();
    expect(window.localStorage.getItem("creatorhub.pendingPolicyAcceptance")).toBeNull();
  });

  it("ignores malformed stored values", () => {
    window.localStorage.setItem(
      "creatorhub.pendingPolicyAcceptance",
      JSON.stringify({ policies: [{ policyType: 1 }], savedAt: Date.now() }),
    );

    expect(readPendingPolicyAcceptance()).toBeNull();
  });
});

describe("Stripe agreement links", () => {
  it("match the URLs published in Creator Terms section 2", () => {
    const stripeSection = creatorTermsSections.find((section) =>
      section.title.startsWith("2."),
    );
    const text = stripeSection?.body.join(" ") ?? "";

    expect(text).toContain(stripeConnectedAccountAgreementUrl);
    expect(text).toContain(stripeServicesAgreementUrl);
  });

  describe("what changed, for the re-acceptance card", () => {
    it("has a summary written for the Privacy Policy's current version", () => {
      // Fails when privacyVersion is bumped and the summary is not rewritten.
      expect(privacyChanges.version).toBe(privacyVersion);
      expect(privacyChanges.items.length).toBeGreaterThan(0);
    });

    it("has a summary written for the Terms of Service's current version", () => {
      // Fails when termsVersion is bumped and the summary is not rewritten.
      expect(termsChanges.version).toBe(termsVersion);
      expect(termsChanges.items.length).toBeGreaterThan(0);
    });

    it("lists the changes for a document the person accepted before", () => {
      const summaries = getPolicyChangeSummaries(
        ["privacy"],
        [{ policy_type: "privacy" }],
      );

      expect(summaries).toEqual([
        {
          policyType: "privacy",
          title: "Privacy Policy",
          version: privacyVersion,
          items: privacyChanges.items,
        },
      ]);
    });

    it("gives no list to someone accepting for the first time", () => {
      expect(getPolicyChangeSummaries(["terms", "privacy"], [])).toEqual([]);
    });

    it("says a document changed even when no summary was written for it", () => {
      const [summary] = getPolicyChangeSummaries(
        ["cookie"],
        [{ policy_type: "cookie" }],
      );

      expect(summary.policyType).toBe("cookie");
      expect(summary.items).toEqual([]);
    });
  });
});
