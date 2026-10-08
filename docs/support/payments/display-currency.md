---
feature: payments/display-currency
status: active
surfaces:
  - api/exchangeRates.js              # parseEcbRates, getExchangeRates
  - api/server.js                     # GET /api/exchange-rates
  - src/lib/money/displayCurrency.ts
  - src/hooks/money/useDisplayCurrency.ts
  - src/components/listings/ListingPriceText.tsx
  - src/components/settings/DisplayCurrencySettings.tsx
  - src/components/layout/RegionPicker.tsx   # top-bar button and dialog
  - src/lib/i18n/languages.ts                # the language list (English only)
  - public.listings.currency
  - public.set_listing_currency()
  - public.sync_listing_currency_from_payment_account()
  - public.user_display_preferences
  - supabase/migrations/20261007_146_add_listing_currency_and_display_preferences.sql
unmatched_tier: 2
---

# Listing Currency and Display Currency — Support Playbook

Two different things, which people will confuse:

- **A listing's currency** is real. It is the creator's payout currency,
  stored on the listing by the database (`listings.currency`). Agreements,
  checkout, receipts and refunds are all in it.
- **A visitor's display currency** is cosmetic. Pages may also show an
  approximate price in the visitor's own currency, marked with "≈". Nobody is
  ever charged that figure.

## How it works

**The listing's currency.** A trigger sets `listings.currency` on every
insert and update to the creator's `creator_payment_accounts.default_currency`.
A creator with no payout account keeps what the listing has (CAD for a new
listing). When a payout account is created, a second trigger moves that
creator's listings onto its currency. A client cannot choose the value.

**The display currency** is picked in this order:
1. the currency the person chose in Settings → Preferences;
2. else their saved country's currency;
3. else, for anyone signed out or with nothing saved, a guess from the
   browser's language setting (`en-CA` gives Canada). The guess is made in
   the browser and is not stored or sent anywhere.

If none of these gives a supported currency, or it is the same as the
listing's, prices are shown as they are.

**The rates** are the European Central Bank's daily euro reference rates. Our
API fetches them (the visitor's browser never contacts the ECB), keeps them
in memory for six hours, and serves them at `GET /api/exchange-rates`. They
are published once per working day, so a weekend shows Friday's rate.

**Where the estimate appears.** Cards, the market grid and the home page show
only the estimate ("≈ $80 CAD"), with the real price in the hover text. The
listing's own page shows the real price first, then the estimate, then a
note saying the listing is priced in the creator's currency and the buyer's
bank sets the actual rate. The request form, agreements, checkout and
receipts show the real currency only.

**Privacy.** Country and display currency live in `user_display_preferences`,
readable and writable only by their owner. They are deliberately not on
`profiles`, which anyone can read. Since `20261008_150` the country here is a
copy of the address country in the person's private account details
([`../profiles/account-details.md`](../profiles/account-details.md)), written
by `sync_user_account_country()`; it is not edited on its own. The display
currency still changes nothing anyone is charged.

**On the commission request form** the budget is entered in the creator's
currency. Under it, and on the "Estimated invoice" card beside the form, the
same amount is shown in the buyer's display currency when the two differ.
The card adds the buyer service fee at the buyer's own rate
(`src/components/listingRequests/core/CommissionEstimateCard.tsx`,
`src/hooks/payments/useBuyerServiceFeeRate.ts`). Everyone is on the standard
5% today; the hook is the one place to connect buyer subscriptions later, and
a lower rate already shows as the standard fee with a discount line under it.
It is an example, not a quote: the real amounts come from the agreement, at
the rate the database locked on it.

**Where it is set.** Settings → Preferences, and the globe button in the top
bar, which opens a dialog with the same form: language and currency. The
country comes from Settings → Personal details. A signed-in person's choice
is saved to `user_display_preferences`. A signed-out visitor's choice is kept
in memory only and is gone when the page is reloaded; the "Saved" message
says so. Nothing is written to browser storage.

## Quick triage

| Symptom | Likely issue |
| --- | --- |
| "Prices stopped showing in my currency" / no "≈" anywhere | [`CUR-001`](#cur-001--exchange-rates-unavailable) |
| "The price on the card and at checkout don't match" | Expected. The card shows an estimate; checkout is in the creator's currency. See [`CUR-002`](#cur-002--buyer-charged-a-different-amount-than-the-estimate) |
| "My listing shows the wrong currency" | [`CUR-003`](#cur-003--listing-is-in-the-wrong-currency) |
| "I picked a currency and it went back after I refreshed" | Expected when signed out: the choice lasts for the page view. Signing in keeps it. See Known gaps |
| "The language list only has English" | Expected. No other language exists yet (`src/lib/i18n/languages.ts`) |
| "I can't save my country or currency" | [`CUR-004`](#cur-004--display-preference-cannot-be-saved) |

---

## `CUR-001` — Exchange rates unavailable

```yaml
id: CUR-001
tier: 2
signals:
  - source: api
    match: "/CUR-001: exchange rates could not be refreshed \\(.+\\); /"
    where: "getExchangeRates (api/exchangeRates.js), server logs"
  - source: api
    match: "GET /api/exchange-rates answers 503 'Exchange rates are not available right now.'"
auto_fix: none
reason_not_automatable: "an outside service is down, or its format changed"
escalate_with:
  - "the CUR-001 log line, which says why and whether an older copy is being served"
  - "whether https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml opens and lists all 15 supported currencies"
```

**Cause.** The API could not fetch or read the ECB's rates. If it has an
earlier copy it keeps serving that (the log line says from which date), and
nothing visible changes. A `503` only happens when a freshly started API
instance has never had a good copy. The website treats that as "no
conversion": every price shows in the creator's currency, with no "≈" and no
error. The log line's reason distinguishes a network failure from "ECB rates
document was not in the expected form", which means the ECB changed its
format or dropped a currency we support; that needs `parseEcbRates` updating.

**Fix.** Usually none: it clears when the ECB is reachable again. For a format
change, fix the parser and deploy the API.

**Money impact.** None. Rates are never used to charge anyone.

---

## `CUR-002` — Buyer charged a different amount than the estimate

```yaml
id: CUR-002
tier: 2
signals:
  - source: user_report
    match: "the price I saw is not what I was charged"
auto_fix: none
reason_not_automatable: "an explanation, unless the charge itself is wrong"
escalate_with:
  - "the listing's currency and price, and the payment row (currency, total_checkout_cents)"
  - "the buyer's display currency, if they will say"
```

**Cause.** Almost always the design working as intended. The buyer saw an
estimate in their own currency; the charge was in the creator's currency; and
their card provider converted it at its own rate, often with a fee. The
estimate uses a mid-market reference rate with no fee, so the card statement
is normally a little higher.

**Check.** Confirm the payment row's currency and amount match the agreement.
If they do, explain the above; the listing page says the same in its note. If
the payment is not in the agreement's currency, that is not this issue: it is
a defect, see [`AGR-008`](../requests/agreements.md#agr-008--agreement-or-payment-not-in-the-creators-currency).

**Money impact.** None from us. The difference is the buyer's card
provider's rate and fee.

---

## `CUR-003` — Listing is in the wrong currency

```yaml
id: CUR-003
tier: 2
signals:
  - source: db
    match: "listings.currency differs from the creator's creator_payment_accounts.default_currency"
auto_fix: none
reason_not_automatable: "should be impossible; if seen, a trigger is missing or disabled"
escalate_with:
  - "the listing row and the creator's creator_payment_accounts row"
  - "whether triggers listings_set_currency and creator_payment_accounts_sync_listing_currency exist"
```

**Cause.** By design a listing is in its creator's payout currency, and a
creator with no payout account yet is in CAD. A creator who priced "50"
meaning dollars and then opened a euro payout account now has a €50 listing:
the number does not change, only the currency. That is expected, and the
creator should re-check their prices after connecting payouts. A real
mismatch between the two columns means `20261007_146` is not fully applied.

**Fix.** For the expected case, the creator edits the price. For a real
mismatch, apply the migration; any update to the listing then corrects it.

**Money impact.** A listing price is only a starting point; the agreement
sets what is paid. But a wrong currency misleads buyers.

---

## `CUR-004` — Display preference cannot be saved

```yaml
id: CUR-004
tier: 2
signals:
  - source: ui
    match: "Your choice could not be saved. Please try again."
    where: "DisplayCurrencySettings.tsx"
  - source: db
    match: "/relation \"public.user_display_preferences\" does not exist|violates row-level security|violates check constraint|violates foreign key constraint/"
auto_fix: none
reason_not_automatable: "a missing migration, or a value the form should not have sent"
```

**Cause.** "does not exist" means `20261007_146` is not applied. The other
messages mean a country that is not two capital letters or a currency not in
`supported_currencies`, which the form's own lists should prevent.

**Money impact.** None.

---

## Known gaps

- **A signed-out visitor's choice is not remembered.** Keeping it across
  visits means browser storage, which needs a new line in the Cookie
  Policy's Storage Register and a Cookie Policy version bump first.
- **Language is a list of one.** The picker shows it, but there is no
  translation system and nothing is saved. Adding a language means storing
  the choice, setting the page language and translating the site's text.

- **A country whose currency is not supported gets no default display
  currency;** the person picks one by hand. A signed-out visitor has no
  country at all, so theirs follows the browser language.
- **A buyer's optional budget on a request has no currency of its own.** It
  is entered against the listing's currency, but the request details still
  print it with a "$".
- **Admin pages and revision history still print "$"** for listing prices.
- **The browser guess can be wrong** (an English-language browser set to
  `en-US` in Germany). Signing in and choosing a country fixes it.
- **Weekend and holiday rates are the last working day's.**
