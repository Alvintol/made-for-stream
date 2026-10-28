---
feature: requests/final-delivery
status: active
surfaces:
  - public.listing_request_final_deliveries
  - supabase/migrations/20260609_088_create_listing_request_final_delivery_foundation.sql
  - supabase/migrations/20260619_107_enforce_final_delivery_approval_readiness.sql
  - supabase/migrations/20260619_108_enforce_final_delivery_creation_readiness.sql
  - supabase/migrations/20260611_093_complete_request_after_final_delivery_approval.sql
  - supabase/migrations/20261013_162_add_off_site_delivery_record.sql
  - supabase/migrations/20261016_163_add_final_delivery_files.sql
  - supabase/migrations/20261016_164_raise_and_watch_storage_limits.sql
  - public.record_delivery_file_download
  - supabase/migrations/20261016_165_restrict_delivery_file_types.sql
  - public.delivery_file_extensions
  - public.is_allowed_delivery_file_name
  - src/domain/listings/deliveryFileTypes.ts
  - storage bucket delivery-files (private)
  - public.create_listing_request_final_delivery_v2
  - public.can_download_delivery_file
  - public.list_commission_delivery_file_paths
  - src/lib/zip.ts
  - src/lib/listings/deliveryFiles.ts
  - src/components/listingRequests/finalDeliveries/DeliveryFilesField.tsx
  - src/components/listingRequests/finalDeliveries/DeliveryFileDownloads.tsx
  - public.create_listing_request_final_delivery_off_site
  - src/components/listingRequests/finalDeliveries/ListingRequestFinalDeliveryBuilder.tsx
unmatched_tier: 2
---

# Final Delivery — Support Playbook

Final delivery closes the project. The creator submits the finished work, the
buyer approves it or requests a revision, and approval completes the request and
closes its conversations.

Several readiness guards protect this step: there must be an accepted agreement,
milestone payments must be configured and confirmed, and outstanding payments
must be resolved before a delivery can be created or approved.

Those guards are the reason this playbook matters. **Approval is the point of no
return** — it completes the request and releases the final balance. A delivery
approved while payments are outstanding means work handed over that was not paid
for, and there is no refund or reversal path to undo it.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't submit the final delivery" | [`FIN-001`](#fin-001--delivery-blocked-by-outstanding-payments) |
| "The buyer can't approve it" | [`FIN-001`](#fin-001--delivery-blocked-by-outstanding-payments) |
| "I can't submit a new delivery" | [`FIN-002`](#fin-002--previous-delivery-not-resolved) |
| "Approved but the project isn't complete" | [`FIN-004`](#fin-004--approved-delivery-did-not-complete-the-request) |
| "My delivery was rejected on content" | [`FIN-003`](#fin-003--delivery-content-rejected) |
| "My files won't upload" / "I can't download the files" | [`FIN-005`](#fin-005--delivery-files-upload-or-download-problems) |
| "I ticked Provided off site and it would not submit" / "They say they sent it by email and I never got it" | [`MIL-007`](milestones.md#mil-007--work-sent-outside-the-site-provided-off-site) (the same record is used for milestones and final deliveries) |

---

## `FIN-001` — Delivery blocked by outstanding payments

```yaml
id: FIN-001
tier: 2
signals:
  - source: db
    match: "Outstanding project payments must be resolved before final delivery."
  - source: db
    match: "All milestone payments must be confirmed before final delivery can be created."
  - source: db
    match: "All milestone payments must be confirmed before final delivery can be approved."
  - source: db
    match: "Milestone payments must be configured before final delivery can be created."
  - source: db
    match: "Milestone payments must be configured before final delivery can be approved."
  - source: db
    match: "A buyer-accepted project agreement is required before final delivery can be created."
  - source: db
    match: "A buyer-accepted project agreement is required before final delivery can be approved."
auto_fix: none
reason_not_automatable: "the guard protects unpaid work; never bypass it"
escalate_with:
  - "every payment for the request with its status"
  - "which specific payment is unresolved"
  - "whether that payment is genuinely unpaid or merely unrecorded"
```

**Cause.** A payment is not in a resolved state. The critical distinction:

- **Genuinely unpaid** — the guard is correct and doing its job.
- **Paid but unrecorded** — the money arrived and the webhook did not land it.
  This is [`WHK-001`](../payments/webhooks.md#whk-001--transient-failure-processing-a-received-event)
  or [`PAY-005`](../payments/checkout.md#pay-005--payment-stuck-in-checkout_opened-or-processing)
  presenting itself here instead.

**Always check the second case first.** It is the more common one and it has a
safe automated fix upstream. Resolving it there clears this error without
touching the delivery at all.

**What the user sees.** A creator unable to deliver finished work, or a buyer
unable to approve work they have received — both convinced they have already paid
or been paid.

**Fix.** Resolve the payment record properly. **Never bypass the guard.** It is
the last thing standing between a creator and handing over work for free.

**Money impact.** This guard is protecting it. Bypassing it means delivering
unpaid work with no reversal path.

---

## `FIN-002` — Previous delivery not resolved

```yaml
id: FIN-002
tier: 2
signals:
  - source: db
    match: "A new final delivery can only be created after the previous delivery is revised or cancelled."
  - source: db
    match: "Only submitted final deliveries can be approved."
  - source: db
    match: "Final delivery status must be draft or submitted."
auto_fix: none
reason_not_automatable: "sequencing guard"
```

**Cause.** An existing delivery is still open. Only one can be live at a time.

**What the user sees.** A creator who wants to send an updated version and
cannot, often after a buyer asked for a change verbally rather than through the
revision flow.

**Fix.** Resolve the existing delivery first — the buyer requests a revision, or
it is cancelled.

**Money impact.** None. Completion is delayed.

---

## `FIN-003` — Delivery content rejected

```yaml
id: FIN-003
tier: 2
signals:
  - source: db
    match: "Final delivery title must be between 3 and 160 characters."
  - source: db
    match: "Final delivery summary must be between 10 and 4000 characters."
  - source: db
    match: "A final delivery can contain no more than 20 delivery links."
  - source: db
    match: "Each final delivery link must be 2000 characters or fewer."
  - source: db
    match: "Final delivery response must be revision_requested or buyer_approved."
auto_fix: none
reason_not_automatable: "user input correction"
escalate_if:
  - "the 20-link limit is hit repeatedly"
```

**Cause.** Validation on delivery content.

**Fix.** Adjust the content. As with milestones, a repeatedly-hit link limit
suggests the limit is wrong rather than the creators — a full asset pack can
reasonably exceed 20 files.

**Money impact.** None. Delivery is delayed at the final step, which is the worst
moment for it.

---

## `FIN-004` — Approved delivery did not complete the request

```yaml
id: FIN-004
tier: 1
signals:
  - source: db
    match: "final delivery status = 'buyer_approved' AND the request is not completed"
    where: public.listing_request_final_deliveries
auto_fix: reapply_payment_workflow
params:
  listing_request_payment_id: "$.final_balance_payment_id"
verify:
  - "the request status is completed"
  - "the request's conversations are closed"
retry_limit: 2
escalate_if:
  - "there is no final balance payment to reapply"
  - "the cascade raises a readiness or constraint error"   # -> tier 3
```

**Cause.** Approval should complete the request and close its conversations. If
the cascade after the final balance payment did not finish, the delivery shows
approved and the request stays open.

**What the user sees.** Both parties believe the project is done, and it will not
close. The creator may be waiting on it for payout expectations.

**Fix.** Re-run the cascade, same as
[`WHK-002`](../payments/webhooks.md#whk-002--payment-marked-paid-but-the-workflow-did-not-advance).

**If the cascade raises a readiness error**, the guards consider the request
inconsistent — Tier 3, do not retry.

**Money impact.** The final balance may be paid with the project not recorded as
complete.

---

## `FIN-005` — Delivery files: upload or download problems

```yaml
id: FIN-005
tier: 2
signals:
  - source: db
    match: "A final delivery can contain no more than 50 files."
    where: "public.create_listing_request_final_delivery_v2"
  - source: db
    match: "A delivery file was not uploaded for this commission. Choose the file again."
    where: "public.create_listing_request_final_delivery_v2"
  - source: db
    match: "The files in one final delivery can add up to 10 GB at most."
    where: "public.create_listing_request_final_delivery_v2"
  - source: storage
    match: "new row violates row-level security policy"
    where: "upload to the delivery-files bucket (policy \"delivery files creator upload\")"
  - source: storage
    match: "The object exceeded the maximum allowed size"
    where: "upload to the delivery-files bucket; Supabase Storage's own message (not seen in a real run yet)"
  - source: ui
    match: "This file cannot be downloaded yet. The buyer can download the files once nothing is owed for the final release."
    where: "public.record_delivery_file_download, shown by DeliveryFileDownloads"
  - source: ui
    match: "/^For safety, only these file types can be uploaded: .+ Not allowed: .+\\.$/"
    where: "DeliveryFilesField, for a file, a file in a chosen folder, or a file inside a zip that is not on the list"
  - source: ui
    match: "/For safety, we look inside every zip before it is uploaded, and .+ could not be opened\\./"
    where: "DeliveryFilesField, for a password-protected, damaged or zip64 archive"
  - source: db
    match: "violates check constraint \"listing_request_final_deliveries_file_types_check\""
    where: "a delivery listing a file whose type is not allowed (only if the page was bypassed)"
  - source: ui
    match: "Those files could not be zipped here. Zip them on your computer and add the .zip."
    where: "DeliveryFilesField, when zipping in the browser fails"
auto_fix: none
reason_not_automatable: "input corrections, a dashboard setting, or a payment the buyer still has to make"
escalate_with:
  - "select id, status, delivery_file_paths, delivery_files_deleted_at from public.listing_request_final_deliveries where listing_request_id = '<request>'"
  - "select item.title, item.payment_timing, item.status, item.amount from public.listing_request_payment_schedule_items item join public.listing_request_agreements a on a.id = item.agreement_id where a.listing_request_id = '<request>'"
  - "select name, metadata->>'size' as bytes, created_at from storage.objects where bucket_id = 'delivery-files' and name like '<agreement>/%'"
```

**What it is (migration `20261016_163`).** The final delivery form has a
**Files** section. A creator can add files, or choose a folder, which the
page zips in the browser before uploading (one .zip is recommended on the
form). Files go to the private `delivery-files` bucket, in a folder named
after the agreement, and are listed on the delivery
(`delivery_file_paths`). Up to 50 files, 2 GB each, 10 GB in all, within
the commission's storage allowance (20 GB by default; [`STO-001`](../operations/storage.md#sto-001--commission-storage-full)).
A folder over 2 GB is not zipped in the browser.

**Who can download:** the creator, an administrator, and the buyer once the
delivery is submitted and no payment due before the final release is still
`pending` or `payment_required` (`public.can_download_delivery_file`).
Paying the balance unlocks the files. Downloads are one-hour links that
always save the file rather than open it in the browser. Each download is
recorded first (`delivery_file_downloads`), with the same rule, so the
admin Storage page can count them.

**Cause, by signal.**

- *No more than 50 files / 10 GB:* too many or too large. Zip them, or send
  the largest as a link. A full commission is `STO-001`.
- *"was not uploaded for this commission":* the page was bypassed or out of
  date, or an upload went to another agreement's folder.
- *Row-level security on upload:* the person is not the creator, the
  agreement is not `buyer_accepted`, or the commission is no longer
  `accepted` (completed, cancelled).
- *"exceeded the maximum allowed size":* the file is over 2 GB, **or the
  project-wide upload limit in the Supabase dashboard (Storage → Settings)
  is lower than the bucket's 2 GB**. The second is a setting to raise, not
  a user error.
- *"cannot be downloaded yet":* for the buyer, a final balance is still
  owed; it unlocks when the payment is confirmed. For anyone else, the
  file is not on a delivery they can see.
- *Zipping failed:* the browser ran out of memory or does not support
  CompressionStream. Zipping on the computer works.
- *"For safety, only these file types can be uploaded":* the file, or
  something inside the folder or zip, is not on the list (migration
  `20261016_165`): images, artwork source files (PSD, CLIP, Procreate and
  the like), video, audio, 3D and Live2D models, fonts, PDF, text and zip.
  Program and script files are refused on purpose until uploads are
  scanned for viruses. The message names what was refused. Files the
  operating system adds (`.DS_Store`, `__MACOSX`, `Thumbs.db`) are left out
  of a folder and ignored inside a zip. The list is
  `public.delivery_file_extensions()` and
  `src/domain/listings/deliveryFileTypes.ts`; change both together (a test
  compares them), in a new migration.
- *"could not be opened" for a zip:* it has a password, is damaged, or is a
  zip64 archive. Zipping it again without a password fixes it.
- *A zip made on the form* is named "<creator's handle>_<listing title>_
  deliverables.zip" (2026-10-17). Every stored name keeps only letters,
  digits, `.`, `-` and `_` (spaces become underscores, accents and other
  symbols are removed), and gets a 12-character unique id before the
  extension, stored directly in the agreement's folder:
  `<agreement>/<name>_<id>.<ext>`. The download keeps that name. Files
  uploaded before 2026-10-17 sit one folder deeper
  (`<agreement>/<uuid>/<name>`) and still work.
- *"Confirm in the chat that you received the work sent outside Made for
  Stream…"* when approving: the delivery (or a milestone) was marked
  "Provided off site" and the buyer has not confirmed it arrived
  ([`MIL-008`](milestones.md#mil-008--the-buyer-has-not-confirmed-work-sent-off-site)).

**Abandoned uploads.** Files are uploaded one by one before the delivery is
saved. If the save then fails, the uploaded files stay in the agreement's
folder, visible only to the creator, and are deleted with everything else
180 days after the commission closes.

**Retention.** The files follow the commission-image rule
([`MIL-006`](milestones.md#mil-006--commission-images-deleted-after-the-retention-period)):
kept while the commission is open and for 180 days after it closes, kept
longer under a dispute hold, then deleted by the hourly ops job, which
empties `delivery_file_paths` and sets `delivery_files_deleted_at`.

**Money impact.** None directly; a locked download is the balance working
as intended.

---

## Known gaps

- **No reversal after approval.** Approval completes the request and there is no
  documented path back. If a buyer approves in error, or the delivered work turns
  out to be wrong, the only remedy is a refund — and no refund path exists. See
  [`refunds-and-disputes.md`](../payments/refunds-and-disputes.md).
- **A buyer who never responds to a delivery** now has a documented, implemented
  path — the creator sends a non-response notice, waits 7+7 days, then requests
  administrative closure. See [`request-lifecycle.md`](request-lifecycle.md)
  `REQ-003`. Not automatic: an admin has to act, and closure cancels the
  unfinished delivery rather than treating it as approved.
- **Delivery files are not scanned for viruses.** Only listed file types
  are accepted, judged by their names: a program renamed to `.png` gets
  through, and the database sees only a zip's own name (the website checks
  inside). Scanning is a paid service and is not in the budget (held
  2026-10-28). Files are always downloaded, never opened in the browser.
- **Unity packages (`.unitypackage`) are refused**, though VRChat avatars
  often ship that way, because they can carry scripts. Decided
  2026-10-28: they stay refused and are sent outside the site, which also
  suits their size; the creator ticks "Provided off site" so the buyer
  confirms receipt (`MIL-007`, `MIL-008`). Revisit with scanning.
- **Uploads are not resumable.** A very large file on a poor connection may
  fail and has to be chosen again (`FIN-005`).
- **Zipping in the browser holds the whole folder in memory**; very large
  folders are better zipped on the computer.
- **The rehearsal buyer is also an administrator**, so on the dev site that
  account can always download; the lock was checked in a database dry run
  with the admin role removed.
- **Milestones have no file upload**, only watermarked preview images.
- **Delivery links are not verified.** Nothing checks that a link resolves, so a
  dead or revoked link is indistinguishable from a good one at approval time.
- **No alerting for `FIN-004`.**
