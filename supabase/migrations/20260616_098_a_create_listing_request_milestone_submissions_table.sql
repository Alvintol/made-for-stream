-- Added 2026-11-11 so the chain replays on an empty database (prod).
--
-- 20260616_098 is named for this table but only holds its functions: the
-- table itself was made by hand on dev. This creates it in the shape 098
-- expects; 154, 159 and 162 add the preview and off-site delivery columns.
-- Changes nothing on dev, where the table exists.

create table if not exists public.listing_request_milestone_submissions (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.listing_request_milestones(id) on delete cascade,
  listing_request_id uuid not null references public.listing_requests(id) on delete cascade,
  agreement_id uuid not null references public.listing_request_agreements(id) on delete cascade,
  creator_user_id uuid not null,
  buyer_user_id uuid not null,
  version_number integer not null check (version_number >= 1),
  status text not null default 'submitted'
    check (status in ('submitted', 'revision_requested', 'buyer_approved', 'superseded')),
  summary text not null check (char_length(btrim(summary)) >= 10 and char_length(btrim(summary)) <= 4000),
  delivery_links text[] not null default '{}'::text[] check (cardinality(delivery_links) <= 20),
  revision_request_reason text,
  submitted_at timestamptz not null default now(),
  revision_requested_at timestamptz,
  buyer_approved_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listing_request_milestone_submiss_revision_request_reason_check
    check (revision_request_reason is null or char_length(btrim(revision_request_reason)) <= 2000),
  constraint listing_request_milestone_submissions_check
    check (status <> 'revision_requested' or (revision_request_reason is not null and revision_requested_at is not null)),
  constraint listing_request_milestone_submissions_check1
    check (status <> 'buyer_approved' or buyer_approved_at is not null),
  constraint listing_request_milestone_submissions_check2
    check (status <> 'superseded' or superseded_at is not null),
  constraint listing_request_milestone_submi_milestone_id_version_number_key
    unique (milestone_id, version_number)
);

alter table public.listing_request_milestone_submissions enable row level security;
