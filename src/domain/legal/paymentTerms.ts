// Section 6: Made for Stream's fees include any GST/HST, and nothing is added at
// checkout (docs/support/payments/sales.md). Before tax is ever added to a
// payment, rewrite section 6 and bump this version, so buyers accept it first.
export { paymentTermsVersion } from "./policyVersions";

export const paymentTermsSections = [
  {
    "title": "1. What you pay",
    "body": [
      "The base payment is the agreed amount for a commission, milestone or accepted change order before Made for Stream fees, creator tips and optional platform support. The buyer pays the base amount plus the buyer service fee and any voluntarily chosen tip or support contribution. The creator platform fee is deducted from the creator's base proceeds; it is not an additional charge to the buyer.",
      "Charge: Buyer service fee; Rate: 5% of the base amount; Minimum fee: None",
      "Charge: Creator platform fee; Rate: 5% of the base amount; Minimum fee: None",
      "Charge: Creator tip; Rate: Optional amount chosen by the buyer; Minimum fee: No Made for Stream fee on the tip",
      "Charge: Made for Stream support; Rate: Optional amount chosen by the buyer, paid to Made for Stream; Minimum fee: No additional Made for Stream fee on the contribution",
      "A project can be priced in CAD, USD, EUR, GBP, AUD, NZD, CHF, SGD, SEK, NOK, DKK, PLN, MXN, BRL and HKD. The rates are the same in every currency. Each project agreement names one currency, and every payment for that project is charged in it; the buyer's bank may convert it. Another currency becomes available only once it is added to this list. Stripe, country, payment-method and regulatory availability may still limit payment or payout options."
    ]
  },
  {
    "title": "2. Instalments and rounding",
    "body": [
      "Fees apply separately to each successful base payment, including a deposit, milestone, balance or separately paid change order. Each fee is 5% of that payment's base amount, rounded up to the next cent. There is no minimum fee, so splitting a project into several payments costs the same in Made for Stream fees as one payment, apart from that rounding. Failed attempts and retrying the same unpaid obligation do not create additional Made for Stream fees.",
      "Each payment in a project must be at least 10.00 in the project's currency. Below that, Stripe's fixed charge on every payment would take a large share of what the creator receives. An agreement, milestone or change order containing a smaller payment cannot be sent; combine it with another payment or raise its amount. Payments already accepted before this minimum applied keep the terms they were accepted under.",
      "The agreement shows the payment schedule and the estimated Made for Stream fees before acceptance. That estimate is a maximum: the fees actually charged can be lower, never higher. A creator cannot add instalments to an accepted schedule without buyer agreement. Refunds use the original fee amounts and the refund policy's proportional formula."
    ]
  },
  {
    "title": "3. Examples",
    "body": [
      "These examples exclude currency conversion and Stripe costs. Made for Stream's fees and support already include any GST/HST.",
      "Example: CAD 100 base, no extras; Buyer pays: CAD 105; Creator receives before Stripe costs: CAD 95; Made for Stream allocation: CAD 10",
      "Example: CAD 100 base + CAD 20 tip; Buyer pays: CAD 125; Creator receives before Stripe costs: CAD 115; Made for Stream allocation: CAD 10",
      "Example: CAD 100 base + CAD 20 tip + CAD 3 support; Buyer pays: CAD 128; Creator receives before Stripe costs: CAD 115; Made for Stream allocation: CAD 13",
      "Example: CAD 10 base, one payment; Buyer pays: CAD 10.50; Creator receives before Stripe costs: CAD 9.50; Made for Stream allocation: CAD 1",
      "Example: CAD 20 base, one payment; Buyer pays: CAD 21; Creator receives before Stripe costs: CAD 19; Made for Stream allocation: CAD 2",
      "Example: CAD 20 base, two CAD 10 payments; Buyer pays: CAD 21 total; Creator receives before Stripe costs: CAD 19 total; Made for Stream allocation: CAD 2 total, the same as one payment",
      "For the CAD 100 base example, refunding CAD 40 of the base also returns CAD 2 of the buyer fee and reverses CAD 2 of the creator fee. Buyer refund: CAD 42, before any separate tip or support adjustment."
    ]
  },
  {
    "title": "4. Tips and voluntary support",
    "body": [
      "A buyer can add a creator tip, an optional Made for Stream support contribution, or both, when paying any project payment. A creator tip goes to the creator's allocation and is excluded from both Made for Stream fee calculations. Stripe processing or other provider costs may still apply. “Fee-exempt tip” means exempt from Made for Stream's fees, not a guarantee that the creator receives the tip without any processor costs.",
      "Optional Made for Stream support goes to Made for Stream, not the creator. Tips and support default to zero and must be affirmatively selected; neither is required for checkout, delivery, ordinary support or a fair moderation decision. They do not purchase priority dispute treatment. Made for Stream support is not represented as a charitable donation and does not produce a charitable tax receipt. The refund policy explains contribution refunds."
    ]
  },
  {
    "title": "5. Stripe payments and creator payouts",
    "body": [
      "Commission payments are processed as direct charges on the creator's Stripe connected account. Made for Stream collects its buyer and creator fees and any optional platform support through the payment arrangement. The creator is the supplier of the commissioned work. This description does not waive Made for Stream's own obligations or determine every tax or regulatory responsibility.",
      "Stripe processing, payout, conversion and dispute charges are separate from Made for Stream fees. The creator is responsible for those transaction-related charges to the extent charged to their connected account or expressly disclosed to and accepted by them. Made for Stream will not silently pass on a new category of platform expense. The allocation of liabilities between Stripe and Made for Stream remains governed by their actual agreement and account configuration.",
      "Payout timing depends on Stripe account status, settlement, verification, reserves and banking systems. A displayed estimate is not a guarantee. Payment confirmation, project acceptance and bank payout are separate events. Made for Stream does not provide escrow, a trust account or a promise that all funds are held pending acceptance.",
      "Creators must complete required onboarding, keep information current and maintain payment readiness. We may pause new paid work if required capabilities are restricted; existing refund and support obligations continue.",
      "A short payout hold applies after each charge so refund funds are ordinarily still available if needed; its exact length is set by Stripe and is not a number Made for Stream guarantees. Where a refund exceeds what is available in a creator's Stripe balance, Made for Stream may fund the shortfall and recover it from the creator as described in the Creator Terms, including by applying up to half of the base amount of the creator's later payments to it — while any amount is outstanding, new buyer requests to that creator are paused until it clears."
    ]
  },
  {
    "title": "6. Taxes, exchange rates and receipts",
    "body": [
      "The buyer service fee, the creator platform fee and any Made for Stream support include any GST/HST that applies to them, so no tax is added to them at checkout. For a customer in Canada, the rate is the one for the province or territory of that customer's account address, which is the buyer's for the buyer service fee and support and the creator's for the creator platform fee. Made for Stream remits that tax itself.",
      "Made for Stream does not add sales tax, VAT or GST to the creator's price. Creators remain responsible for taxes and filings on their own business income and supplies except where applicable law assigns collection or remittance to Made for Stream or another party. If Made for Stream becomes obliged to add indirect tax to a payment, including as a marketplace or deemed supplier, it will show that tax as its own line before you pay and remit it, and this schedule will be updated, and you asked to accept the change, before any tax is added.",
      "To work out which tax applies, Made for Stream uses the country and the province or state in your account address and, where available, the country associated with your IP address and the country of the card you pay with. With each payment we keep the country and the province or state, not your street address. When a payment is refunded in whole or in part, the tax included in Made for Stream's refunded fees is reversed in proportion.",
      "Payments and refunds are denominated in the transaction currency shown on the receipt. A bank or payment provider may convert that amount and apply its own rates or charges, so a converted refund can differ from the original converted debit. Made for Stream does not promise a particular external exchange rate.",
      "Each paid payment has an invoice that separately identifies the base price, buyer fee, creator tip, support contribution and total, and the GST/HST included in Made for Stream's fees. The creator's invoice also identifies the creator fee and the GST/HST included in it, but not the buyer's rate or location. A creator can choose to show their tax number on invoices, together with their business or legal name. The seller's identity must be available before purchase."
    ]
  },
  {
    "title": "7. Refunds, reversals and unauthorised payments",
    "body": [
      "The Refund, Cancellation and Dispute Policy governs full and partial refunds, including proportional returns of both Made for Stream fees. The buyer refund is not reduced by unrecovered processing costs. Made for Stream returns its refundable fee allocation; the creator remains responsible for returning refundable creator proceeds. Each party bears provider costs allocated to it under the applicable accepted terms. A party responsible for a duplicate or erroneous platform charge must correct the error without making the buyer pay to obtain the correction.",
      "Made for Stream may submit refunds and necessary fee reversals under the Creator Terms. A chargeback may reverse a payment independently of this process; we account for amounts already returned and do not seek duplicate recovery. Fraud or unauthorised-payment claims are reviewed promptly and do not require a buyer to exhaust informal negotiations first."
    ]
  },
  {
    "title": "8. Changes and future subscriptions",
    "body": [
      "This schedule contains no active creator subscription or subscription discount. Any future subscription requires separately disclosed pricing, billing frequency, renewal, cancellation and fee effects before enrolment.",
      "Made for Stream will provide at least 30 days' notice before a discretionary fee increase takes effect. Accepted project agreements keep the Made for Stream fee schedule recorded at acceptance for their agreed instalments. A change order must disclose any proposed fee-version change and obtain express acceptance; it does not silently reprice prior obligations. Changes required by law or payment networks may take effect sooner where necessary, with notice explaining the effect and any available choices."
    ]
  }
] as const;
