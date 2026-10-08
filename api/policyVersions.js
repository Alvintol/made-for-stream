// The policies checkout requires, and the version each must be accepted at,
// mirroring src/domain/legal/policyAcceptance.ts's `checkoutPolicyTypes` and
// `currentPolicyVersions` for exactly the subset gated at checkout.
//
// This file has no other imports and no side effects. That is deliberate: it
// keeps the values directly unit-testable, and keeps requiring it from
// server.js free of Stripe/Supabase/env wiring.
//
// KEEP IN SYNC BY HAND. This is a plain-JS Express API with no build step
// connecting it to the TypeScript web app, so there is no way to import the
// real constants -- a version bump on either side silently drifts unless both
// files are updated together. src/domain/tests/checkoutPolicyVersionsSync.test.ts
// fails loudly the moment they disagree; run it before merging a change to
// either side.
//
// Source of truth for each value:
//   - the required policy types: src/domain/legal/policyAcceptance.ts, checkoutPolicyTypes
//   - refund:                 src/domain/legal/refundPolicy.ts, refundPolicyVersion
//   - payment_terms:          src/domain/legal/paymentTerms.ts, paymentTermsVersion
//   - early_service_request:  same version as refund -- it is the express
//                              consent Refund Policy section 1 requires, and is
//                              versioned with the document that defines it
export const CHECKOUT_POLICY_VERSIONS = {
  refund: "2026-10-07",
  payment_terms: "2026-09-23",
  early_service_request: "2026-10-07",
};
