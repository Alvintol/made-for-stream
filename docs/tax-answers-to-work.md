# Tax: what each adviser answer means for the site

Written 2026-10-13, to go with
[`tax-adviser-questions.md`](tax-adviser-questions.md). For each group of
questions it lists the answers we are likely to get and what each would change
in the site, so an answer can be turned into work the day it arrives.

This is not tax advice and does not predict the answers. "Likely" means "an
answer we should be ready for", nothing more.

**Sizes**

| Size | Meaning |
| --- | --- |
| Settings | Done in Stripe or in the API's settings on Cloud Run. No code. |
| Small | A few days. One migration at most, plus tests and a playbook entry. |
| Feature | A sprint of its own: new screens or a new money path, a migration, tests, a playbook. |
| Rebuild | Changes how every payment works. |

How the site works today is in
[`support/payments/tax.md`](support/payments/tax.md).

---

## A. Who is the seller (questions 1 to 4)

This group decides the most. The site is built on one assumption: Made for
Stream collects tax on the whole payment under its own registrations.

| Answer | What changes | Size |
| --- | --- | --- |
| Made for Stream is the deemed seller everywhere we collect, and charging on the creator's Stripe account is acceptable | Nothing in the design. Register, then switch countries on. | Settings |
| Made for Stream is the deemed seller, but **not** while the buyer is charged on the creator's Stripe account | Move to charging on Made for Stream's account and paying creators out. This reworks the payout hold, the refund records and creator repayments. | Rebuild |
| The creator is the seller everywhere; Made for Stream only supplies a service | Stop taxing the project amount under our registrations (set that line to not taxed). Tax on our two fees stays ours. Creators who must charge tax need a way to do it: their own tax settings and their tax on the buyer's bill. | Settings to stop; Feature for creator-charged tax |
| It depends on the market, or on whether the creator is registered (question 3) | A rule per payment: who the seller is, from the buyer's market and the creator's status. Needs the creator's registration status collected and checked, which the site does not do. | Feature |
| The buyer must be shown who the seller is (question 4) | Add the seller's legal name, and whatever else is required, to the payment page and the receipt email. | Small |
| A formal tax invoice is required, with numbering and both parties' tax numbers | An invoice document per payment, and a credit note per refund. | Feature |

## B. What kind of sale each listing is (questions 5 to 9)

| Answer | What changes | Size |
| --- | --- | --- |
| One product type covers commissions, services and digital items | Set the one code. | Settings |
| Different product types for commission, service and digital item | A code per listing kind. Each listing already records its kind, so no tagging is needed. | Small |
| Different product types by category (emotes versus video editing, say) | Categories are typed freely by creators today. They would first have to become a fixed list, with existing listings sorted into it. | Small to Feature, depending on how many categories |
| Taxed where the buyer is (question 6) | Nothing. This is how it works. | None |
| Taxed where the creator is, for some kinds of sale | The calculation only knows the buyer's location. It would need the creator's location and a rule for when to use it. | Feature |
| Business buyers: collect the tax number, no checking needed | Ask for it at purchase and pass it to Stripe, which applies the reverse charge. The account form already has an optional tax number field. | Small |
| Business buyers: the number must be checked before the sale is treated as business-to-business | The same, plus waiting for the check and deciding what to charge when it fails or is slow. The receipt needs the reverse-charge wording. | Feature |

## C. Our own fees and the extras (questions 10 to 13)

| Answer | What changes | Size |
| --- | --- | --- |
| Buyer fee taxed at the buyer's location | Nothing. This is how it works. | Settings |
| Buyer fee not taxed | Set that line to not taxed. | Settings |
| Buyer fee taxed by our location (Alberta) whatever the buyer's, or only for Canadian buyers | The buyer fee would need its own calculation, separate from the project amount's. | Small |
| Creator fee not taxed anywhere | Nothing. Record the answer. | None |
| Creator fee taxed for some creators (Canadian ones, say) | A new tax amount charged to the creator, not the buyer. It lowers what the creator receives, uses the creator's location, and has to be handled in refunds. Creators need a statement showing it. Open sub-questions for the adviser: is the tax added on top of the 5% or included in it, and does a creator's own tax number remove it. | Feature |
| Tip and contribution not taxed | Already the owner's working choice. Confirm the settings. | Settings |
| Tip or contribution taxed | Change that line's code. | Settings |
| A free listing is never a taxable supply | Nothing. | None |
| A free listing is taxable somewhere | No payment exists to attach tax to. Most likely answer in practice is to stop offering free listings to that market. | Small |

## D. Where we must register, and when (questions 14 to 19)

| Answer | What changes | Size |
| --- | --- | --- |
| Register in a market | The owner registers with that tax authority, adds the registration in Stripe, and adds the country to the collection list. Fee Schedule section 6 must be reworded before the first taxed payment. | Settings, plus a policy version |
| Canadian provinces as well as GST/HST (question 15) | Add each provincial registration in Stripe. The buyer's province is already sent. | Settings |
| US states (question 16) | Add each state in Stripe. The buyer's ZIP code is already required. | Settings |
| EU through the One Stop Shop (question 17) | One registration in Stripe covers the member states. | Settings |
| Stay under a threshold in a market | Something must watch sales against the threshold. Stripe's own monitor only sees sales that were taxed, so untaxed sales need a count of our own, added to the daily ops email. | Small |
| Keep buyers out of a market until we register (questions 18 and 19) | A list of countries buyers may pay from. Not built today. Also decide where the buyer is told: at checkout, or earlier, before a creator has spent time agreeing the work. | Small |
| Do not open a currency | Switch the currency off for new listings. | Small |

## E. Evidence, refunds and records (questions 20 to 23)

| Answer | What changes | Size |
| --- | --- | --- |
| Billing address and card country are enough | Nothing. | None |
| The buyer's internet location is also needed | The API has to be told the visitor's country by the network in front of it. A hosting change plus one setting. | Small |
| Conflicting evidence: flag it for a person | Nothing. The site emails ops today. | None |
| Conflicting evidence: refuse the sale | The card country is only known after payment. Before payment the site could compare the declared country with the internet location (needs the row above). | Small |
| Partial refunds return a share of the tax | Nothing. This is how it works. | None |
| Chargebacks and refunds made outside the site must adjust the tax records | Not done today. Add the adjustment where a chargeback is lost and where an outside refund is recorded. | Small |
| Records must be kept longer than seven years anywhere | Change the retention period and the Privacy Policy wording. We believe some schemes ask for ten years; the adviser should confirm. | Small, plus a policy version |

## F. Reporting on sellers (questions 24 to 27)

| Answer | What changes | Size |
| --- | --- | --- |
| Nothing applies yet, or Stripe's own reporting covers it | Possibly switch on Stripe's tax-form service. Record the answer and the threshold to watch. | Settings |
| A platform report is due (Canada, DAC7, UK or similar) | Collect each creator's tax number and make it required, check it in the way the rules ask, produce the yearly report, send each creator a yearly statement, and stop creators who do not supply details. | Feature |
| W-9 and W-8BEN must be collected by us | Collect and store the forms, and track when a W-8BEN runs out. | Feature |
| Something must be withheld from creators | A new deduction from every affected payout, with its own records and remittance. | Feature, large |

## G. Our own position (questions 28 to 30)

| Answer | What changes | Size |
| --- | --- | --- |
| Register for GST now | The owner registers. The GST number goes on receipts and in the Fee Schedule. This also triggers the fee answers in group C. | Settings, plus Small |
| Not yet; watch the threshold | Count fee income toward the threshold in the ops email. | Small |
| Platform fees are our revenue, taxable in specific places | Bookkeeping, and the fee answers in group C. | See C |
| The Terms, Fee Schedule or Refund Policy must change | Reword, publish a new version, and every account accepts again. The wording should come from counsel. | Small |

---

## What does not depend on the answers

These hold whatever the adviser says, so they can be built before the answers
arrive. None is built yet.

- Recording which product type each payment was taxed under.
- Being able to keep buyers in chosen countries from paying.
- Being able to give each listing kind its own product type.
