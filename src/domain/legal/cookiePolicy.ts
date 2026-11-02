export { cookiePolicyVersion } from "./policyVersions";

export const cookiePolicySections = [
  {
    "title": "1. What this policy covers",
    "body": [
      "Made for Stream uses browser storage and service integrations to operate accounts and payments. This policy explains cookies and similar technologies, including local storage, session storage, pixels, scripts and embedded content. Our Privacy Policy explains the related use of personal information and your rights.",
      "A cookie is a small browser-stored value sent with relevant requests. Local storage and session storage can keep values within your browser without using cookies. A technology does not become exempt from privacy rules merely because it is called “cookieless.” Server logs and ordinary security processing are explained in the Privacy Policy; they are not all controlled by a cookie banner."
    ]
  },
  {
    "title": "2. Our choice standard",
    "body": [
      "Made for Stream requires prior opt-in for optional analytics, advertising tracking and non-essential third-party media storage or tracking. Optional categories start off. Rejecting them must be as accessible as accepting them. You may use core marketplace functions without agreeing to optional tracking.",
      "Necessary storage supports a service you request, such as maintaining your signed-in session, protecting an account or recording privacy choices. We limit its use to the relevant purpose and do not use the necessary label to justify unrelated advertising. Where the law requires consent for a particular activity, describing it as security or fraud prevention does not remove that requirement.",
      "Some jurisdictions permit narrowly defined activities without prior consent when their conditions are met. Our optional-tracking opt-in standard still applies unless we publish a specific, legally supported change with the required information and controls."
    ]
  },
  {
    "title": "3. Technologies and purposes",
    "body": [
      "The accompanying Storage Register identifies the actual enabled technology, provider, storage name, purpose, expiry and category. A category in this policy is not a statement that every possible technology in that category is installed.",
      "Category: Authentication and account security; Purpose: Maintain requested signed-in sessions and protect access; User choice: Necessary when used solely for these purposes; browser removal can sign you out",
      "Category: Payment and fraud prevention; Purpose: Process a requested payment or creator onboarding and protect that activity; User choice: Only the necessary processing for that requested activity; other purposes require their own basis or choice",
      "Category: Privacy-choice storage; Purpose: Remember category choices and policy version; User choice: Necessary to honour your choices",
      "Category: Optional preferences; Purpose: Remember non-essential customisation; User choice: Off until selected where consent is needed",
      "Category: Analytics; Purpose: Measure product use beyond necessary operational logging; User choice: Off until opted in",
      "Category: Advertising; Purpose: Track or profile for advertising or advertising measurement; User choice: Off until opted in",
      "Category: Optional external media; Purpose: Load a third-party player or similar feature that accesses storage or tracks users; User choice: A clearly explained opt-in before loading",
      "Made for Stream's current account implementation uses Supabase session persistence. Stripe provides payment and connected-account interfaces. Google or Twitch may process data when you choose their sign-in or linking services. A link to a third-party website is different from loading that third party's code inside Made for Stream."
    ]
  },
  {
    "title": "4. Choosing and changing preferences",
    "body": [
      "Use “Cookie settings” to accept all optional categories, reject all optional categories or save individual choices. Merely visiting the site, scrolling, closing the banner or accepting the Terms of Service is not consent to optional tracking. We do not preselect optional categories.",
      "You can reopen Cookie settings at any time. Withdrawal stops future optional activity controlled by Made for Stream and removes optional storage we can remove; it does not undo lawful processing that occurred before withdrawal or remotely erase data already received by another provider. The Privacy Policy explains how to request deletion where applicable.",
      "We remember your choice for up to six months, unless you clear storage or a material change requires a new choice earlier. Refusal is remembered as well as acceptance. Choices may be specific to the browser or device you use. We retain a limited consent record as explained in the Privacy Policy."
    ]
  },
  {
    "title": "5. External services and media",
    "body": [
      "Before optional third-party media loads, the control explains the provider and relevant data sharing and offers an external link where practical. Choosing to load that media is specific to the explained purpose; it is not consent to all optional tracking elsewhere.",
      "Stripe receives data when you use its payment or onboarding services, including relevant transaction, device and verification information. Its handling of that information is described in Stripe's Privacy Policy (https://stripe.com/privacy). Necessary payment activity is not a blanket exemption for every Stripe feature or processing purpose.",
      "If you follow an external link, the destination controls its own storage and privacy choices. Made for Stream cannot change those choices for you. Before adding an optional provider, we update the Storage Register and obtain consent where required."
    ]
  },
  {
    "title": "6. Browser controls, contact and updates",
    "body": [
      "Browser settings can block or clear storage. Blocking necessary session or payment storage can prevent sign-in or checkout. Use Made for Stream's category controls for optional choices without disabling all browser storage.",
      "Contact privacy@madeforstream.com with privacy or storage questions. Material changes are described before affected optional processing begins; a new purpose is not automatically covered by a previous choice."
    ]
  },
  {
    "title": "7. Storage Register",
    "body": [
      "This is the browser storage Made for Stream's site uses. No analytics, advertising or optional external media is in use, so Cookie settings currently has no optional category to switch on. You can remove any entry through your browser settings; removing necessary storage can sign you out or interrupt a payment.",
      "Name: sb-itbgxxczuazwroniiyot-auth-token; Provider: Made for Stream, using Supabase; Type: Local storage on madeforstream.com; Purpose: Keeps you signed in and refreshes your session; Category: Authentication and account security; Duration: Until you sign out or clear it",
      "Name: creatorhub.pendingPolicyAcceptance; Provider: Made for Stream; Type: Local storage on madeforstream.com; Purpose: Holds the Terms and Privacy Policy versions you accepted while your account is created, so they can be recorded; Category: Authentication and account security; Duration: Removed once recorded",
      "Name: creatorhub.cookiePreferences; Provider: Made for Stream; Type: Local storage on madeforstream.com; Purpose: Remembers your Cookie settings choice and the policy version it applied to; Category: Privacy-choice storage; Duration: Up to six months",
      "Name: creatorhub-theme; Provider: Made for Stream; Type: Local storage on madeforstream.com; Purpose: Remembers a light or dark theme you chose; Category: Optional preferences, stored only when you choose a theme; Duration: Until you change or clear it",
      "Name: __stripe_mid and __stripe_sid; Provider: Stripe; Type: Cookies on madeforstream.com, set by Stripe.js; Purpose: Fraud prevention for a payment or creator onboarding you start; Category: Payment and fraud prevention; Duration: One year and 30 minutes respectively",
      "Stripe.js loads only on the checkout and payout-settings pages. Stripe's own pages and embedded onboarding can use further storage on Stripe's domains, governed by Stripe's Privacy Policy (https://stripe.com/privacy)."
    ]
  }
] as const;
