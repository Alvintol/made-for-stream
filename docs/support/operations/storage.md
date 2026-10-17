---
feature: operations/storage
status: active
surfaces:
  - supabase/migrations/20261016_163_add_final_delivery_files.sql
  - supabase/migrations/20261016_164_raise_and_watch_storage_limits.sql
  - storage bucket delivery-files (private, 2 GB a file)
  - public.commission_storage_plans
  - public.creator_storage_plan_grants
  - public.commission_storage_limit_bytes
  - public.commission_delivery_storage_bytes
  - public.get_commission_storage_usage
  - public.record_delivery_file_download
  - public.delivery_file_downloads
  - public.admin_get_storage_overview
  - src/components/ui/UsageMeter.tsx
  - src/components/listingRequests/finalDeliveries/DeliveryFilesField.tsx
  - src/hooks/creatorRequests/useCommissionStorageUsage.ts
  - src/pages/admin/AdminStorage.tsx   # /admin/storage
unmatched_tier: 2
---

# Storage limits and plans — Support Playbook

Delivery files count against a **per-commission allowance**: 20 GB on the
default "Standard" plan. Every file uploaded to the commission counts, from
every delivery, including uploads whose delivery was never submitted. The
creator sees a **Commission storage** bar on the final delivery form, with
what they are about to add shown as a lighter part of the bar.

Other limits: 2 GB a file (the bucket), 50 files and 10 GB per delivery,
2 GB for a folder zipped in the browser. Files are deleted 180 days after
the commission closes (`MIL-006`), which frees nothing on that commission
because it is closed by then.

A creator can hold a **storage plan** with a larger allowance. Nothing sells
plans yet: the Fee Schedule (section 8) says a subscription needs its own
disclosed pricing, billing, renewal and cancellation terms before anyone
enrols. Until then a plan is given by an administrator (`STO-002`). A
commission's allowance is the largest plan its creator holds **now**, so a
plan that ends lowers the allowance of their open commissions too; files
already stored are never removed because of it, but new uploads stop until
the commission is back under the allowance.

The admin **Storage** page (`/admin/storage`) shows everything stored and
the month's delivery downloads against what the Supabase plan includes, the
largest commissions, and the plans. `OPS-008`
([alerting](alerting.md#ops-008--storage-or-downloads-passed-a-mark)) emails
ops when a mark is passed.

## Quick triage

| Symptom | Likely issue |
| --- | --- |
| "It says my commission's storage is full" / "This commission has … of storage left" | [`STO-001`](#sto-001--commission-storage-full) |
| "Give this creator more storage" | [`STO-002`](#sto-002--giving-a-creator-a-storage-plan) |
| "My files won't upload" / "I can't download" | [`FIN-005`](../requests/final-delivery.md#fin-005--delivery-files-upload-or-download-problems) |

---

## `STO-001` — Commission storage full

```yaml
id: STO-001
tier: 2
signals:
  - source: db
    match: "/This commission's storage is full: [0-9.]+ GB of [0-9.]+ GB used\\. Send the rest as a link\\./"
    where: "public.create_listing_request_final_delivery_v2"
  - source: storage
    match: "new row violates row-level security policy"
    where: "upload to delivery-files when the commission is already at its allowance (policy \"delivery files creator upload\")"
  - source: ui
    match: "/This commission has .+ of storage left\\. Remove a file, or send the largest as a link\\./"
    where: "DeliveryFilesField, before anything is uploaded"
auto_fix: none
reason_not_automatable: "raising an allowance is a decision about cost and, later, money"
escalate_with:
  - "select * from public.get_commission_storage_usage('<request>')   -- as the creator or an admin"
  - "select objects.name, objects.metadata->>'size' as bytes, objects.created_at from storage.objects join public.listing_request_agreements a on objects.name like a.id::text || '/%' where objects.bucket_id = 'delivery-files' and a.listing_request_id = '<request>' order by objects.created_at"
```

**Cause.** The commission's delivery files add up to its allowance. Often
it is earlier deliveries (a revised delivery uploads the files again), or
uploads whose delivery failed and were never submitted; both count.

**What the user sees.** The bar at or near full, and a refusal under the
Files section before anything is uploaded. If the page was out of date, the
upload itself is refused (row-level security) or the delivery is refused
with the database's message.

**Fix.** Send the rest as a link (the form says so), or give the creator a
larger plan (`STO-002`). Unsubmitted uploads cannot be removed by the
creator; they go 180 days after the commission closes. An administrator can
delete one through the Supabase dashboard (Storage) if it is clearly an
abandoned duplicate; SQL cannot delete a stored file.

**Money impact.** None.

---

## `STO-002` — Giving a creator a storage plan

```yaml
id: STO-002
tier: 2
signals:
  - source: user_report
    match: "a creator needs more storage per commission"
auto_fix: none
reason_not_automatable: "which creators get more storage, and for how long, is a business decision"
escalate_with:
  - "select * from public.commission_storage_plans order by commission_limit_bytes"
  - "select * from public.creator_storage_plan_grants where creator_user_id = '<creator>' order by starts_at desc"
```

**How.** In the Supabase SQL editor (these are the administrator's steps;
the website cannot do them):

```sql
-- Once: add a plan (sizes in bytes; 50 GB = 53687091200).
insert into public.commission_storage_plans (code, label, commission_limit_bytes)
values ('plus', 'Plus', 53687091200);

-- Give it to a creator, open-ended or until a date.
insert into public.creator_storage_plan_grants (creator_user_id, plan_code, source, ends_at)
values ('<creator user id>', 'plus', 'admin_grant', null);

-- End it.
update public.creator_storage_plan_grants set ends_at = now()
where creator_user_id = '<creator user id>' and plan_code = 'plus' and ends_at is null;
```

**For the future subscription service.** It writes grants with
`source = 'subscription'` and the provider's subscription id in
`external_reference`, setting `ends_at` when a subscription lapses. Selling
plans first needs the Fee Schedule change described above.

**Money impact.** A bigger allowance costs more storage and downloads; see
`OPS-008` for the rates.

---

## Known gaps

- **Plans are given by hand.** There is no admin screen for grants and
  nothing sells a plan.
- **Paying for more storage on one commission is not built.** It needs a
  price and a Fee Schedule change first (decision pending).
- **Downloads are counted when the link is requested**, at the file's size;
  a download that is abandoned still counts, and other traffic (images, the
  API) is not counted at all.
- **Uploads are not resumable**, so the 2 GB per file stays until they are.
- **Delivery files are not scanned for viruses.** Only listed file types
  can be uploaded (`FIN-005`); scanning is planned as a paid service.
