-- Approving a milestone confirms that its work sent off site arrived
-- (decided 2026-10-28).
--
-- Until now a milestone's off-site receipt (20261016_166) stayed open after
-- the buyer approved the milestone and paid for it, so the buyer was still
-- reminded on days 3 and 7, the ops email listed it from day 10 (MIL-008),
-- and the final delivery could not be approved until the buyer pressed
-- "I received it" as well. Approving is the buyer saying the work is right,
-- so it now closes the receipt as received: also after an earlier "It hasn't
-- arrived". The chat says the approval confirmed it. No extra email: the
-- creator already gets the milestone approval email.
--
-- A final delivery is unchanged: the buyer still confirms receipt before
-- approving it, because approval completes the commission.
--
-- No milestone receipt existed when this was written, so nothing is
-- backfilled.

create or replace function public.confirm_off_site_receipt_on_milestone_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt public.off_site_delivery_receipts%rowtype;
  target_conversation_id uuid;
begin
  if new.status <> 'buyer_approved' or old.status is not distinct from 'buyer_approved' then
    return new;
  end if;

  update public.off_site_delivery_receipts
  set
    status = 'received',
    answered_at = now(),
    answered_by = new.buyer_user_id
  where off_site_delivery_receipts.milestone_submission_id = new.id
    and off_site_delivery_receipts.status <> 'received'
  returning * into receipt;

  if not found then
    return new;
  end if;

  target_conversation_id := public.commission_conversation_id(receipt.listing_request_id);

  if target_conversation_id is not null then
    insert into public.conversation_messages (conversation_id, sender_user_id, message_type, body)
    values (
      target_conversation_id,
      receipt.buyer_user_id,
      'system',
      format(
        'The buyer approved %s, which confirms that the work sent outside Made for Stream arrived.',
        receipt.subject
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.confirm_off_site_receipt_on_milestone_approval() from public, anon, authenticated;

-- Named to run after the existing status triggers, so this chat line follows
-- theirs.
drop trigger if exists listing_request_milestone_submissions_receipt_on_approval
  on public.listing_request_milestone_submissions;

create trigger listing_request_milestone_submissions_receipt_on_approval
  after update of status on public.listing_request_milestone_submissions
  for each row
  execute function public.confirm_off_site_receipt_on_milestone_approval();
