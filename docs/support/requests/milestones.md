---
feature: requests/milestones
status: active
surfaces:
  - public.listing_request_milestone_submissions
  - supabase/migrations/20260618_103_enforce_milestone_submission_sequence.sql
  - supabase/migrations/20260618_105_enforce_milestone_payment_sequence.sql
  - supabase/migrations/20260619_106_align_milestone_sequence_guards.sql
  - supabase/migrations/20261011_154_add_milestone_preview_images.sql
  - storage bucket milestone-previews (private)
  - supabase/migrations/20261012_159_add_commission_image_retention.sql
  - public.commission_image_retention
  - api/server.js   # deleteExpiredCommissionImages, in the hourly ops run
  - public.submit_listing_request_milestone
  - src/lib/listings/milestonePreviewImage.ts
  - src/components/listingRequests/milestones/ListingRequestMilestoneSubmissionForm.tsx
  - src/components/listingRequests/milestones/ListingRequestMilestoneSummary.tsx
unmatched_tier: 2
---

# Milestones — Support Playbook

Milestone projects split the work and the money into stages. The creator submits
a milestone, the buyer approves it or requests a revision, and the associated
payment is taken. Several database guards enforce that milestones are submitted,
approved and paid **in order**.

Those sequence guards are the important thing in this playbook. They exist
because out-of-order milestone payments mean money changing hands for work that
was never staged — so a sequence-guard violation is never "just" a validation
error. It is the system reporting that the workflow is in a state it should not
be able to reach.

**Any sequence-guard violation is Tier 3.** Do not retry it.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't submit this milestone" | [`MIL-001`](#mil-001--milestone-submitted-out-of-order) |
| "Buyer approved but it didn't unlock" | [`WHK-002`](../payments/webhooks.md#whk-002--payment-marked-paid-but-the-workflow-did-not-advance) |
| "I approved it and there is no way to pay" | Reload the page. Before 2026-10-11 approving did not refresh the payments list, so the pay button only showed after a reload. If it is still missing after a reload, the payment row was not created: [`CHG-003`](change-orders.md#chg-003--accepted-change-order-did-not-create-its-payment) describes the same check. |
| "My submission was rejected" | [`MIL-002`](#mil-002--submission-content-rejected) |
| "It won't let me approve" | [`MIL-003`](#mil-003--invalid-milestone-response) |
| "My image won't upload" / "I can't see the creator's images" | [`MIL-005`](#mil-005--milestone-preview-image-problems) |
| "The images on my old commission are gone" / "Keep the images, there is a dispute" | [`MIL-006`](#mil-006--commission-images-deleted-after-the-retention-period) |

---

## `MIL-001` — Milestone submitted out of order

```yaml
id: MIL-001
tier: 3
signals:
  - source: db
    match: "Another milestone must be resolved before this milestone can be submitted."
  - source: db
    match: "Earlier milestones must be completed before this milestone can be submitted."
  - source: db
    match: "Previous milestones must be completed before this milestone can be submitted."
  - source: db
    match: "Previous milestones must be completed before this milestone can be approved."
  - source: db
    match: "Previous milestones must be completed before this milestone payment can be confirmed."
auto_fix: none
reason_not_automatable: "workflow integrity guard; retrying cannot help and may compound"
escalate_with:
  - "every milestone for the request with its state and payment status"
  - "the milestone that was attempted and the one blocking it"
  - "whether any payment has been taken out of sequence"
```

**Cause.** Two readings, and they need separating.

**Benign:** the UI offered a submit action for a milestone that is not next. A
front-end bug, annoying but harmless — the guard held.

**Not benign:** the milestones are genuinely in an inconsistent state, which can
mean a payment applied to the wrong stage.

**Why Tier 3 either way.** The two are indistinguishable from the error alone,
and the second involves money against the wrong work. Verify the whole milestone
chain before deciding it was only a UI bug.

**Fix.** None automated. Walk the full sequence and confirm each milestone's
state and payment agree.

**Money impact.** Potentially wrong. Milestone payments are released against
staged work; out-of-order submission means that link may be broken.

---

## `MIL-002` — Submission content rejected

```yaml
id: MIL-002
tier: 2
signals:
  - source: db
    match: "Milestone submission summary must be between 10 and 4000 characters."
  - source: db
    match: "A milestone submission can contain no more than 20 delivery links."
  - source: db
    match: "Each milestone delivery link must be 2000 characters or fewer."
auto_fix: none
reason_not_automatable: "user input correction"
escalate_if:
  - "the 20-link limit is hit repeatedly"   # the limit may be too low for real work
```

**Cause.** Server-side validation on submission content.

**What the user sees.** A rejected submission after writing it up, which for a
creator delivering work is a bad moment.

**Fix.** Adjust the content. If the link limit is being hit regularly, that is
worth revisiting — some deliverables legitimately have many files, and the limit
is a guess rather than a requirement.

**Money impact.** None. Delivery is delayed.

---

## `MIL-003` — Invalid milestone response

```yaml
id: MIL-003
tier: 2
signals:
  - source: db
    match: "Milestone response must be buyer_approved or revision_requested."
  - source: db
    match: "Revision request reason must be between 10 and 2000 characters."
  - source: db
    match: "Approval responses cannot include a revision request reason."
  - source: db
    match: "This milestone is not awaiting your response."
  - source: db
    match: "Milestone could not be found."
auto_fix: none
reason_not_automatable: "user input or client payload"
escalate_if:
  - "an approval arrives carrying a revision reason"   # client bug
  - "Milestone could not be found"                     # data inconsistency
```

**Cause.** Mostly user input — a revision request with no reason. But an approval
carrying a revision reason is a client bug, and "could not be found" is a data
problem rather than either. "Not awaiting your response" means the milestone
is not `submitted` (already answered, or the page was stale), or the caller is
not its buyer.

**Fix.** For the input case, supply a reason. The 10-character minimum exists so
the creator gets something actionable rather than "no".

**Money impact.** None directly. Approval usually releases a payment, so a
blocked approval is a blocked payment.

---

## `MIL-004` — Milestone payment confirmation restricted

```yaml
id: MIL-004
tier: 2
signals:
  - source: db
    match: "Only admins can confirm milestone payments."
  - source: db
    match: "A milestone payment must reference a milestone agreement item."
  - source: db
    match: "A milestone payment references an unknown agreement item."
  - source: db
    match: "Only milestone payments can reference milestone agreement items."
auto_fix: none
reason_not_automatable: "admin confirmation is a manual fallback, not the production path"
escalate_with:
  - "why manual confirmation was being attempted"
  - "the Stripe payment state for the milestone"
```

**Cause.** Someone attempted the admin manual-confirmation path, or a payment was
linked to the wrong agreement item.

**Important context.** The `admin_confirm_*_payment` RPCs are a **break-glass
fallback from before automated Stripe payments existed**. The production path is
the webhook. If manual confirmation is being used routinely, the automated path
is failing and that is the actual problem to investigate — see
[`webhooks.md`](../payments/webhooks.md).

**Fix.** Investigate why the automated path did not fire before confirming
anything by hand.

**Money impact.** Manual confirmation marks a payment as received **without
verifying that money actually moved.** Used incorrectly, it releases work against
a payment that never happened. Treat it as a last resort.

---

## `MIL-005` — Milestone preview image problems

```yaml
id: MIL-005
tier: 2
signals:
  - source: ui
    match: "Choose a JPEG, PNG or WebP image."
    where: "validateListingPreviewSource (src/lib/listings/listingPreviewImage.ts), shown under the Preview images box"
  - source: ui
    match: "That image is over 20 MB. Choose a smaller one."
    where: "validateListingPreviewSource"
  - source: ui
    match: "That image could not be read. Try a different file."
    where: "ListingRequestMilestoneSubmissionForm, when the browser cannot open the file"
  - source: ui
    match: "The preview images could not be loaded."
    where: "ListingRequestMilestoneSummary, when the temporary addresses cannot be made"
  - source: db
    match: "A milestone submission can contain no more than 6 preview images."
    where: "public.submit_listing_request_milestone (20261011_154), errcode 22023; the form shows the same words first"
  - source: db
    match: "A milestone preview image was not uploaded for this milestone. Choose the image again."
    where: "public.submit_listing_request_milestone (20261011_154), errcode 22023"
  - source: storage
    match: "/Bucket not found|mime type .* is not supported|exceeded the maximum allowed size|row-level security/"
    where: "Supabase Storage's answer to the upload, shown in the form's error box"
  - source: db
    match: "column listing_request_milestone_submissions.preview_image_paths does not exist"
    where: "the milestone list, when the website is ahead of migration 20261011_154"
auto_fix: none
reason_not_automatable: "either the creator's file, or a missing migration or policy"
escalate_if:
  - "a buyer or creator reports seeing images from a commission that is not theirs"   # -> tier 3, private files
escalate_with:
  - "the exact message shown, the file's type and size, and the browser"
  - "whether the milestone-previews bucket exists and is private (storage.buckets)"
  - "the milestone's status and the submission's preview_image_paths"
```

**How it works.** When submitting a milestone the creator may add up to six
images. The page shrinks each to at most 1200 pixels, repeats "Made for
Stream · @handle" across it and re-saves it: the same steps as a listing
thumbnail ([`LST-004`](../listings/listings.md)), except the watermark cannot
be switched off. Only those copies are uploaded, when the form is submitted,
to `milestone-previews/<milestone id>/`; the originals never reach us. The
submission's `preview_image_paths` then names them. The bucket is **private**:
the page shows each image through an address that works for one hour.

**Who can do what** (storage policies in `20261011_154`):
- Upload: only the milestone's creator, into that milestone's folder, and
  only while the milestone is `pending` or `revision_requested`.
- Read: the creator who uploaded it; the buyer and admins once a submission
  they can see names it. Nobody else, and nobody signed out.
- Change or delete: nobody. A submitted image cannot be swapped underneath
  the buyer's approval.

**Cause, by signal.**
- The first three UI messages are about the file: wrong type, too large, or
  one the browser cannot open. Only JPEG, PNG and WebP still images can be
  watermarked; a PSD, PDF, GIF, video or archive goes in the delivery links
  box instead.
- "Not uploaded for this milestone" means the submission named a file that is
  not in this milestone's folder or was not uploaded by this creator. The
  page cannot do this by itself; it means a hand-made request, or the upload
  and the submission were made by two different sessions.
- "Bucket not found" means `20261011_154` has not been applied here. **While
  that is so, the milestone list on every commission page shows an error
  instead of the submissions** ("column
  listing_request_milestone_submissions.preview_image_paths does not
  exist"), because the page reads a column the migration adds. Apply the
  migration.
- "row-level security" on upload means the milestone is not one this creator
  can submit right now: another tab already submitted it, or the buyer has
  it under review.
- A type or size refusal from Storage means the bucket's limits (2 MB; WebP
  and JPEG) and the page's output have drifted apart.
- "The preview images could not be loaded" on a page that used to show them:
  reload. If it persists for a participant, check the read policy exists.

**Fix.** As above. Nothing here is fixed by editing rows.

**Money impact.** None directly. A creator who cannot attach images can still
submit with links, so no payment is blocked.

---

## `MIL-006` — Commission images deleted after the retention period

```yaml
id: MIL-006
tier: 2
signals:
  - source: ui
    match: "The preview images for this milestone were deleted 180 days after the commission closed, as our Privacy Policy describes."
    where: "ListingRequestMilestoneSummary, when preview_images_deleted_at is set"
  - source: api
    match: "/IMG-001: expired commission images could not be listed: /"
    where: "api/server.js deleteExpiredCommissionImages"
  - source: api
    match: "/IMG-001: images of commission .+ were not deleted: /"
    where: "api/server.js deleteExpiredCommissionImages, when Storage refuses the removal"
  - source: db
    match: "/IMG-001: commission .+ still has [0-9]+ stored image\\(s\\), so it was not marked as deleted\\./"
    where: "public.mark_commission_images_deleted (20261012_159), errcode P0001"
auto_fix: none
reason_not_automatable: "deletion is deliberate and cannot be undone; a hold is a human decision"
escalate_if:
  - "images were deleted while a payment dispute on that commission was open"   # -> tier 3
escalate_with:
  - "select * from public.commission_image_retention where listing_request_id = '<request>'"
  - "the commission's status and when it closed"
```

**The rule** (Privacy Policy `2026-10-12`, section 8). Images uploaded to a
commission stay while it is open. Once it is completed, cancelled, declined
or archived they are kept **180 days** and then deleted. 180 days covers
the time in which a card payment can ordinarily be disputed, with room to
answer one. The number lives in one place:
`public.commission_image_retention_days()`.

**How it works.** When a commission that has images closes, one row is
written to `commission_image_retention` with the date its images may go. A
commission with no images gets no row, and reopening one removes its row, so
the check only ever looks at commissions that have something to delete.
Completing and later archiving keeps the first date. The hourly ops job
(`mfs-ops-alerts`, see [`alerting.md`](../operations/alerting.md)) asks the
database what is due, removes the files through the Storage API, and only
then has the database record it: `deleted_at`, the number of files, and on
each submission an empty `preview_image_paths` and
`preview_images_deleted_at`. The milestone's written summary and links stay.
Both sides then see the line quoted above in place of the images.

**Keeping images for a dispute.** Before the date passes, an admin puts the
commission on hold (a reason is required):

```sql
update public.commission_image_retention
   set on_hold = true, hold_reason = 'Chargeback opened 2027-01-10'
 where listing_request_id = '<request>';
```

A commission on hold is skipped until `on_hold` is set back to `false`.
Nothing applies a hold automatically when a dispute is opened; that is a
gap, below.

**Cause, by signal.**
- The UI line is the rule working. Deleted images cannot be brought back;
  the creator has the originals, which never left their device.
- `IMG-001` from the API: the list or the removal failed. Nothing was
  marked as deleted, and the next hourly run tries again. Repeating for the
  same commission means Storage is refusing it; check the bucket exists.
- `IMG-001` from the database: the API asked to mark a commission as done
  while files were still stored. It refuses, so the record never says
  "deleted" while a file remains.

**Money impact.** None. Losing images that a dispute needed is the risk;
that is what the hold is for.

---

## Known gaps

- **A hold is not applied automatically when a payment dispute opens.** An
  admin has to set it (`MIL-006`). Until that is automated, check
  `commission_image_retention` whenever a dispute arrives on a closed
  commission.
- **Only milestone preview images are covered**, because they are the only
  commission images that exist. Reference images, when built, must be added
  to `public.list_commission_image_paths()`. Listing images are not
  covered: a listing can be made active again and needs its image.
- **Milestone preview images are watermarked in the creator's browser.** That
  protects the creator's original from the buyer, which is the point. It does
  not stop a creator who bypasses the page from uploading an unmarked image
  to their own milestone; the bucket still limits type and size.
- **The watermark stays after the milestone is paid.** Clean files are handed
  over through delivery links and the final delivery, not by removing it.
- **Abandoned uploads stay until the commission's images are deleted.** If
  the upload succeeds and the submission then fails, the file remains,
  readable only by the creator, and goes with the rest 180 days after the
  commission closes (`MIL-006`).
- **Milestone preview images are not scanned**, and the upload box has only
  been exercised in tests and a database dry run, not in a real browser.
- **No alerting on sequence-guard violations.** `MIL-001` is Tier 3 but nothing
  detects it automatically.
- **Manual admin confirmation is still reachable in the admin UI** and is not
  labelled as break-glass, so nothing stops it being used as a routine fix.
- **Link limit of 20** has not been validated against real deliverables.
- **A milestone the buyer never responds to** now has a documented, implemented
  path via the same non-response notice and administrative closure flow as any
  other stalled request — see [`request-lifecycle.md`](request-lifecycle.md)
  `REQ-003`. It closes the request, not just the one milestone; there is no
  milestone-scoped variant.
