# Made for Stream: questions for a tax adviser

Prepared 2026-10-13. This is a brief to send to a tax adviser. It describes
how the site handles money and tax today, lists what is missing, proposes
a model with ten questions about it, then asks thirty detailed questions.
It is written by the site's builders, who are not tax advisers. Revised 2026-10-28: section 7 now proposes one model to test
first. Nothing here is a tax position; where we describe a rule, it is our
understanding and may be wrong.

**No tax is collected on the live site today, and none will be until these
questions are answered.**

## Before sending: the owner fills these in

The adviser will need these, and the site's records do not hold them.

- Legal form of the operator (sole proprietor, partnership or corporation)
  and its legal name: ______
- Business number: ______ (pending when this was written)
- GST/HST registration: registered / not registered. If registered, since: ______
- Any tax registration outside Canada: ______
- Planned launch date: ______
- Expected sales in the first twelve months, roughly, and where buyers and
  creators are expected to be: ______
- Sales so far: none on the live site. Every payment to date is a test.

## 1. What Made for Stream is

An online marketplace for people who make things for live streamers: channel
artwork, emotes, overlays, video editing and similar work. It is operated from
Alberta, Canada (Made for Stream, P.O. Box 34086, Calgary RPO Westbrook,
Alberta T3C 3W2).

Creators list what they offer. Buyers order from a creator through the site.
The two agree a description of the work, a price and a payment schedule, and
the creator delivers the finished files through the site.

Creators and buyers can each be a private individual or a business. Each
account says which it is.

## 2. What is sold

| Kind of listing | What it is | Status today |
| --- | --- | --- |
| Custom commission | Work made to order by a person for one buyer, delivered as digital files. Often paid in stages (a deposit, then milestones). | Sold |
| Service | Work done for the buyer, such as editing or setup, which may be live or booked for a time. | Sold |
| Digital item | A ready-made digital product. | Sold today only by request: the buyer asks, the creator confirms, then the buyer pays. A buy-now download with no creator involvement is planned but not built. |
| Free listing | A download or link given away at no charge. No payment is taken. | Offered |

Nothing physical is sold or shipped.

Each listing records which of the three paid kinds it is. It also has a
category, but creators type the category themselves, so it is not a reliable
label.

## 3. Who can use it, and in which currencies

- **Creators** can be paid in these countries: Australia, Austria, Belgium,
  Bulgaria, Canada, Croatia, Cyprus, Denmark, Estonia, Finland, France,
  Germany, Greece, Hong Kong, Ireland, Italy, Latvia, Liechtenstein,
  Lithuania, Luxembourg, Malta, Mexico, the Netherlands, New Zealand, Norway,
  Poland, Portugal, Singapore, Slovakia, Slovenia, Spain, Sweden,
  Switzerland, the United Kingdom and the United States.
- **Buyers** can be anywhere. Nothing in the site stops a buyer in any
  country from paying.
- **Prices** are set in the creator's local currency. Fifteen currencies are
  switched on: CAD, USD, EUR, GBP, AUD, NZD, CHF, SGD, SEK, NOK, DKK, PLN,
  MXN, BRL and HKD. (Brazilian creators cannot be paid at present, so BRL is
  not in use.)

## 4. How the money moves

Payments are handled by Stripe. Each creator has their own Stripe account,
opened through Made for Stream, and Stripe checks their identity.

When a buyer pays:

1. The buyer's card is charged **on the creator's Stripe account**. The
   creator's account is the one that receives the payment; Made for Stream's
   account does not receive the sale price.
2. Out of that payment, Stripe passes Made for Stream a platform fee. The
   creator keeps the rest.
3. Stripe's own card-processing charge comes out of the creator's share.
4. The creator's share is held for 14 days before it is paid out to their
   bank.

What the buyer pays is made up of:

- the **project amount** (the price agreed with the creator);
- a **buyer service fee** of 5% of the project amount, which goes to Made for
  Stream;
- an optional **tip** for the creator;
- an optional **contribution** to Made for Stream;
- **tax**, where it is collected.

What Made for Stream receives out of each payment:

- the buyer service fee;
- a **creator fee** of 5% of the project amount, taken from the creator's
  share;
- the contribution, if any;
- all of the tax collected;
- occasionally, a repayment from a creator who owes Made for Stream money
  after an earlier refund.

**An example, with a made-up 5% tax rate for illustration only.** A project
of 100.00 with a 10.00 tip and a 2.00 contribution:

| | Amount |
| --- | --- |
| Project amount | 100.00 |
| Buyer service fee (5%) | 5.00 |
| Tip | 10.00 |
| Contribution | 2.00 |
| Tax (5% of the project amount and the buyer fee) | 5.25 |
| **Buyer pays** | **122.25** |
| Made for Stream receives (5.00 buyer fee + 5.00 creator fee + 2.00 contribution + 5.25 tax) | 17.25 |
| Creator receives, before Stripe's processing charge | 105.00 |

## 5. How tax works in the site today

The tax system is built and has been run in test conditions only. On the live
site it is switched off.

When it is switched on for a country:

- **Whose tax registration:** Made for Stream's. Tax is worked out using the
  registrations Made for Stream holds, through Stripe's tax service.
- **Whose location:** the buyer's. The site uses the country, province or
  state, and postal code the buyer saved in their account. The creator's
  location and the creator's own tax status are not used at all.
- **What is taxed:** up to four parts of the payment can each be taxed or not
  taxed, and each can be given its own product type: the project amount, the
  buyer service fee, the tip and the contribution. The creator fee is not one
  of them (see the gaps below).
- **How the buyer sees it:** tax appears as its own line before the buyer
  pays, labelled with the country or region.
- **Where the tax goes:** to Made for Stream, along with its fees. The
  creator does not receive or handle it.
- **Records:** after payment the sale is recorded in Stripe's tax records
  under Made for Stream's account, for use in returns.
- **Proof of the buyer's location:** the site keeps the buyer's declared
  country, the country of the billing address given at payment, and the
  country that issued the card. Only the country is kept. A payment counts as
  having enough proof when two different kinds agree with the country that
  was taxed. The buyer's internet address is not used today.
- **Refunds:** a partial refund returns a matching share of the tax, and the
  tax records are reduced to match.
- **How long records are kept:** seven years.

**The owner's decisions so far (made 2026-10-12, for testing only):** tips and
contributions are not taxed; the test setup collects in every country the site
serves; every listing is treated as the same product type. These are stand-ins
so the system could be tested. They are not a view on the law.

## 6. What is missing

1. **No tax on the creator fee.** The 5% fee Made for Stream charges creators
   has no tax handling of any kind.
2. **One product type for everything.** A custom commission, a service and a
   ready-made digital item are all treated identically for tax.
3. **Business buyers are treated like consumers.** A buyer's tax number is
   not asked for at purchase or checked, and no reverse charge is applied.
4. **No reporting on sellers.** The site holds each account's legal name,
   date of birth, address and whether it is an individual or a business, plus
   an optional business number and tax number. The site does not check any of
   these itself. (Stripe separately checks each creator's identity.) No US
   tax forms are collected, and nothing is reported to any tax authority
   about what creators earn.
5. **Receipts do not name the seller.** The buyer's receipt gives the amount
   and the project title. It does not say who the seller is for tax purposes,
   and shows no tax number.
6. **No limit on buyer countries.** A buyer anywhere in the world can pay,
   whether or not Made for Stream is registered there.

Two smaller points the adviser may want to know:

- If a buyer's bank reverses a payment (a chargeback), the site does not
  adjust the tax records by itself.
- The buyer's declared country comes from their account and cannot be changed
  for a single purchase.

## 7. Our proposal: please answer this first

Added 2026-10-28. Rather than ask you to design our tax position from the
thirty questions in section 8, we would like you to test one specific model.
If it is sound, most of section 8 becomes narrower or falls away.

**The model.**

1. **Custom commissions and services** (work made or done by a person for
   one buyer). The creator is the seller. The creator decides whether they
   must charge tax and, if so, adds their own rate to the agreement (for
   example "GST 5%"). It shows as its own line, is charged on the creator's
   Stripe account and goes to the creator, not to us. The creator files it.
   The buyer's receipt names the creator as the seller and shows their tax
   number and any invoice note they add. Made for Stream does not
   calculate, collect or file this tax.
2. **Instant-buy downloads** (a ready-made product the buyer pays for and
   receives with no step by the creator; not built yet). Made for Stream
   treats itself as the seller for tax wherever the law makes a platform
   the seller, and calculates, collects and files the tax using the system
   described in section 5.
3. **Our own fees** (the buyer service fee, the creator fee and the
   contribution). These are Made for Stream's own sales. We tax them
   wherever we are registered.
4. **Unchanged:** the buyer is charged on the creator's own Stripe account;
   one creator per checkout, with no shopping cart; Made for Stream takes its
   fees out of each payment as it is made.

**Why we think it may work.** Our understanding is that the rules making a
platform the seller in the EU and the UK cover services that are
essentially automated, and that work made to order by a person and sent
digitally is not automated. Our understanding is also that the Stripe
arrangement does not decide this on its own, because we set the terms, run
the checkout and approve the charge. A second set of general answers we were
given (2026-10-28) said the opposite: that charging on the creator's account
removes platform liability in the US, Canada, Australia and Asia. It named
no rules, and it contradicted itself, so we do not rely on it.

**The questions.** A short answer per market is ideal: Canada, the United
States, the United Kingdom, the EU and Australia.

P1. Is the model sound in each of those markets? If not, which part fails,
    and under which rule?

P2. **Commissions and the EU and UK platform rules.** Is a custom
    commission, made by a person and delivered as files through the site,
    outside the rules that make a platform the seller of electronically
    supplied services? Does the answer change if the creator uses
    software or AI tools to make the work?

P3. **Creators in another country.** Canada's rules for distribution
    platform operators and Australia's rules for electronic distribution
    platforms appear to catch sales made through a platform by sellers
    outside the buyer's country, and may include services.
    - Would we be liable for a commission by a US creator sold to a
      Canadian consumer, or by a UK creator to an Australian consumer?
    - From what level of sales? Can we stay below it at first?
    - If we can't, is the answer to keep buyers in those countries from
      ordering from creators abroad until we are registered?

P4. **United States.** Do any states' marketplace facilitator laws reach
    custom digital work or services sold through a platform that runs the
    checkout? If so, which states, and from what level of sales?

P5. **The creator's own tax line.** When the creator adds tax and it goes
    to their own Stripe account:
    - Do we have any duty to check that they are registered, or to stop an
      unregistered creator from charging tax?
    - Must we stop a creator charging a rate that is wrong for the buyer's
      location, or is that the creator's responsibility alone?
    - Does showing it as a line on our checkout make us responsible for it
      in any market?

P6. **Receipts for the creator's sale.** What must they show: legal name or
    shop name, address, tax number, a receipt number? Many creators are
    private individuals working from home: must their home address be shown?
    Is an emailed receipt with a page the buyer can print enough? (This
    replaces question 4.)

P7. **Where the line falls.** A ready-made item that the creator confirms
    after the buyer asks for it, before the buyer pays: commission side or
    instant-buy side?

P8. **Instant buys.**
    - Confirm that we would be the seller in each market.
    - We understand the EU needs a single registration (the non-Union One
      Stop Shop) from the first sale to an EU consumer, and the UK its own
      registration. Is that right, and in what order should we register?
    - Can we launch instant buys to buyers in Canada and the US only?

P9. **Our fees.** Where is each one taxed, and at what rate:
    - the buyer service fee, charged to the buyer;
    - the creator fee, charged to the creator, who may be a business or a
      private individual in any of 35 countries;
    - the contribution, which the buyer chooses to give?
    (This narrows questions 10 to 12, 28 and 29.)

P10. **Wording.** What must the Terms of Service, the Creator Terms and the
     Fee Schedule say for the model to hold? For example, that the creator
     is the seller of commissions and responsible for their own tax.
     (This replaces question 30.)

**Not affected by the model.** Reporting on creators' earnings (questions
24 to 27) seems to apply whoever the seller is, so those questions stand as
written. Evidence of the buyer's location, refunds of tax and records
(questions 20 to 23) would apply to instant buys and our fees only.

## 8. The detailed questions

Revised 2026-10-13. The numbers are unchanged from the first version. If
the model in section 7 holds, many of these narrow or fall away.

**None of these is settled.** Since the first version we were given a set of
general answers. We cannot vouch for where they came from, they named no
rules, and one fact in them was wrong when we checked it. Nothing has been
acted on. Where they made a claim, the question now says "We were told" and
asks you to confirm or correct it and name the rule. Questions marked
**Open** were not addressed at all.

**Where to start.** Questions 1, 2, 6, 11, 24 and 28 decide the most work. If
time is limited, those first.

**What we are considering.** Launching to buyers in Canada and the United
States only, and keeping buyers elsewhere out until we are registered. This
is not decided. Question 19 asks whether it is sound.

Where the answer differs by market, a short answer per market is the most
useful form. A table is welcome.

### A. Who is the seller

1. We were told Made for Stream is the deemed seller of **automated
   downloads** in the EU, the UK, Canada and some US states, but that for
   **custom commissions and services** the creator stays the seller and we
   only supply a platform service.
   - Is that right in each market, and under which rule?
   - We sell no automated downloads today. Everything is made, or at least
     confirmed, by the creator after a request. Does that make the creator
     the seller of everything we sell today?
   - In Canada, do the platform operator rules reach sales by Canadian
     creators, or only sales by creators outside Canada?
   - A ready-made item that the creator confirms before the buyer pays: is
     that an automated download or not?
2. We were told that charging the buyer on the creator's own Stripe account
   changes nothing, because we control the checkout.
   - Is that right in every market where we would be the deemed seller?
   - Stripe's tax service does not support the platform being liable on that
     kind of charge, so we calculate the tax ourselves and take it with our
     fee. Is that arrangement acceptable?
3. **Open.** Does the answer to question 1 differ when the creator is a
   registered business rather than a private individual under the
   registration threshold? Where an unregistered creator is the seller, is
   no tax due on the project amount at all?
4. We were told that where the creator is the seller, the invoice must show
   the creator's legal name, business address and local tax number, and say
   that Made for Stream acted only as the platform and payment provider.
   - Is that right, and in which markets?
   - Many creators are private individuals with no tax number, working from
     home. Must their home address be shown to the buyer?
   - Is an emailed receipt enough, or is a numbered tax invoice required?

### B. What kind of sale each listing is

5. We were told an automated download is an electronically supplied service,
   and a hand-made commission is a "digital service". Is "digital service" a
   recognised category, separate from an ordinary service, and what follows
   from it?
6. We were told both kinds are taxed where the buyer is. Stripe's own
   guidance for general services says that in the EU a sale to a consumer is
   taxed where the seller is. Which is right for custom work sold to a
   consumer in the EU, the UK and Canada? If it is the seller's location,
   is that the creator's or ours?
7. Do ready-made downloads, live or bookable services, and custom work need
   different treatment? (Partly covered by 1, 5 and 6.)
8. We were given three Stripe product tax codes. One does not exist in
   Stripe's list. The other two are Stripe's general ones: "General -
   Electronically Supplied Services" (`txcd_10000000`) and "General -
   Services" (`txcd_20030000`). Stripe also has narrower ones, such as
   "Digital Finished Artwork - downloaded" (`txcd_10505001`) and
   "Professional Services" (`txcd_20060000`). Which code should each kind of
   listing carry: custom commission, service, ready-made digital item?
9. We were told business buyers must be able to enter a tax number, that it
   must be validated, and that a validated buyer outside Canada pays no tax
   under the reverse charge.
   - Is that right?
   - Must the number be checked before the sale, or may it be checked after?
   - What applies to Canadian business buyers, and to US business buyers?

### C. Our own fees and the extras

10. We were told the buyer service fee is taxable where the buyer is, at the
    same rate as the item. If the item is the creator's sale and carries no
    tax, is our fee still taxed, and under whose rules?
11. We were told the creator fee carries GST/HST at the rate of the creator's
    province when the creator is in Canada, and is zero-rated when the
    creator is outside Canada.
    - Is that right?
    - Is the tax added on top of the 5%, or included in it?
    - Does it matter whether the creator is a registered business or a
      private individual?
    - Creators can be in 35 countries. Do we owe tax in a creator's own
      country on the fee we charge them, for example to a private individual
      in the EU or the UK?
12. We were told tips are typically not taxed at the point of sale, and that
    a contribution to Made for Stream is taxed where the buyer is. The
    owner's working choice is that neither is taxed. Which is right, in each
    market?
13. **Open.** Is a free listing ever a taxable supply?

### D. Where we must register, and when

14. We were told the EU and the UK have no threshold for a foreign platform
    selling downloads. If we sell no automated downloads and the creator is
    the seller of custom work, does anything still require us to register
    there? Would our own fees alone do it?
15. We were told British Columbia, Saskatchewan and Quebec require
    registration above a small threshold of about 10,000 CAD, and Manitoba
    whenever we facilitate sales to its residents. What is the actual
    threshold and trigger for each province?
16. **Mostly open.** We were told only that US states typically use 100,000
    USD or 200 transactions. Which states tax custom digital work or digital
    goods at all? Do their marketplace rules cover services? Where would we
    register first?
17. We were told we can use the One Stop Shop's non-Union scheme from Canada
    for all 27 member states, and that the UK needs its own registration.
    Is that right? Do we need a representative in the EU to use it?
18. **Mostly open.** We were told to keep out buyers in the EU, the UK,
    Brazil and Switzerland. What about Norway, Australia, New Zealand,
    Singapore, Mexico and Hong Kong: is there a threshold we can stay under,
    or must buyers be kept out?
19. Is launching to buyers in Canada and the United States only a sound way
    to start?
    - Are there provinces or states we should also keep out at first?
    - Keeping buyers out does not keep creators out. Does having creators in
      a country create any duty there by itself?
    - Since buyers can otherwise be anywhere, are there countries not listed
      in this brief that matter?

### E. Evidence, refunds and records

20. We were told two pieces of location evidence that do not conflict are
    needed. We keep the declared country, the billing-address country and
    the card country. Is that enough in every market, including Canada and
    the US?
21. We were told that when the evidence conflicts we should ask the buyer to
    confirm their country, or fall back on the billing address. Is either
    acceptable everywhere?
22. We were told tax is returned in proportion on a partial refund or a
    chargeback. We do this for refunds. For a chargeback, must the tax
    records be adjusted, and can the tax be recovered when a chargeback is
    lost?
23. We were told Canada requires seven years and the EU ten. Is that right?
    Does ten apply to us if our only EU link is the One Stop Shop? What do
    the other markets require?

### F. Reporting on sellers

24. We were told we must report each creator's yearly earnings and verified
    identity to the Canada Revenue Agency, and that the EU's DAC7 and the UK
    rules also apply.
    - Do commissions and services count as reportable?
    - Is there an exclusion for small sellers or for a new platform?
    - Does reporting in Canada satisfy the EU and the UK, or are separate
      reports due?
    - When would the first report be due?
25. We were told collecting details without checking them is not enough.
    What exactly must we collect from each creator, and what counts as
    checking it? Does the identity check Stripe already does count?
26. We were told Stripe's sign-up covers the US Form W-9 and W-8BEN details
    for US creators. Is that right? Since buyers are charged on the
    creator's own Stripe account, who files Form 1099-K: Stripe or us?
27. **Open.** Must anything be withheld from payments to creators in any
    market?

### G. Our own position

28. We were told a platform operator cannot rely on the small-supplier
    threshold for the sales it facilitates, and must register for GST/HST
    at once.
    - Which rule says so?
    - Does it apply if we are not the deemed seller of what we sell today?
    - Does our legal form change the answer? (The text assumed a
      corporation.)
29. **Open.** Are the platform fees our taxable revenue, and where?
30. **Open.** Does any of this change the Terms, the Fee Schedule or the
    Refund Policy?

## 9. What we can change, if the answers call for it

So the adviser knows what is practical:

- Each of the four taxable parts of a payment can be switched between taxed
  and not taxed, and given a different product type, without rebuilding
  anything.
- Countries can be switched on one at a time.
- Different product types for commissions, services and digital items is a
  small change.
- Keeping buyers in chosen countries from paying is a small change.
- Tax on the creator fee, checking business buyers' tax numbers, naming the
  seller on receipts, and reporting on sellers each need to be built.
- Letting a creator add their own tax line to an agreement, and showing
  their tax number and invoice note on the receipt (the model in section 7),
  is a moderate build.
- Moving away from charging the buyer on the creator's Stripe account is
  possible but is a large rebuild. If the answer to question 2 requires it,
  we would like to know early.
