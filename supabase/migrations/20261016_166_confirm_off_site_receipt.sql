-- When work is sent outside Made for Stream, the buyer confirms in the
-- commission that it arrived, and the commission cannot be completed until
-- they have (decided 2026-10-16).
--
-- 1. public.off_site_delivery_receipts: one row for each milestone
--    submission or final delivery the creator marked "Provided off site"
--    (20261013_162), waiting for the buyer's answer: received, or not
--    received. Read by the commission's buyer, creator and administrators;
--    written only by the functions below.
-- 2. log_off_site_delivery_message() (the trigger that writes the "sent
--    outside Made for Stream" chat line) now also opens the receipt and
--    emails the buyer to confirm (off_site_receipt_requested). The one
--    submission already marked this way is given its receipt here.
-- 3. respond_off_site_delivery_receipt: the buyer answers. Either answer is
--    written into the chat; "not received" emails the creator at once
--    (off_site_receipt_missing), "received" emails them too
--    (off_site_receipt_confirmed). A buyer who said "not received" can
--    confirm later; "received" is final.
-- 4. admin_record_off_site_receipt: an administrator records the work as
--    received, with a note saying how that was established (for example
--    the buyer confirmed it to support). Also written into the chat.
-- 5. A final delivery cannot be approved, so the commission cannot be
--    completed, while any receipt on it is unanswered or "not received",
--    leaving out receipts of earlier final deliveries that were replaced.
-- 6. enqueue_off_site_receipt_reminders(), run hourly by the API: reminds the
--    buyer 3 and 7 days after the work was sent (off_site_receipt_reminder).
-- 7. list_ops_alerts() gains MIL-008: a receipt still not confirmed 10 days
--    after the work was sent, on an active commission.

create table if not exists public.off_site_delivery_receipts (
  id uuid primary key default gen_random_uuid(),
  listing_request_id uuid not null references public.listing_requests (id) on delete cascade,
  milestone_submission_id uuid unique references public.listing_request_milestone_submissions (id) on delete cascade,
  final_delivery_id uuid unique references public.listing_request_final_deliveries (id) on delete cascade,
  creator_user_id uuid not null,
  buyer_user_id uuid not null,
  -- "milestone 2 (coloured)" or "the final delivery (Final files)".
  subject text not null,
  methods text[] not null default '{}'::text[],
  other text,
  status text not null default 'awaiting'
    check (status in ('awaiting', 'received', 'not_received')),
  sent_at timestamptz not null default now(),
  answered_at timestamptz,
  answered_by uuid,
  admin_note text check (admin_note is null or char_length(admin_note) between 10 and 500),
  created_at timestamptz not null default now(),
  check (num_nonnulls(milestone_submission_id, final_delivery_id) = 1)
);

create index if not exists off_site_delivery_receipts_request_idx
  on public.off_site_delivery_receipts (listing_request_id);

alter table public.off_site_delivery_receipts enable row level security;

drop policy if exists "commission participants read off-site receipts" on public.off_site_delivery_receipts;
create policy "commission participants read off-site receipts" on public.off_site_delivery_receipts
  for select to authenticated
  using (
    buyer_user_id = auth.uid()
    or creator_user_id = auth.uid()
    or public.is_admin_user(auth.uid())
  );

revoke insert, update, delete, truncate on public.off_site_delivery_receipts from anon, authenticated;

-- The commission's chat, if it has one.
create or replace function public.commission_conversation_id(p_listing_request_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select conversations.id
  from public.conversations
  where conversations.listing_request_id = p_listing_request_id
  limit 1;
$$;

revoke all on function public.commission_conversation_id(uuid) from public, anon, authenticated;

-- 2. As in 20261013_162, plus the receipt and the email to the buyer.
create or replace function public.log_off_site_delivery_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data jsonb := to_jsonb(new);
  subject text;
  methods_text text;
  target_conversation_id uuid;
begin
  if new.status <> 'submitted'
    or cardinality(new.off_site_delivery_methods) = 0 then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'submitted'
    and cardinality(old.off_site_delivery_methods) > 0 then
    return new;
  end if;

  if tg_table_name = 'listing_request_milestone_submissions' then
    select format(
      'milestone %s (%s)',
      milestone.sort_order + 1,
      milestone.title
    )
    into subject
    from public.listing_request_milestones as milestone
    where milestone.id = (row_data ->> 'milestone_id')::uuid;
  else
    subject := format('the final delivery (%s)', row_data ->> 'title');
  end if;

  subject := coalesce(subject, 'this commission');

  select string_agg(
    case sent.method
      when 'email' then 'email'
      when 'discord' then 'Discord'
      when 'text_message' then 'text message'
      else format('another way (%s)', new.off_site_delivery_other)
    end,
    ', '
    order by sent.position
  )
  into methods_text
  from unnest(new.off_site_delivery_methods)
    with ordinality as sent(method, position);

  target_conversation_id := public.commission_conversation_id(new.listing_request_id);

  if target_conversation_id is not null then
    insert into public.conversation_messages (
      conversation_id,
      sender_user_id,
      message_type,
      body
    )
    values (
      target_conversation_id,
      new.creator_user_id,
      'system',
      format(
        'The creator reports that the work for %s was also sent outside Made for Stream, by: %s. Made for Stream has no copy of what was sent and cannot confirm that it arrived.',
        subject,
        methods_text
      )
    );
  end if;

  insert into public.off_site_delivery_receipts (
    listing_request_id,
    milestone_submission_id,
    final_delivery_id,
    creator_user_id,
    buyer_user_id,
    subject,
    methods,
    other
  )
  values (
    new.listing_request_id,
    case when tg_table_name = 'listing_request_milestone_submissions' then new.id end,
    case when tg_table_name = 'listing_request_final_deliveries' then new.id end,
    new.creator_user_id,
    new.buyer_user_id,
    subject,
    new.off_site_delivery_methods,
    new.off_site_delivery_other
  )
  on conflict do nothing;

  perform public.enqueue_listing_request_notification(
    new.listing_request_id, new.buyer_user_id, 'off_site_receipt_requested',
    'off_site_receipt_requested:' || new.id,
    jsonb_build_object('subject', subject, 'methods', methods_text)
  );

  return new;
end;
$$;

-- The one submission marked "Provided off site" before this migration gets
-- its receipt, and its buyer the email.
insert into public.off_site_delivery_receipts (
  listing_request_id, final_delivery_id, creator_user_id, buyer_user_id,
  subject, methods, other, sent_at
)
select
  delivery.listing_request_id,
  delivery.id,
  delivery.creator_user_id,
  delivery.buyer_user_id,
  format('the final delivery (%s)', delivery.title),
  delivery.off_site_delivery_methods,
  delivery.off_site_delivery_other,
  coalesce(delivery.submitted_at, now())
from public.listing_request_final_deliveries as delivery
where delivery.status = 'submitted'
  and cardinality(delivery.off_site_delivery_methods) > 0
on conflict do nothing;

insert into public.off_site_delivery_receipts (
  listing_request_id, milestone_submission_id, creator_user_id, buyer_user_id,
  subject, methods, other, sent_at
)
select
  submission.listing_request_id,
  submission.id,
  submission.creator_user_id,
  submission.buyer_user_id,
  format('milestone %s (%s)', milestone.sort_order + 1, milestone.title),
  submission.off_site_delivery_methods,
  submission.off_site_delivery_other,
  submission.submitted_at
from public.listing_request_milestone_submissions as submission
inner join public.listing_request_milestones as milestone
  on milestone.id = submission.milestone_id
where cardinality(submission.off_site_delivery_methods) > 0
on conflict do nothing;

select public.enqueue_listing_request_notification(
  receipt.listing_request_id, receipt.buyer_user_id, 'off_site_receipt_requested',
  'off_site_receipt_requested:' || coalesce(receipt.final_delivery_id, receipt.milestone_submission_id),
  jsonb_build_object('subject', receipt.subject)
)
from public.off_site_delivery_receipts as receipt
where receipt.status = 'awaiting';

-- 3. The buyer answers.
create or replace function public.respond_off_site_delivery_receipt(
  p_receipt_id uuid,
  p_received boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt public.off_site_delivery_receipts%rowtype;
  target_conversation_id uuid;
begin
  select *
  into receipt
  from public.off_site_delivery_receipts
  where off_site_delivery_receipts.id = p_receipt_id
  for update;

  if not found or receipt.buyer_user_id is distinct from auth.uid() then
    raise exception 'Only the buyer of this commission can confirm whether the work arrived.'
      using errcode = '42501';
  end if;

  if receipt.status = 'received' then
    raise exception 'You have already confirmed receiving this work.'
      using errcode = 'P0001';
  end if;

  if not p_received and receipt.status = 'not_received' then
    raise exception 'You have already said this work has not arrived. Confirm here once it does.'
      using errcode = 'P0001';
  end if;

  update public.off_site_delivery_receipts
  set
    status = case when p_received then 'received' else 'not_received' end,
    answered_at = now(),
    answered_by = auth.uid()
  where off_site_delivery_receipts.id = receipt.id;

  target_conversation_id := public.commission_conversation_id(receipt.listing_request_id);

  if target_conversation_id is not null then
    insert into public.conversation_messages (conversation_id, sender_user_id, message_type, body)
    values (
      target_conversation_id,
      receipt.buyer_user_id,
      'system',
      case
        when p_received then format(
          'The buyer confirmed receiving the work for %s that was sent outside Made for Stream.',
          receipt.subject
        )
        else format(
          'The buyer says the work for %s, sent outside Made for Stream, has not arrived.',
          receipt.subject
        )
      end
    );
  end if;

  if p_received then
    perform public.enqueue_listing_request_notification(
      receipt.listing_request_id, receipt.creator_user_id, 'off_site_receipt_confirmed',
      'off_site_receipt_confirmed:' || receipt.id,
      jsonb_build_object('subject', receipt.subject)
    );
  else
    perform public.enqueue_listing_request_notification(
      receipt.listing_request_id, receipt.creator_user_id, 'off_site_receipt_missing',
      'off_site_receipt_missing:' || receipt.id,
      jsonb_build_object('subject', receipt.subject)
    );
  end if;
end;
$$;

revoke all on function public.respond_off_site_delivery_receipt(uuid, boolean) from public, anon;
grant execute on function public.respond_off_site_delivery_receipt(uuid, boolean) to authenticated;

-- 4. An administrator records the work as received.
create or replace function public.admin_record_off_site_receipt(
  p_receipt_id uuid,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt public.off_site_delivery_receipts%rowtype;
  clean_note text := btrim(coalesce(p_note, ''));
  target_conversation_id uuid;
begin
  if auth.uid() is null or not public.is_admin_user(auth.uid()) then
    raise exception 'Only an administrator can record off-site work as received.'
      using errcode = '42501';
  end if;

  if char_length(clean_note) not between 10 and 500 then
    raise exception 'Say how the receipt was confirmed, in 10 to 500 characters.'
      using errcode = '22023';
  end if;

  select *
  into receipt
  from public.off_site_delivery_receipts
  where off_site_delivery_receipts.id = p_receipt_id
  for update;

  if not found then
    raise exception 'This off-site delivery record could not be found.'
      using errcode = 'P0001';
  end if;

  if receipt.status = 'received' then
    raise exception 'This work is already recorded as received.'
      using errcode = 'P0001';
  end if;

  update public.off_site_delivery_receipts
  set
    status = 'received',
    answered_at = now(),
    answered_by = auth.uid(),
    admin_note = clean_note
  where off_site_delivery_receipts.id = receipt.id;

  target_conversation_id := public.commission_conversation_id(receipt.listing_request_id);

  if target_conversation_id is not null then
    insert into public.conversation_messages (conversation_id, sender_user_id, message_type, body)
    values (
      target_conversation_id,
      auth.uid(),
      'system',
      format(
        'Made for Stream recorded the work for %s as received. Note: %s',
        receipt.subject,
        clean_note
      )
    );
  end if;

  perform public.enqueue_listing_request_notification(
    receipt.listing_request_id, receipt.creator_user_id, 'off_site_receipt_confirmed',
    'off_site_receipt_confirmed:' || receipt.id,
    jsonb_build_object('subject', receipt.subject, 'recorded_by_admin', true)
  );
end;
$$;

revoke all on function public.admin_record_off_site_receipt(uuid, text) from public, anon;
grant execute on function public.admin_record_off_site_receipt(uuid, text) to authenticated;

-- 5. No approval, so no completion, while work sent off site is unconfirmed.
create or replace function public.require_off_site_receipts_before_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'buyer_approved'
    and old.status is distinct from 'buyer_approved'
    and exists (
      select 1
      from public.off_site_delivery_receipts as receipt
      where receipt.listing_request_id = new.listing_request_id
        and receipt.status <> 'received'
        and (receipt.final_delivery_id is null or receipt.final_delivery_id = new.id)
    ) then
    raise exception 'Confirm in the chat that you received the work sent outside Made for Stream before approving the final delivery.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.require_off_site_receipts_before_approval() from public, anon, authenticated;

drop trigger if exists listing_request_final_deliveries_require_off_site_receipts
  on public.listing_request_final_deliveries;

create trigger listing_request_final_deliveries_require_off_site_receipts
  before update of status on public.listing_request_final_deliveries
  for each row
  execute function public.require_off_site_receipts_before_approval();

-- 6. Reminders to the buyer, 3 and 7 days after the work was sent. The
-- dedupe key carries the step, so each is queued once.
create or replace function public.enqueue_off_site_receipt_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  queued integer := 0;
  receipt record;
begin
  for receipt in
    select
      r.id,
      r.listing_request_id,
      r.buyer_user_id,
      r.subject,
      floor(extract(epoch from (now() - r.sent_at)) / 86400)::integer as waiting_days
    from public.off_site_delivery_receipts as r
    inner join public.listing_requests as request
      on request.id = r.listing_request_id
      and request.status = 'accepted'
    where r.status = 'awaiting'
      and r.sent_at <= now() - interval '3 days'
  loop
    perform public.enqueue_listing_request_notification(
      receipt.listing_request_id, receipt.buyer_user_id, 'off_site_receipt_reminder',
      'off_site_receipt_reminder:' || receipt.id || ':'
        || case when receipt.waiting_days >= 7 then '7' else '3' end,
      jsonb_build_object('subject', receipt.subject, 'waiting_days', receipt.waiting_days)
    );
    queued := queued + 1;
  end loop;

  return queued;
end;
$$;

revoke all on function public.enqueue_off_site_receipt_reminders() from public, anon, authenticated;
grant execute on function public.enqueue_off_site_receipt_reminders() to service_role;

-- 7. list_ops_alerts(), as last defined in 20261016_164, with MIL-008 added
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
  where marks.used_bytes >= marks.threshold_bytes

  union all

  -- MIL-008. Work sent outside Made for Stream that the buyer has still not
  -- confirmed 10 days after it was sent, on an active commission. Receipts
  -- of a final delivery that was replaced do not count.
  select
    'off_site_receipt_overdue',
    'MIL-008',
    receipt.id::text,
    receipt.sent_at,
    jsonb_build_object(
      'listing_request_id', receipt.listing_request_id,
      'subject', receipt.subject,
      'status', receipt.status,
      'waiting_days', floor(extract(epoch from (now() - receipt.sent_at)) / 86400)::integer
    )
  from public.off_site_delivery_receipts as receipt
  inner join public.listing_requests as request
    on request.id = receipt.listing_request_id
    and request.status = 'accepted'
  left join public.listing_request_final_deliveries as delivery
    on delivery.id = receipt.final_delivery_id
  where receipt.status <> 'received'
    and receipt.sent_at < now() - interval '10 days'
    and (receipt.final_delivery_id is null or delivery.status = 'submitted');
$$;

revoke all on function public.list_ops_alerts() from public, anon, authenticated;
grant execute on function public.list_ops_alerts() to service_role;
