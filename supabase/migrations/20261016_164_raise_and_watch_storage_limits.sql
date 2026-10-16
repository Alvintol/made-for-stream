-- Storage limits for delivery files, raised and watched (decided
-- 2026-10-16, after weighing cost against a usable experience).
--
-- 20261016_163 shipped with 1 GB a file, 20 files and 5 GB a delivery.
-- This replaces those with:
--   2 GB a file           the bucket; the project-wide upload limit in the
--                         Supabase dashboard must be at least that
--   50 files, 10 GB       per final delivery
--   20 GB per commission  all its delivery files together, uploads that
--                         were never submitted included; a creator's
--                         storage plan can raise it
--
-- 1. Storage plans: commission_storage_plans (seeded with "standard",
--    20 GB a commission) and creator_storage_plan_grants (a plan given to a
--    creator for a period). Nothing sells a plan yet: the Fee Schedule
--    (section 8) says a subscription needs its own disclosed pricing before
--    anyone enrols. A grant is made by an administrator in SQL, or later by
--    the subscription service. A commission's limit is the largest plan its
--    creator holds now.
-- 2. The upload policy also stops new uploads once a commission is at its
--    limit.
-- 3. get_commission_storage_usage feeds the creator's storage bar.
-- 4. The website records each download first
--    (record_delivery_file_download, the same rule as the download policy),
--    so downloads can be counted.
-- 5. create_listing_request_final_delivery_v2 applies the new limits.
-- 6. admin_get_storage_overview feeds the admin Storage page.
-- 7. list_ops_alerts() gains OPS-008: stored files or this month's delivery
--    downloads passing a threshold of what the Supabase plan includes.

update storage.buckets
set file_size_limit = 2147483648 -- 2 GB
where id = 'delivery-files';

alter table public.listing_request_final_deliveries
  drop constraint if exists listing_request_final_deliveries_file_count_check;

alter table public.listing_request_final_deliveries
  add constraint listing_request_final_deliveries_file_count_check
    check (cardinality(delivery_file_paths) <= 50);

-- 1. Storage plans.
create table if not exists public.commission_storage_plans (
  code text primary key check (code ~ '^[a-z0-9_]{2,40}$'),
  label text not null check (char_length(btrim(label)) between 2 and 60),
  commission_limit_bytes bigint not null check (commission_limit_bytes > 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists commission_storage_plans_one_default
  on public.commission_storage_plans (is_default)
  where is_default;

insert into public.commission_storage_plans (code, label, commission_limit_bytes, is_default)
values ('standard', 'Standard', 21474836480, true) -- 20 GB
on conflict (code) do nothing;

create table if not exists public.creator_storage_plan_grants (
  id uuid primary key default gen_random_uuid(),
  creator_user_id uuid not null references auth.users (id) on delete cascade,
  plan_code text not null references public.commission_storage_plans (code),
  source text not null check (source in ('admin_grant', 'subscription')),
  -- For example the subscription's id at the payment provider, once one
  -- exists.
  external_reference text check (external_reference is null or char_length(external_reference) <= 200),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists creator_storage_plan_grants_creator_idx
  on public.creator_storage_plan_grants (creator_user_id);

alter table public.commission_storage_plans enable row level security;
alter table public.creator_storage_plan_grants enable row level security;

drop policy if exists "storage plans are readable" on public.commission_storage_plans;
create policy "storage plans are readable" on public.commission_storage_plans
  for select to authenticated
  using (true);

drop policy if exists "creators read their own storage plan grants" on public.creator_storage_plan_grants;
create policy "creators read their own storage plan grants" on public.creator_storage_plan_grants
  for select to authenticated
  using (creator_user_id = auth.uid() or public.is_admin_user(auth.uid()));

-- No insert, update or delete policies: grants are made by an
-- administrator in SQL or by the service role.
revoke insert, update, delete on public.commission_storage_plans from anon, authenticated;
revoke insert, update, delete on public.creator_storage_plan_grants from anon, authenticated;

-- The storage limit of a commission: the largest plan its creator holds
-- now, never below the default.
create or replace function public.commission_storage_limit_bytes(p_listing_request_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    (select plan.commission_limit_bytes
       from public.commission_storage_plans as plan
      where plan.is_default),
    coalesce((
      select max(plan.commission_limit_bytes)
      from public.listing_requests as request
      inner join public.creator_storage_plan_grants as grant_row
        on grant_row.creator_user_id = request.creator_user_id
        and grant_row.starts_at <= now()
        and (grant_row.ends_at is null or grant_row.ends_at > now())
      inner join public.commission_storage_plans as plan
        on plan.code = grant_row.plan_code
      where request.id = p_listing_request_id
    ), 0)
  );
$$;

-- Delivery files stored for a commission, in bytes. Zero for anyone who is
-- not its creator, its buyer or an administrator.
create or replace function public.commission_delivery_storage_bytes(p_listing_request_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum((objects.metadata ->> 'size')::bigint), 0)::bigint
  from public.listing_requests as request
  inner join public.listing_request_agreements as agreement
    on agreement.listing_request_id = request.id
  inner join storage.objects
    on objects.bucket_id = 'delivery-files'
    and objects.name like agreement.id::text || '/%'
  where request.id = p_listing_request_id
    and (
      request.creator_user_id = auth.uid()
      or request.buyer_user_id = auth.uid()
      or public.is_admin_user(auth.uid())
    );
$$;

-- Both are used by the upload policy, which runs as the person uploading.
revoke all on function public.commission_storage_limit_bytes(uuid) from public, anon;
grant execute on function public.commission_storage_limit_bytes(uuid) to authenticated;
revoke all on function public.commission_delivery_storage_bytes(uuid) from public, anon;
grant execute on function public.commission_delivery_storage_bytes(uuid) to authenticated;

-- 3. The creator's storage bar.
create or replace function public.get_commission_storage_usage(p_listing_request_id uuid)
returns table (
  used_bytes bigint,
  limit_bytes bigint,
  plan_label text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.commission_delivery_storage_bytes(request.id),
    public.commission_storage_limit_bytes(request.id),
    coalesce((
      select plan.label
      from public.creator_storage_plan_grants as grant_row
      inner join public.commission_storage_plans as plan
        on plan.code = grant_row.plan_code
      where grant_row.creator_user_id = request.creator_user_id
        and grant_row.starts_at <= now()
        and (grant_row.ends_at is null or grant_row.ends_at > now())
      order by plan.commission_limit_bytes desc
      limit 1
    ), (
      select plan.label
      from public.commission_storage_plans as plan
      where plan.is_default
    ))
  from public.listing_requests as request
  where request.id = p_listing_request_id
    and (
      request.creator_user_id = auth.uid()
      or request.buyer_user_id = auth.uid()
      or public.is_admin_user(auth.uid())
    );
$$;

revoke all on function public.get_commission_storage_usage(uuid) from public, anon;
grant execute on function public.get_commission_storage_usage(uuid) to authenticated;

-- 2. Upload: the creator, into the agreement's folder, while it is active
-- and still under the commission's limit.
drop policy if exists "delivery files creator upload" on storage.objects;
create policy "delivery files creator upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'delivery-files'
    and exists (
      select 1
      from public.listing_request_agreements
      inner join public.listing_requests
        on listing_requests.id = listing_request_agreements.listing_request_id
      where listing_request_agreements.id::text = (storage.foldername(objects.name))[1]
        and listing_request_agreements.creator_user_id = auth.uid()
        and listing_request_agreements.status = 'buyer_accepted'
        and listing_requests.status = 'accepted'
        and public.commission_delivery_storage_bytes(listing_requests.id)
          < public.commission_storage_limit_bytes(listing_requests.id)
    )
  );

-- 4. One row per download the website asked for. It counts requests for a
-- link, not bytes actually transferred; Supabase's own usage page has the
-- real egress.
create table if not exists public.delivery_file_downloads (
  id bigint generated always as identity primary key,
  listing_request_id uuid,
  path text not null,
  user_id uuid,
  bytes bigint not null default 0,
  downloaded_at timestamptz not null default now()
);

create index if not exists delivery_file_downloads_downloaded_at_idx
  on public.delivery_file_downloads (downloaded_at);

alter table public.delivery_file_downloads enable row level security;
revoke all on public.delivery_file_downloads from anon, authenticated;

create or replace function public.record_delivery_file_download(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_download_delivery_file(p_path) then
    raise exception
      'This file cannot be downloaded yet. The buyer can download the files once nothing is owed for the final release.'
      using errcode = '42501';
  end if;

  insert into public.delivery_file_downloads (listing_request_id, path, user_id, bytes)
  select
    delivery.listing_request_id,
    p_path,
    auth.uid(),
    coalesce((
      select (objects.metadata ->> 'size')::bigint
      from storage.objects
      where objects.bucket_id = 'delivery-files'
        and objects.name = p_path
    ), 0)
  from public.listing_request_final_deliveries as delivery
  where delivery.delivery_file_paths @> array[p_path]
  limit 1;
end;
$$;

revoke all on function public.record_delivery_file_download(text) from public, anon;
grant execute on function public.record_delivery_file_download(text) to authenticated;

-- 5. Creates a final delivery with its files and, optionally, the off-site
-- record.
create or replace function public.create_listing_request_final_delivery_v2(
  p_agreement_id uuid,
  p_status text,
  p_title text,
  p_summary text,
  p_delivery_links text[],
  p_file_paths text[],
  p_off_site_methods text[] default '{}'::text[],
  p_off_site_other text default null
)
returns table (
  id uuid,
  listing_request_id uuid,
  agreement_id uuid,
  status text,
  version_number integer,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_paths text[];
  clean_methods text[] := '{}'::text[];
  delivery_bytes bigint;
  commission_id uuid;
  commission_used bigint;
  commission_limit bigint;
  created record;
begin
  select coalesce(array_agg(distinct btrim(given.path)), '{}'::text[])
  into clean_paths
  from unnest(coalesce(p_file_paths, '{}'::text[])) as given(path)
  where btrim(given.path) <> '';

  if cardinality(clean_paths) > 50 then
    raise exception
      'A final delivery can contain no more than 50 files.'
      using errcode = '22023';
  end if;

  -- Every file must be one this creator uploaded into this agreement's
  -- folder.
  if exists (
    select 1
    from unnest(clean_paths) as given(path)
    where given.path not like p_agreement_id::text || '/%'
      or not exists (
        select 1
        from storage.objects
        where objects.bucket_id = 'delivery-files'
          and objects.name = given.path
          and objects.owner_id = auth.uid()::text
      )
  ) then
    raise exception
      'A delivery file was not uploaded for this commission. Choose the file again.'
      using errcode = '22023';
  end if;

  select coalesce(sum((objects.metadata ->> 'size')::bigint), 0)
  into delivery_bytes
  from storage.objects
  where objects.bucket_id = 'delivery-files'
    and objects.name = any (clean_paths);

  if delivery_bytes > 10737418240 then
    raise exception
      'The files in one final delivery can add up to 10 GB at most.'
      using errcode = '22023';
  end if;

  select agreement.listing_request_id
  into commission_id
  from public.listing_request_agreements as agreement
  where agreement.id = p_agreement_id;

  commission_used := public.commission_delivery_storage_bytes(commission_id);
  commission_limit := public.commission_storage_limit_bytes(commission_id);

  if commission_used > commission_limit then
    raise exception
      'This commission''s storage is full: % GB of % GB used. Send the rest as a link.',
      round(commission_used / 1073741824.0, 1),
      round(commission_limit / 1073741824.0, 1)
      using errcode = '22023';
  end if;

  if cardinality(coalesce(p_off_site_methods, '{}'::text[])) > 0 then
    clean_methods :=
      public.clean_off_site_delivery_methods(p_off_site_methods, p_off_site_other);
  end if;

  select *
  into created
  from public.create_listing_request_final_delivery(
    p_agreement_id,
    p_status,
    p_title,
    p_summary,
    p_delivery_links
  ) as existing_result;

  update public.listing_request_final_deliveries
  set
    delivery_file_paths = clean_paths,
    off_site_delivery_methods = clean_methods,
    off_site_delivery_other =
      case
        when 'other' = any (clean_methods) then btrim(p_off_site_other)
      end
  where listing_request_final_deliveries.id = created.id;

  return query
  select
    created.id,
    created.listing_request_id,
    created.agreement_id,
    created.status,
    created.version_number,
    created.submitted_at;
end;
$$;

revoke all on function public.create_listing_request_final_delivery_v2(
  uuid, text, text, text, text[], text[], text[], text
) from public, anon;
grant execute on function public.create_listing_request_final_delivery_v2(
  uuid, text, text, text, text[], text[], text[], text
) to authenticated;

-- 6. The admin Storage page. The included amounts are the Supabase Pro
-- plan's (100 GB stored, 250 GB of downloads a month); change them here if
-- the plan changes.
create or replace function public.admin_get_storage_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  month_start constant timestamptz :=
    date_trunc('month', now() at time zone 'utc') at time zone 'utc';
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only an administrator can see storage use.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'included_storage_bytes', 107374182400,
    'included_downloads_bytes', 268435456000,
    'stored_bytes', (
      select coalesce(sum((objects.metadata ->> 'size')::bigint), 0)
      from storage.objects
    ),
    'buckets', (
      select coalesce(jsonb_agg(row_to_json(bucket_rows) order by bucket_rows.bytes desc), '[]'::jsonb)
      from (
        select
          objects.bucket_id as bucket,
          count(*) as files,
          coalesce(sum((objects.metadata ->> 'size')::bigint), 0) as bytes
        from storage.objects
        group by objects.bucket_id
      ) as bucket_rows
    ),
    'uploads_by_day', (
      select coalesce(jsonb_agg(row_to_json(day_rows) order by day_rows.day), '[]'::jsonb)
      from (
        select
          to_char(date_trunc('day', objects.created_at at time zone 'utc'), 'YYYY-MM-DD') as day,
          count(*) as files,
          coalesce(sum((objects.metadata ->> 'size')::bigint), 0) as bytes
        from storage.objects
        where objects.created_at > now() - interval '30 days'
        group by 1
      ) as day_rows
    ),
    'downloads_this_month', (
      select jsonb_build_object('downloads', count(*), 'bytes', coalesce(sum(downloads.bytes), 0))
      from public.delivery_file_downloads as downloads
      where downloads.downloaded_at >= month_start
    ),
    'downloads_by_day', (
      select coalesce(jsonb_agg(row_to_json(day_rows) order by day_rows.day), '[]'::jsonb)
      from (
        select
          to_char(date_trunc('day', downloads.downloaded_at at time zone 'utc'), 'YYYY-MM-DD') as day,
          count(*) as downloads,
          coalesce(sum(downloads.bytes), 0) as bytes
        from public.delivery_file_downloads as downloads
        where downloads.downloaded_at > now() - interval '30 days'
        group by 1
      ) as day_rows
    ),
    'largest_commissions', (
      select coalesce(jsonb_agg(row_to_json(top_rows) order by top_rows.bytes desc), '[]'::jsonb)
      from (
        select
          agreement.listing_request_id,
          count(*) as files,
          coalesce(sum((objects.metadata ->> 'size')::bigint), 0) as bytes
        from storage.objects
        inner join public.listing_request_agreements as agreement
          on objects.name like agreement.id::text || '/%'
        where objects.bucket_id = 'delivery-files'
        group by agreement.listing_request_id
        order by 3 desc
        limit 10
      ) as top_rows
    ),
    'plans', (
      select coalesce(jsonb_agg(row_to_json(plan_rows) order by plan_rows.commission_limit_bytes), '[]'::jsonb)
      from (
        select
          plan.code,
          plan.label,
          plan.commission_limit_bytes,
          plan.is_default,
          (
            select count(distinct grant_row.creator_user_id)
            from public.creator_storage_plan_grants as grant_row
            where grant_row.plan_code = plan.code
              and grant_row.starts_at <= now()
              and (grant_row.ends_at is null or grant_row.ends_at > now())
          ) as active_creators
        from public.commission_storage_plans as plan
      ) as plan_rows
    )
  );
end;
$$;

revoke all on function public.admin_get_storage_overview() from public, anon;
grant execute on function public.admin_get_storage_overview() to authenticated;

-- 7. list_ops_alerts(), as last defined in 20261012_157, with OPS-008 added
-- at the end.

create or replace function public.list_ops_alerts()
returns table (
  alert_id text,
  playbook_issue text,
  subject_id text,
  observed_at timestamptz,
  detail jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  -- PAY-005. Checkout sessions expire after 24 hours, so a session still
  -- open after 25 means the expiry (or payment) webhook never landed.
  -- 'processing' is a delayed payment method and is only raised after 7
  -- days. Younger stuck payments are the agent's 30-minute signal, not an
  -- email.
  select
    'stuck_payment'::text,
    'PAY-005'::text,
    p.id::text,
    p.updated_at,
    jsonb_build_object(
      'status', p.status,
      'currency', p.currency,
      'total_checkout_cents', p.total_checkout_cents,
      'listing_request_id', p.listing_request_id
    )
  from public.listing_request_payments p
  where (p.status = 'checkout_opened' and p.updated_at < now() - interval '25 hours')
     or (p.status = 'processing' and p.updated_at < now() - interval '7 days')

  union all

  -- CHG-003. An accepted price-increasing change order should have a
  -- schedule item (create_listing_request_change_order_payment) and that
  -- item a payment (create_listing_request_payment_when_schedule_item_required).
  select
    'change_order_payment_missing',
    'CHG-003',
    co.id::text,
    co.buyer_accepted_at,
    jsonb_build_object(
      'listing_request_id', co.listing_request_id,
      'price_delta', co.price_delta,
      'revised_total_amount', co.revised_total_amount,
      'has_schedule_item', exists (
        select 1 from public.listing_request_payment_schedule_items si
        where si.change_order_id = co.id
      )
    )
  from public.listing_request_change_orders co
  where co.status = 'buyer_accepted'
    and co.changes_price
    and co.price_delta > 0
    and coalesce(co.buyer_accepted_at, co.updated_at) < now() - interval '15 minutes'
    and not exists (
      select 1
      from public.listing_request_payment_schedule_items si
      join public.listing_request_payments p
        on p.payment_schedule_item_id = si.id
      where si.change_order_id = co.id
    )

  union all

  -- REQ-003 (Sprint 6's staleness query).
  select
    'stale_request',
    'REQ-003',
    s.listing_request_id::text,
    s.last_activity_at,
    jsonb_build_object(
      'days_since_activity', s.days_since_activity,
      'has_open_notice', s.has_open_notice
    )
  from public.admin_list_stale_listing_requests(14) s

  union all

  -- TAX-002.
  select
    'tax_evidence_insufficient',
    'TAX-002',
    p.id::text,
    p.paid_at,
    jsonb_build_object(
      'evidence_status', e.evidence_status,
      'tax_jurisdiction_country', p.tax_jurisdiction_country,
      'conflicting_country', e.conflicting_country
    )
  from public.listing_request_payments p
  cross join lateral public.get_listing_request_payment_tax_evidence_status(p.id) e
  where p.tax_treatment = 'calculated'
    and p.status in ('paid', 'partially_refunded', 'refunded')
    and e.evidence_status <> 'sufficient'

  union all

  -- TAX-003.
  select
    'tax_transaction_missing',
    'TAX-003',
    p.id::text,
    p.paid_at,
    jsonb_build_object('stripe_tax_calculation_id', p.stripe_tax_calculation_id)
  from public.listing_request_payments p
  where p.tax_treatment = 'calculated'
    and p.status in ('paid', 'partially_refunded', 'refunded')
    and p.stripe_tax_transaction_id is null
    and p.paid_at < now() - interval '1 hour'

  union all

  -- TAX-004. The reversal is created right after the refund; an hour's
  -- grace keeps an in-flight refund out of the alert.
  select
    'tax_reversal_missing',
    'TAX-004',
    r.id::text,
    r.created_at,
    jsonb_build_object(
      'payment_id', r.payment_id,
      'stripe_refund_id', r.stripe_refund_id,
      'tax_refund_cents', r.tax_refund_cents
    )
  from public.listing_request_payment_refunds r
  where r.tax_refund_cents > 0
    and r.stripe_tax_reversal_id is null
    and r.created_at < now() - interval '1 hour'

  union all

  -- TAX-007. Wave 2 currencies are enabled while the tax advice is open.
  select
    'paid_wave2_currency',
    'TAX-007',
    p.id::text,
    p.paid_at,
    jsonb_build_object('currency', p.currency, 'status', p.status)
  from public.listing_request_payments p
  where p.currency not in ('cad', 'usd')
    and p.paid_at is not null

  union all

  -- CON-003. Stripe restricted an account that still has live listings.
  select
    'payment_account_lost_readiness',
    'CON-003',
    a.user_id::text,
    a.readiness_lost_at,
    jsonb_build_object(
      'stripe_account_id', a.stripe_account_id,
      'charges_enabled', a.charges_enabled,
      'payouts_enabled', a.payouts_enabled,
      'details_submitted', a.details_submitted,
      'requirements_due_count', a.requirements_due_count,
      'requirements_past_due_count', a.requirements_past_due_count,
      'active_listing_count', (
        select count(*) from public.listings l
        where l.user_id = a.user_id and l.status = 'published' and l.is_active
      )
    )
  from public.creator_payment_accounts a
  where a.readiness_lost_at is not null
    and not (a.charges_enabled and a.payouts_enabled and a.details_submitted)
    and exists (
      select 1 from public.listings l
      where l.user_id = a.user_id and l.status = 'published' and l.is_active
    )

  union all

  -- CON-006. The hourly resync refreshes anything older than 6 hours, so a
  -- mirror 48 hours old means the resync is not running or is failing.
  select
    'payment_account_mirror_stale',
    'CON-006',
    a.user_id::text,
    a.last_synced_at,
    jsonb_build_object('stripe_account_id', a.stripe_account_id)
  from public.creator_payment_accounts a
  where a.last_synced_at is null
     or a.last_synced_at < now() - interval '48 hours'

  union all

  -- OPS-006. Yesterday's failed actions and failed page loads (UTC day),
  -- one row per distinct failure with how often it happened. The subject
  -- carries the day, so each is emailed once, in the first run after
  -- midnight UTC, and drops out a day later. Capped at the 40 most frequent
  -- so a flood of made-up messages cannot bury the digest.
  select
    'app_failure_summary',
    'OPS-006',
    summary.subject_id,
    summary.last_seen_at,
    summary.detail
  from (
    select
      to_char(date_trunc('day', now()) - interval '1 day', 'YYYY-MM-DD') || ':'
        || md5(f.source || '|' || coalesce(f.route, '') || '|' || coalesce(f.code, '') || '|' || f.signature)
        as subject_id,
      max(f.occurred_at) as last_seen_at,
      jsonb_build_object(
        'day', to_char(date_trunc('day', now()) - interval '1 day', 'YYYY-MM-DD'),
        'source', f.source,
        'route', f.route,
        'code', f.code,
        'message', min(f.message),
        'occurrences', count(*),
        'accounts', count(distinct f.user_id),
        'signed_out', count(*) filter (where f.user_id is null)
      ) as detail
    from public.app_failure_events f
    where f.occurred_at >= date_trunc('day', now()) - interval '1 day'
      and f.occurred_at < date_trunc('day', now())
    group by f.source, f.route, f.code, f.signature
    order by count(*) desc
    limit 40
  ) as summary

  union all

  -- OPS-007. One account (or everyone signed out, taken together) failing
  -- 25 times or more within an hour: a broken screen, or someone probing.
  select
    'app_failure_burst',
    'OPS-007',
    coalesce(f.user_id::text, 'signed-out'),
    max(f.occurred_at),
    jsonb_build_object(
      'user_id', f.user_id,
      'occurrences', count(*),
      'distinct_failures', count(distinct f.signature),
      'most_common', mode() within group (order by f.message)
    )
  from public.app_failure_events f
  where f.occurred_at > now() - interval '1 hour'
  group by f.user_id
  having count(*) >= 25

  union all

  -- OPS-008. Stored files, or this month's delivery downloads (as logged by
  -- record_delivery_file_download), passing a share of what the Supabase
  -- Pro plan includes (100 GB stored, 250 GB downloaded a month) or a
  -- larger mark. Each mark is emailed once: the stored ones once ever, the
  -- download ones once a month.
  select
    'storage_usage_high',
    'OPS-008',
    marks.subject_id,
    now(),
    jsonb_build_object(
      'kind', marks.kind,
      'threshold_bytes', marks.threshold_bytes,
      'used_bytes', marks.used_bytes,
      'included_bytes', marks.included_bytes
    )
  from (
    select
      'stored:' || stored_marks.label as subject_id,
      'stored' as kind,
      stored_marks.threshold_bytes,
      107374182400::bigint as included_bytes,
      (
        select coalesce(sum((objects.metadata ->> 'size')::bigint), 0)
        from storage.objects
      ) as used_bytes
    from (
      values
        ('80GB', 85899345920::bigint),
        ('500GB', 536870912000::bigint),
        ('2TB', 2199023255552::bigint)
    ) as stored_marks (label, threshold_bytes)

    union all

    select
      'downloads:' || to_char(now() at time zone 'utc', 'YYYY-MM') || ':' || download_marks.label,
      'downloads',
      download_marks.threshold_bytes,
      268435456000::bigint,
      (
        select coalesce(sum(downloads.bytes), 0)
        from public.delivery_file_downloads as downloads
        where downloads.downloaded_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'
      )
    from (
      values
        ('200GB', 214748364800::bigint),
        ('1TB', 1099511627776::bigint)
    ) as download_marks (label, threshold_bytes)
  ) as marks
  where marks.used_bytes >= marks.threshold_bytes;
$$;

revoke all on function public.list_ops_alerts() from public, anon, authenticated;
grant execute on function public.list_ops_alerts() to service_role;
