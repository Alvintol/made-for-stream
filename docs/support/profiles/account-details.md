---
feature: profiles/account-details
status: active
surfaces:
  - public.user_account_details
  - public.user_email_preferences
  - public.validate_user_account_details()
  - public.enforce_account_details()
  - public.sync_user_account_country()
  - src/pages/AccountDetailsSettings.tsx
  - src/pages/PreferencesSettings.tsx
  - src/components/auth/ProfileSetupRedirect.tsx
  - src/hooks/settings/useAccountDetails.ts
  - src/domain/settings/accountDetails.ts
  - api/server.js  # applyCheckoutTax reads the billing location from the details
unmatched_tier: 2
---

# Private Account Details — Support Playbook

Every account must give its **private account details** once: legal first and
last name, date of birth, address, and whether it belongs to an individual or
a business. A business's legal name is required on a business account; a
business registration number and a tax number are always optional
(`20261008_150`).

Until the details are saved, a signed-in person is sent to
**Settings → Personal details** from every page except the policies, and the
account cannot:

- create a listing (`listings_require_account_details`);
- send a commission request (`listing_requests_require_account_details`);
- send a project agreement (`listing_request_agreements_require_account_details`);
- pay (`applyCheckoutTax` in `api/server.js`).

The three database triggers skip the database owner and the service role
(`auth.uid()` is null), so seed data and repairs still work.

**A row exists only when it is complete.** `validate_user_account_details()`
refuses an incomplete save, so "has a row in `user_account_details`" is the
whole test.

**Privacy.** The details are readable and writable only by their owner (RLS).
There is no admin screen for them: staff read them in the Supabase dashboard
when support, tax or a dispute needs it. They are never on `profiles`, which
anyone can read. On the settings page they are shown as `********` until the
person presses **Show details**, so they stay off screen on a stream; they are
visible while the person edits them, and the form says so.

**One country per account.** The address country is the billing country (the
API reads country, province or state and postal code from the details for tax,
see [`../payments/tax.md`](../payments/tax.md)) and is copied to
`user_display_preferences.country_code` by `sync_user_account_country()`, where
it sets the default display currency
([`../payments/display-currency.md`](../payments/display-currency.md)).

**Promotional email.** `user_email_preferences.marketing_emails` is off unless
the person ticks the box in **Settings → Preferences**.
`marketing_emails_changed_at` is set by the database and is the record of when
consent was given or withdrawn. Nothing sends promotional email yet; whatever
does must read this column and carry an unsubscribe link (Privacy Policy
section 7).

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "It keeps sending me to Personal details" | Working as designed until the form is saved. If it was saved, [`ACC-003`](#acc-003--sent-to-the-form-although-details-were-saved) |
| "I can't create a listing / send a request / send an agreement" | [`ACC-001`](#acc-001--action-refused-because-account-details-are-missing) |
| "Checkout says to add my account details" | [`ACC-001`](#acc-001--action-refused-because-account-details-are-missing) |
| "The form won't save" | [`ACC-002`](#acc-002--account-details-refused-on-save) |
| "The billing country at checkout is wrong" | The person corrects their address in Settings → Personal details |
| "I ticked the email box and it didn't stick" | [`ACC-004`](#acc-004--details-or-email-preference-cannot-be-read-or-saved) |

---

## `ACC-001` — Action refused because account details are missing

```yaml
id: ACC-001
tier: 2
signals:
  - source: db
    match: "Add your account details in Settings before you can do this."
    where: "enforce_account_details(), on insert into listings, listing_requests, listing_request_agreements"
  - source: api
    match: "Add your account details in Settings before paying."
    where: "POST /api/stripe/checkout/session"
  - source: client
    match: "Add your account details in Settings before paying."
    where: "src/pages/payments/ListingRequestPaymentCheckout.tsx"
auto_fix: none
reason_not_automatable: "only the account holder can state their own legal details"
escalate_with:
  - "the user id and what they were trying to do"
  - "whether a row exists: select 1 from public.user_account_details where user_id = '<user>'"
```

**Cause.** The account has no row in `user_account_details`. The website
normally redirects such an account to the form before it can reach any of
these actions, so this message usually means the redirect was skipped (a
direct API call, or the details could not be read: `ACC-003`,`ACC-004`).

For an agreement, the user who must have details is the **creator**: a creator
whose listings predate this rule can still receive requests, but cannot send
an agreement until their details are saved.

**What the user sees.** The message above in a red box.

**Fix.** Ask them to open Settings → Personal details and save the form. Do
not enter details for them.

**Money impact.** None. Nothing is charged; a pending payment stays payable
once the details exist.

---

## `ACC-002` — Account details refused on save

```yaml
id: ACC-002
tier: 2
signals:
  - source: db
    match: "Fill in every required account detail before saving."
    where: "validate_user_account_details()"
  - source: db
    match: "Enter a valid date of birth."
    where: "validate_user_account_details()"
  - source: db
    match: "You must be at least 18 to use Made for Stream."
    where: "validate_user_account_details()"
  - source: db
    match: "An address in Canada or the United States needs a province or state and a postal or ZIP code."
    where: "validate_user_account_details()"
  - source: db
    match: "Enter the legal name of the business."
    where: "validate_user_account_details()"
  - source: db
    match: "/violates check constraint \"user_account_details_/"
    where: "a value longer than the column allows"
auto_fix: none
reason_not_automatable: "explanation, not a fault; the details are the account holder's to correct"
```

**Cause.** The form checks the same rules first
(`src/domain/settings/accountDetails.ts`), so the database message normally
appears only when the two disagree or the browser's clock is wrong (the age
check uses the database's date).

**What the user sees.** A message under the field, or one of the messages
above in a red box under the form.

**Fix.** Explain the rule. Canada and the United States need a two-letter
province or state and a postal or ZIP code because tax depends on them; other
countries do not. A business account needs the business's legal name; the
registration and tax numbers are optional.

**Under 18.** Terms of Service section 3 requires account holders to be 18.
Do not work around it. If the person says the date was mistyped, they can
enter the right one; nothing was saved.

**Money impact.** None.

---

## `ACC-003` — Sent to the form although details were saved

```yaml
id: ACC-003
tier: 2
signals:
  - source: client
    match: "/settings/personal"
    where: "src/components/auth/ProfileSetupRedirect.tsx, redirect on every page"
auto_fix: none
reason_not_automatable: "needs a look at the row and the browser session"
escalate_with:
  - "the user id, and the result of: select user_id, updated_at from public.user_account_details where user_id = '<user>'"
```

**Cause.** The redirect happens only when the read of the person's own row
succeeds and returns nothing. If a row exists, the browser is signed in as a
different account than the person thinks (two sign-in methods make two
accounts), or is showing a cached answer from before the save.

**Fix.** Confirm which account is signed in (the email under Settings), then
reload the page. If the row exists for that account and the redirect still
happens, escalate with the row.

A read that **fails** does not redirect: the person can use the site, and the
database still refuses the gated actions (`ACC-001`).

**Money impact.** None.

---

## `ACC-004` — Details or email preference cannot be read or saved

```yaml
id: ACC-004
tier: 2
signals:
  - source: client
    match: "We couldn’t load your details. Please try again."
    where: "src/pages/AccountDetailsSettings.tsx"
  - source: client
    match: "Your choice could not be saved. Please try again."
    where: "src/pages/PreferencesSettings.tsx (also the display currency form)"
  - source: api
    match: "Your account details could not be read. Please try again."
    where: "POST /api/stripe/checkout/session"
  - source: db
    match: "/relation \"public.user_(account_details|email_preferences)\" does not exist|violates row-level security policy for table \"user_(account_details|email_preferences)\"/"
auto_fix: none
reason_not_automatable: "a missing migration or a policy fault needs a person"
escalate_with:
  - "the exact error text and the user id"
  - "whether migration 20261008_150 is applied: select to_regclass('public.user_account_details'), to_regclass('public.user_email_preferences')"
```

**Cause.** Usually migration `20261008_150` is not applied in that
environment (the API and website were shipped first), or a transient database
error. A row-level-security message means the request was made for a user id
other than the signed-in one.

**Fix.** Apply the migration if it is missing. Otherwise retry; escalate if it
repeats.

**Money impact.** None directly. While the API cannot read details, nobody can
pay: treat a repeat as urgent.

---

## Known gaps

- **Closing an account deletes its details** (`on delete cascade`). The
  Privacy Policy allows keeping what belongs to financial, tax and dispute
  records; before deleting an account that has paid or been paid, export its
  row. There is no account-closure flow yet.
- **No admin screen.** Staff read details in the Supabase dashboard.
- **Details are not verified.** They are what the person typed. Creators'
  identities are verified separately by Stripe at payout setup.
- **Province and state are shown as two-letter codes**, not names.
- **No trader declaration is shown to buyers.** An account's type
  (individual or business) is recorded but not displayed; EU and UK rules may
  require telling a buyer when a seller acts as a business. Open for counsel.
- **Promotional email is only a recorded choice.** Nothing sends it yet.
- **Details are visible while being edited.** The mask covers viewing only.
