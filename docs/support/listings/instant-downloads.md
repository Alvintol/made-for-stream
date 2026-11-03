---
feature: listings/instant-downloads
status: active
surfaces:
  - public.listing_requests                      # fulfilment_mode, 20261103_182
  - public.listings                              # instant_licence
  - public.product_file_downloads
  - storage bucket product-files
  - public.start_instant_purchase()
  - public.get_instant_listing()
  - public.my_product_files()
  - public.my_downloads()
  - public.record_product_file_download()
  - public.can_download_product_file()
  - public.get_instant_purchase_downloads()
  - public.complete_instant_purchase_when_paid()  # trigger on listing_request_payments
  - public.keep_listing_request_fulfilment_mode() # trigger on listing_requests
  - src/domain/listings/instantDownloads.ts
  - src/hooks/listings/useInstantDownloads.ts
  - src/components/listings/InstantPurchasePanel.tsx
  - src/components/listings/ProductFilesManager.tsx
  - src/components/listings/InstantPurchaseDownloadsCard.tsx
  - src/pages/buyer/Downloads.tsx
unmatched_tier: 2
---

# Instant downloads — Support Playbook

A creator sells a ready-made digital item, such as an overlay pack, as many times
as people buy it. The buyer pays and downloads the files straight away from
Downloads, and can download them again while the purchase isn't fully refunded.
Money is involved, and a refund decision turns on whether a file was downloaded.

**How it's built.** A purchase is a listing request with
`fulfilment_mode = 'instant'`, made by `start_instant_purchase()` with one
`one_time` payment. Payments, refunds, invoices, sales numbers and tax all use the
commission paths. A purchase has no conversation and sends no commission emails.
The creator gets the usual "payment received" email. When Stripe marks the payment
paid, a trigger completes the request, so it counts as a sale.

**Who can open the files.** The listing's creator, admins, and a buyer whose
payment is `paid` or `partially_refunded` (`can_download_product_file()`). A full
refund closes them. Access follows the payment, not the request's status, so a
purchase that failed to complete still opens.

**Rules the database enforces.** The listing must be published and live, digital,
instant, not free, at a fixed price of at least 10, with a licence and at least one
file. The buyer can't be the creator and can't already own it. The creator must be
able to take paid work and have no recovery balance. Files must be one of the
commission delivery file types, up to 10 a listing, 2 GB each. A buyer can't create
a purchase directly, and no request can switch between commission and purchase.

**Tax.** Made for Stream absorbs the GST/HST on the whole price, at the buyer's
rate (owner's decision, 2026-11-02). There is no creator-side tax on a download.
See [`../payments/sales.md`](../payments/sales.md).

**Refunds.** Refund Policy section 12. Until a file is downloaded, a refund is
allowed within 14 days. After that, only for a faulty file, one that won't open or
one materially not as described, that the creator doesn't fix within 7 days. The
admin request page shows **Instant download** with the number of downloads and the
first one. Creators aren't shown download records. Refund through the usual admin
refund panel on that page.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "This item isn't ready to buy yet. The creator still needs to finish setting it up." | [`DL-002`](#dl-002--an-item-cant-be-bought) |
| "This item isn't for sale right now." | [`DL-002`](#dl-002--an-item-cant-be-bought) |
| "You already own this. You'll find it under Downloads." | Expected: they bought it already |
| "Your payment for this is still going through. Check Downloads in a few minutes." | Expected while Stripe is processing. If it lasts over an hour, see `payments/` playbooks |
| "This file isn't available to you." | [`DL-003`](#dl-003--a-download-is-refused) |
| A paid purchase isn't in the creator's Sales | [`DL-001`](#dl-001--a-paid-purchase-didnt-complete) |
| An upload is refused | [`DL-004`](#dl-004--a-file-wont-upload) |
| A buyer wants a refund | Check the admin request page's **Instant download** card, then Refund Policy section 12 |

---

## `DL-001` — A paid purchase didn't complete

```yaml
id: DL-001
tier: 2
signals:
  - source: db
    match: "DL-001: instant purchase"
    where: "complete_instant_purchase_when_paid(), a Postgres warning in the database logs"
auto_fix: none
reason_not_automatable: "completing a request is permanent, and the cause needs a person to read"
escalate_if:
  - "more than one purchase is affected"
```

**Cause.** Completing the request failed when the payment was marked paid. The
payment still stands, because the error is caught on purpose.

**What the user sees.** The buyer can still download: access follows the payment.
The creator's Sales page doesn't show the sale, but Transactions does.

**Fix.** Read the warning's reason. Once it's fixed, complete it as the database
owner:
`update public.listing_requests set status = 'completed', completed_at = (select paid_at from public.listing_request_payments where listing_request_id = '<id>' and paid_at is not null limit 1), completed_by_user_id = buyer_user_id where id = '<id>' and fulfilment_mode = 'instant' and status = 'accepted';`

**Money impact.** None. The money has moved; only the sale count is behind.

---

## `DL-002` — An item can't be bought

```yaml
id: DL-002
tier: 2
signals:
  - source: client
    match: "This item isn't ready to buy yet. The creator still needs to finish setting it up."
    where: "start_instant_purchase(), Postgres P0001"
  - source: client
    match: "This item isn't for sale right now."
    where: "start_instant_purchase(), Postgres P0001"
auto_fix: none
reason_not_automatable: "only the creator can finish their listing"
escalate_if:
  - "the listing has files, a licence and a fixed price of 10 or more, and is live"
```

**Cause.** "Not ready" means no file, no licence, not a fixed price, or a price
under 10. "Not for sale" means it isn't published and live, is hidden by an admin,
is free, or isn't an instant digital listing.

**Fix.** Ask the creator to open the listing's page, add files under **Files for
buyers**, and check its licence and price.

**Money impact.** None. Nothing is charged.

---

## `DL-003` — A download is refused

```yaml
id: DL-003
tier: 2
signals:
  - source: client
    match: "This file isn't available to you."
    where: "record_product_file_download(), Postgres 42501"
auto_fix: none
reason_not_automatable: "it depends on the purchase's payment state"
escalate_if:
  - "the payment is paid or partially refunded and the download is still refused"
```

**Cause.** The purchase isn't paid yet, was refunded in full, or the person isn't
its buyer.

**Fix.** Check the purchase's payment status on the admin request page. A refunded
purchase stays closed.

**Money impact.** None.

---

## `DL-004` — A file won't upload

```yaml
id: DL-004
tier: 2
signals:
  - source: client
    match: "new row violates row-level security policy"
    where: "storage upload to product-files, policy \"product files creator upload\""
auto_fix: none
reason_not_automatable: "the creator has to choose a different file or listing"
escalate_if:
  - "an allowed file type under 2 GB is refused on the creator's own instant listing with fewer than 10 files"
```

**Cause.** The file type isn't on the delivery list, the listing already has 10
files, the listing isn't an instant digital listing, or it isn't the uploader's
listing. The website checks the type and count first, so this usually means the
listing was changed in another tab.

**Fix.** Ask the creator to reload, then use a listed type, or zip the files.

**Money impact.** None.

---

## Known gaps

- **No receipt email for the buyer.** They see the purchase on the return page and
  in Downloads, and each has an invoice.
- **An abandoned checkout leaves a waiting purchase.** It isn't counted anywhere,
  and the next try reuses it.
- **No download limit.** Each link lasts a minute and each download is recorded.
- **Files aren't scanned for viruses.** Only the file types are limited, as for
  commission deliveries.
- **Downloads loads up to 200 purchases at once.** Page it when a buyer owns more.
- **Buyers can't message the creator about a purchase.** They contact support.
