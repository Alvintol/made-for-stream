// Every policy's version, apart from its text. Nearly every page needs the
// versions, to check what someone has accepted, but only legal pages need the
// text, so keeping these here stops the full policies downloading on every visit.
// Changing a policy's text means changing its version here.

export const termsVersion = "2026-10-31";

// What changed in this version, in plain words, for the card that asks
// someone who accepted an earlier version to accept this one
// (PolicyAcceptanceGate). Rewrite it every time termsVersion changes: a test
// fails if the two versions differ.
export const termsChanges = {
  version: "2026-10-31",
  // One change per line: never join separate changes into one sentence.
  items: [
    "During the beta, Made for Stream is only open to people who live in Canada or the United States.",
  ],
} as const;

export const privacyVersion = "2026-11-02";

// What changed in this version, in plain words. Shown on the card that asks
// someone who accepted an earlier version to accept this one
// (PolicyAcceptanceGate). Rewrite it every time privacyVersion changes: a
// test fails if the two versions differ.
export const privacyChanges = {
  version: "2026-11-02",
  // One change per line: never join separate changes into one sentence.
  items: [
    "If you are a creator and choose to show your tax number on invoices, your buyers see that number and your business or legal name.",
    "With each payment we now keep your province or state, not only your country, to work out the GST/HST in our fees.",
    "Earlier change (version 2026-10-29): when you send a commission request, the creator is told whether you have EU (including EEA) or UK consumer rights, so they know you can cancel within 14 days. They are not told your country or address.",
    "Earlier change (version 2026-10-29): we use the country in your account address, and the country of your internet connection at checkout, to check that Made for Stream is available where you are.",
    "Earlier change (version 2026-10-29): we report child sexual abuse material to the authorities as the law requires, and tell the police when someone's life or safety is at risk.",
    "Earlier change (version 2026-10-16): files a creator uploads with a final delivery are stored privately, and are kept while the commission is open and for 180 days after it closes.",
  ],
} as const;

export const creatorTermsVersion = "2026-10-29";

export const refundPolicyVersion = "2026-10-07";

export const paymentTermsVersion = "2026-11-02";

export const copyrightPolicyVersion = "2026-09-24";

export const cookiePolicyVersion = "2026-09-24";

export const communityGuidelinesVersion = "2026-10-29";
