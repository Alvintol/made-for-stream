---
feature: listings
status: active
surfaces:
  - public.listings
  - supabase/migrations/20260921_116_exempt_free_listings_from_payout_readiness.sql
  - src/hooks/listings/listingPaymentAccountGuards.ts
  - src/hooks/listings/
  - src/pages/listings/
  - src/lib/listings/listingPreviewImage.ts
  - src/components/listings/ListingPreviewImageField.tsx
  - storage bucket listing-previews
  - public.enforce_listing_preview_is_uploaded()
  - supabase/migrations/20261006_143_add_listing_preview_uploads.sql
unmatched_tier: 2
---

# Listings — Support Playbook

Listings are what creators sell. They carry drafts, publication controls, and
revision history, and a database trigger blocks publishing an active **paid**
listing unless the creator's payout account is ready. Free listings are exempt —
they never touch Stripe.

That trigger is the most common source of confusion in this feature: a creator
who believes their Stripe setup is done gets a publish error that says nothing
about Stripe being stale.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't publish my listing" | [`LST-001`](#lst-001--publish-blocked-by-payout-readiness) |
| "I saved my listing but buyers can't see it" | The listing's page has a status banner. "Draft: only you can see this" means it was never published; "Deactivated" means it was switched off. Neither is a fault. |
| "I can't add a picture to my listing" / "my listing won't save since I added an image" | [`LST-004`](#lst-004--preview-image-cannot-be-added) |
| "My listing disappeared" | [`LST-002`](#lst-002--listing-hidden-by-moderation) |
| "Buyers say the listing is unavailable" | [`LST-003`](#lst-003--listing-not-found-or-unavailable) |
| "I can't restore my listing" | [`LST-002`](#lst-002--listing-hidden-by-moderation) |

---

## `LST-001` — Publish blocked by payout readiness

```yaml
id: LST-001
tier: 1
signals:
  - source: db
    match: "Creator payout account must be ready before publishing active listings."
    where: supabase/migrations/20260921_116_exempt_free_listings_from_payout_readiness.sql
  - source: ui
    match: "Connect and complete Stripe payout onboarding before publishing paid listings."
    where: "src/hooks/listings/listingPaymentAccountGuards.ts, the earlier client-side check. Shown on the listing's page after 'This listing could not be published:' or, when it came from the create page's Publish now, after 'Your listing was saved as a draft, but it could not be published:'"
auto_fix: resync_connect_account
params:
  user_id: "$.listing.user_id"
verify:
  - "creator_payment_accounts.charges_enabled = true"
retry_limit: 1
escalate_if:
  - "Stripe confirms the account is genuinely not ready"   # -> connect CON-004
  - "no Stripe account exists for this creator"            # -> connect CON-002
  - "the listing is free (is_free = true)"                 # -> should be exempt; see below
```

**Cause.** The trigger checks `has_ready_creator_payment_account`, which reads
our mirror of Stripe. Since nothing refreshes that mirror automatically, a
creator who finished onboarding and did not revisit their settings page is still
recorded as not ready.

**Free listings are exempt** and must never produce this signal. A free listing
serves an uploaded file or an external link and never touches Stripe, so it
publishes with no connected account at all. If this error appears for a listing
with `is_free = true`, the exemption is not working — that is a regression, not a
stale mirror, and it blocks a creator who may have no reason to onboard with
Stripe ever.

**What the user sees.** A publish failure telling them their payout account is
not ready, when as far as they are concerned it is. This is the single most
likely stale-mirror symptom, because publishing is the first thing a newly
onboarded creator does.

**Publish now on the create page.** Since 2026-10-06 a creator can publish
straight from the create form. The listing is always saved as a draft first,
then published. If the publish step is refused, nothing is lost: they land on
the listing's page, which shows the draft banner and the reason. They are not
told to start again.

**Fix.** Re-sync from Stripe, then retry the publish. See
[`connect-onboarding.md`](../payments/connect-onboarding.md) `CON-001` for the
underlying issue.

**Money impact.** None, but the creator cannot sell.

---

## `LST-002` — Listing hidden by moderation

```yaml
id: LST-002
tier: 2
signals:
  - source: db
    match: "Only admins can hide listings."
  - source: db
    match: "Only admins can restore listings."
  - source: db
    match: "Only published listings can be restored to public visibility."
  - source: user_report
    match: "creator reports their listing vanished"
auto_fix: none
reason_not_automatable: "moderation decisions are human; the agent may not write listings"
escalate_with:
  - "the listing's status and any linked moderation report"
  - "whether the creator was notified"
```

**Cause.** An admin hid the listing, usually from a report. The restore
constraint means a listing must be `published` to return to public visibility —
a draft cannot be restored into view.

**What the user sees.** Their listing gone, often without knowing why.

**Fix.** Human review. **The agent may not write to `listings`** under any tier.

**Worth noting.** If creators are finding out by discovering the absence rather
than by being told, that is a gap in the moderation flow rather than a support
case — see [`messaging/moderation.md`](../messaging/moderation.md).

**Money impact.** None directly; the creator's income from that listing stops.

---

## `LST-003` — Listing not found or unavailable

```yaml
id: LST-003
tier: 2
signals:
  - source: db
    match: "Listing not found or unavailable."
  - source: db
    match: "Listing not found."
  - source: db
    match: "Listing is not available for messages."
auto_fix: none
reason_not_automatable: "usually correct behaviour; volume is the only actionable signal"
escalate_if:
  - "a spike against many distinct listing ids"    # -> tier 3, enumeration
escalate_with:
  - "the listing ids requested and whether they exist at all"
```

**Cause.** The listing was unpublished, deleted, hidden, or never existed. Also
produced when someone tries to start a conversation about a listing that is no
longer open to messages.

**What the user sees.** A dead link — often a shared or bookmarked one.

**Fix.** Usually none needed. A buyer with a stale link needs a current one.

**Escalate on a spike across many ids.** Scattered misses are stale links. A
sweep through listing ids is someone enumerating the catalogue.

**Money impact.** None directly. A buyer hitting a dead listing is a lost sale
that nobody hears about.

---

## `LST-004` — Preview image cannot be added

```yaml
id: LST-004
tier: 2
signals:
  - source: ui
    match: "Choose a JPEG, PNG or WebP image."
    where: "validateListingPreviewSource (src/lib/listings/listingPreviewImage.ts)"
  - source: ui
    match: "That image is over 20 MB. Choose a smaller one."
    where: "validateListingPreviewSource"
  - source: ui
    match: "That image could not be read. Try a different file."
    where: "ListingPreviewImageField.tsx, when the browser cannot decode or re-save the file"
  - source: db
    match: "Listing preview must be an image uploaded to Made for Stream."
    where: "public.enforce_listing_preview_is_uploaded() (20261006_143), errcode check_violation"
  - source: storage
    match: "/Bucket not found|mime type .* is not supported|exceeded the maximum allowed size|row-level security/"
    where: "Supabase Storage's answer to the upload, shown in the form's error box"
auto_fix: none
reason_not_automatable: "the first three are the creator's file; the last two mean a migration or policy is wrong"
escalate_with:
  - "the exact message shown"
  - "the file's type and size, and the browser"
  - "whether the listing-previews bucket exists (storage.buckets)"
```

**How it works.** The creator picks an image. The page shrinks it to at most
1200 pixels, draws the watermark if that option is ticked ("Made for Stream ·
@handle", repeated diagonally), and re-saves it. Only that copy is uploaded,
to `listing-previews/<creator id>/`, when the listing is saved. The original
never reaches us. `listings.preview_url` holds the copy's public address and
`preview_watermarked` records the choice.

**Cause, by signal.**
- The three UI messages are about the file: wrong type, too large, or one the
  browser cannot open (a damaged file, or a format with a misleading name).
  Ask for a JPEG or PNG export.
- "Listing preview must be an image uploaded to Made for Stream." means
  something tried to set `preview_url` to an address outside the creator's
  own folder in the bucket. The page cannot do this; it means a hand-made
  request or an old cached page that still pastes a link.
- "Bucket not found" means `20261006_143` has not been applied in this
  environment. **While that is so, a listing with an image cannot be
  saved at all**, and neither can one without (the insert names a column the
  migration adds). Apply the migration.
- A type or size refusal from Storage means the bucket's limits (2 MB;
  WebP, JPEG, PNG) and the page's output have drifted apart.

**Fix.** As above. Listings created before uploads existed keep their old
pasted link until the creator replaces the image; that is intended.

**Money impact.** None. A listing cannot be published without an image, so a
creator who cannot upload cannot sell.

---

## Known gaps

- **The watermark and resize happen in the creator's browser.** They protect
  the creator's original from buyers. They do not stop a creator who
  deliberately bypasses the page from uploading an unprocessed image to their
  own folder; the bucket still limits type and size. If the watermark becomes
  a paid add-on, the browser alone must not be what decides who gets it.
- **Replaced and abandoned images stay in storage.** Choosing a new image, or
  failing to save after the upload, leaves the old file behind. Nothing
  cleans them up yet.
- **Uploaded images are not scanned.** A published listing's image is public
  at once; the admin "hide listing" action is the only control.

- **Readiness is only enforced at write time.** The trigger fires on insert and
  update of `listings`. A creator who becomes unready afterwards keeps their
  listings live, and nothing re-checks. See
  [`connect-onboarding.md`](../payments/connect-onboarding.md) `CON-003`.
- **A free listing flipped to paid is only checked at that write.** The trigger
  now watches `is_free`, so the flip is caught — but the same write-time
  limitation above still applies afterwards.
- **Revision-history failure modes are undocumented.** The feature exists; its
  failures fall through to unmatched Tier 2.
- **No creator notification on moderation hide** is documented, so `LST-002`
  cases arrive as confusion rather than as questions about a known action.
