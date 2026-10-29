import { communityGuidelinesVersion } from "./communityGuidelines";
import { cookiePolicyVersion } from "./cookiePolicy";
import { copyrightPolicyVersion } from "./copyrightPolicy";
import { creatorTermsVersion } from "./creatorTerms";
import { paymentTermsVersion } from "./paymentTerms";
import { privacyChanges, privacyVersion } from "./privacyPolicy";
import { refundPolicyVersion } from "./refundPolicy";
import { termsChanges, termsVersion } from "./termsOfService";

// Mirrors the policy_type check constraint on public.policy_acceptances.
// "early_service_request" is the EU/UK express request to start work before
// the statutory cancellation period ends (Refund Policy section 1). It needs
// migration 114 to be applied before the database will accept it.
export type PolicyType =
  | "terms"
  | "creator_terms"
  | "privacy"
  | "refund"
  | "copyright"
  | "payment_terms"
  | "cookie"
  | "community"
  | "early_service_request";

export type PolicyAcceptanceInput = {
  policyType: PolicyType;
  policyVersion: string;
};

export type PolicyAcceptanceRecord = {
  policy_type: PolicyType;
  policy_version: string;
  related_listing_request_id: string | null;
  accepted_at: string;
};

// The early-service request is defined by Refund Policy section 1, so it
// carries that document's version.
export const currentPolicyVersions: Record<PolicyType, string> = {
  terms: termsVersion,
  creator_terms: creatorTermsVersion,
  privacy: privacyVersion,
  refund: refundPolicyVersion,
  copyright: copyrightPolicyVersion,
  payment_terms: paymentTermsVersion,
  cookie: cookiePolicyVersion,
  community: communityGuidelinesVersion,
  early_service_request: refundPolicyVersion,
};

// Wording for the express request to start work early. Shown at agreement
// acceptance, where the database requires it (20260923_138), and again at
// checkout if the Refund Policy has changed since. One copy so the two can
// never say different things.
export const earlyServiceRequestHeading =
  "Starting work before the cancellation period ends";

export const earlyServiceRequestExplanation =
  "If you are a consumer in the EU or UK, you may have 14 days to cancel this purchase. The creator can only begin work during that period if you ask them to.";

export const earlyServiceRequestLabel =
  "I expressly request that the creator begin work now, before any 14-day cancellation period I may have has ended. I understand that if I cancel during that period, I may have to pay for work already supplied, and that I will lose my right to cancel once the work has been fully completed.";

export const signupPolicyTypes: PolicyType[] = ["terms", "privacy"];

const policyTitles: Partial<Record<PolicyType, string>> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
};

// Plain-language summaries of what changed in a document's current version.
// A document with no entry here simply has no summary yet.
const policyChanges: Partial<
  Record<PolicyType, { version: string; items: readonly string[] }>
> = {
  terms: termsChanges,
  privacy: privacyChanges,
};

export type PolicyChangeSummary = {
  policyType: PolicyType;
  title: string;
  version: string;
  // Empty when the document changed but no summary was written for it.
  items: readonly string[];
};

// For the card that asks for acceptance again: the documents this person
// accepted before, in an older version, and what is different now. Someone
// accepting for the first time has nothing to compare, so gets no list. A
// summary written for another version is never shown.
export const getPolicyChangeSummaries = (
  missingPolicyTypes: PolicyType[],
  acceptances: Pick<PolicyAcceptanceRecord, "policy_type">[],
): PolicyChangeSummary[] =>
  missingPolicyTypes
    .filter((policyType) =>
      acceptances.some((acceptance) => acceptance.policy_type === policyType),
    )
    .map((policyType) => {
      const version = currentPolicyVersions[policyType];
      const changes = policyChanges[policyType];

      return {
        policyType,
        title: policyTitles[policyType] ?? policyType,
        version,
        items: changes?.version === version ? changes.items : [],
      };
    });

// The box ticked on the sign-in page, recorded once the person is signed in.
// It does not count for a document they accepted before in an older version
// and not yet in this one: they get the card above instead, so they see what
// changed before accepting it (decided 2026-10-28).
export const getSignInAcceptancesToRecord = (
  pending: PolicyAcceptanceInput[],
  acceptances: Pick<PolicyAcceptanceRecord, "policy_type" | "policy_version">[],
): PolicyAcceptanceInput[] =>
  pending.filter((policy) => {
    const earlier = acceptances.filter(
      (acceptance) => acceptance.policy_type === policy.policyType,
    );

    return (
      earlier.length === 0 ||
      earlier.some((acceptance) => acceptance.policy_version === policy.policyVersion)
    );
  });

export const creatorActivationPolicyTypes: PolicyType[] = ["creator_terms"];

export const checkoutPolicyTypes: PolicyType[] = [
  "refund",
  "payment_terms",
  "early_service_request",
];

// Pairs each policy with the version the user is being shown right now.
export const toCurrentPolicyAcceptances = (
  policyTypes: PolicyType[],
): PolicyAcceptanceInput[] =>
  policyTypes.map((policyType) => ({
    policyType,
    policyVersion: currentPolicyVersions[policyType],
  }));

// Policies still needing acceptance at their current version. An acceptance
// of an older version does not count once the document has changed.
export const getMissingPolicyTypes = (
  requiredPolicyTypes: PolicyType[],
  acceptances: Pick<PolicyAcceptanceRecord, "policy_type" | "policy_version">[],
): PolicyType[] =>
  requiredPolicyTypes.filter(
    (policyType) =>
      !acceptances.some(
        (acceptance) =>
          acceptance.policy_type === policyType &&
          acceptance.policy_version === currentPolicyVersions[policyType],
      ),
  );

// Most recent acceptance time across a set of records, for "accepted on" copy.
export const getLatestAcceptedAt = (
  acceptances: Pick<PolicyAcceptanceRecord, "accepted_at">[],
): string | null =>
  acceptances.reduce<string | null>(
    (latest, acceptance) =>
      !latest || acceptance.accepted_at > latest ? acceptance.accepted_at : latest,
    null,
  );

// The agreements a creator accepts before Stripe onboarding. These must match
// the URLs in Creator Terms section 2; a test checks they still appear there.
export const stripeConnectedAccountAgreementUrl =
  "https://stripe.com/connect-account/legal/full";

export const stripeServicesAgreementUrl = "https://stripe.com/legal/ssa";
