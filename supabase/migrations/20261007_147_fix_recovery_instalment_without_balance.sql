-- Rehearsal finding, 2026-10-07 (REC-005).
--
-- resolve_listing_request_payment_recovery_instalment (20260922_129) was
-- meant to return zero for a creator with no recovery balance. It did not:
-- Postgres's least() ignores NULL arguments, so with no row in
-- creator_recovery_balances it returned the 50% cap itself. Every payment
-- for every creator therefore had half its base folded into
-- application_fee_cents. Found by a rolled-back dry run before any payment
-- was taken with it; no stored row carries a wrong instalment.
--
-- The fix: resolve the outstanding amount to zero first, then cap.
create or replace function public.resolve_listing_request_payment_recovery_instalment(
  p_creator_user_id uuid,
  p_base_amount_cents integer
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select least(
    floor(p_base_amount_cents * 0.5)::integer,
    greatest(
      coalesce(
        (
          select outstanding_cents
          from public.creator_recovery_balances
          where creator_user_id = p_creator_user_id
        ),
        0
      ),
      0
    )
  );
$$;

revoke execute on function public.resolve_listing_request_payment_recovery_instalment(uuid, integer)
  from public, anon, authenticated;

-- Self-check: a creator with no balance row has nothing diverted.
do $$
begin
  if public.resolve_listing_request_payment_recovery_instalment(
       '00000000-0000-0000-0000-000000000000'::uuid, 4000
     ) <> 0
  then
    raise exception
      'REC-005: a creator with no recovery balance must have a zero recovery instalment.';
  end if;
end;
$$;

-- Any payment still waiting for checkout that was created with the wrong
-- instalment is corrected here; recompute only touches unpaid rows.
do $$
declare
  payment_id_value uuid;
begin
  for payment_id_value in
    select id
    from public.listing_request_payments
    where status in ('requires_checkout', 'checkout_opened')
      and recovery_instalment_cents > 0
  loop
    perform public.recompute_listing_request_payment_amounts(payment_id_value);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
