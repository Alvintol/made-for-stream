import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkoutPolicyTypes,
  currentPolicyVersions,
} from "../legal/policyAcceptance";
// api/ is a separate, plain-JS Express package with no build step connecting
// it to this TypeScript app, so it keeps its own copy of the checkout policy
// versions (api/policyVersions.js). This test is the only thing keeping the
// two from silently drifting apart -- if it fails, update
// api/policyVersions.js to match the values below, not the other way around:
// this file's exports are the source of truth.
import { CHECKOUT_POLICY_VERSIONS } from "../../../api/policyVersions.js";

describe("api/policyVersions.js stays in sync with policyAcceptance.ts", () => {
  it("requires exactly the same policy types as the client's checkout gate", () => {
    expect(Object.keys(CHECKOUT_POLICY_VERSIONS).sort()).toEqual(
      [...checkoutPolicyTypes].sort(),
    );
  });

  it("requires the same version for every checkout policy", () => {
    // checkoutPolicyTypes is typed as the full PolicyType union (nine values);
    // CHECKOUT_POLICY_VERSIONS only ever has the three checkout keys. The cast
    // below does not weaken the check -- a genuine mismatch still fails the
    // assertion, since an absent key compares as undefined against the real
    // required version.
    for (const policyType of checkoutPolicyTypes) {
      const versionsByType = CHECKOUT_POLICY_VERSIONS as Record<
        string,
        string | undefined
      >;

      expect(versionsByType[policyType]).toBe(currentPolicyVersions[policyType]);
    }
  });

  it("sends an early-start version the agreement function accepts", () => {
    // respond_listing_request_agreement refuses a version that doesn't match
    // its pattern, so a new version shape blocks every agreement acceptance.
    const migrations = readdirSync("supabase/migrations").sort();
    const latest = migrations
      .map((name) => readFileSync(`supabase/migrations/${name}`, "utf8"))
      .filter((sql) => sql.includes("create or replace function public.respond_listing_request_agreement("))
      .at(-1);
    const pattern = /p_early_service_request_version\s+!~ '([^']+)'/.exec(latest ?? "")?.[1];

    expect(pattern).toBeDefined();
    expect(CHECKOUT_POLICY_VERSIONS.early_service_request).toMatch(new RegExp(pattern!));
  });
});
