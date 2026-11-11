// The Service Provider Register the Privacy Policy refers to (sections 4, 9
// and 11; launch-scope.md section 7.2). Not an accepted policy, so it has no
// entry in policy_acceptances: it is a published list that changes whenever a
// provider does, and the Privacy Policy commits to adding a provider here
// before it processes personal information.
//
// Each provider row is a "Label: value; Label: value" line, which
// LegalPolicySections renders as a table -- so a value must never contain a
// semicolon. Locations are the ones verified for this deployment: Supabase
// project region us-east-2 (the prod project), Cloud Run region us-central1
// (docs/launch-implementation-checklist.md, Sprint 3).
export const serviceProviderRegisterVersion = "2026-11-11";

export const serviceProviderRegisterSections = [
  {
    "title": "1. About this register",
    "body": [
      "Made for Stream uses the service providers below to run the service. Each one processes personal information to provide its function to Made for Stream. Where a provider also uses information for its own purposes, the entry says so. A provider is added here before it processes personal information, and an entry is updated when its function or location changes.",
      "The Privacy Policy explains what information Made for Stream handles and why. Questions about this register go to privacy@madeforstream.com."
    ]
  },
  {
    "title": "2. Service providers",
    "body": [
      "Provider: Supabase, Inc.; Function: Database, user accounts and sign-in; Information: Account, profile, listing, project, message, agreement and payment records held by Made for Stream; Processing location: United States (Ohio)",
      "Provider: Google LLC (Google Cloud); Function: Runs Made for Stream's application server and stores its configuration secrets; Information: The requests that pass through the server, including the account, payment and email details each request needs, and server logs; Processing location: United States (Iowa)",
      "Provider: Stripe; Function: Payment processing, creator connected accounts and payouts, creator identity verification, and tax calculation (Stripe Tax) where tax is calculated; Information: Payment, transaction, device and fraud-prevention data, creator onboarding and verification data, and for tax calculation the payment amounts and the buyer's country; Processing location: United States and other countries where Stripe operates. Stripe also uses some information for its own legal, regulatory and risk purposes, as its Privacy Policy explains (https://stripe.com/privacy)",
      "Provider: Cloudflare, Inc.; Function: Hosting and delivering the website, checking that a person rather than an automated program is signing in by email (Turnstile), domain name service for madeforstream.com, receiving mail sent to Made for Stream's madeforstream.com addresses, and sending service emails such as receipts and project notices; Information: Website requests, including IP address and browser details, the browser signals the sign-in check uses, email addresses, the content of service emails and received mail, and technical request data; Processing location: Cloudflare's global network, operated from the United States",
      "Provider: Google Fonts; Function: Not used. The site's fonts (Inter and Plus Jakarta Sans) are served from Made for Stream's own site; Information: None. Loading a page sends no request to Google Fonts; Processing location: Not applicable"
    ]
  },
  {
    "title": "3. Services you choose to connect",
    "body": [
      "If you sign in with Google or Twitch, or link a Twitch or YouTube account, that provider handles your information under its own privacy notice as a service you chose, not as a provider working for Made for Stream. Made for Stream receives only the identity or connection details covered by your authorisation."
    ]
  },
  {
    "title": "4. Processing outside Canada",
    "body": [
      "Made for Stream operates from Canada, and the providers above process information mainly in the United States. Section 9 of the Privacy Policy explains how transfers are handled and how to ask about them."
    ]
  }
] as const;
