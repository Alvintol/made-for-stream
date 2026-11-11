-- Added 2026-11-11 so the chain replays on an empty database (prod).
--
-- protect_listing_request_completion and its trigger were made by hand on dev
-- (20260922_119 notes the drift), so no migration created them, and 119
-- revokes grants on the function. This creates both as dev had them before
-- 20261103_182, which later adds the instant-purchase branch to the function.
-- Never apply it to dev by hand: dev already has both, and this older version
-- of the function would undo 182's instant-purchase branch until 182 ran again.

create or replace function public.protect_listing_request_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'completed' then
    if new.status is distinct from old.status
      or new.completed_at is distinct from old.completed_at
      or new.completed_by_user_id
        is distinct from old.completed_by_user_id then
      raise exception
        'A completed listing request cannot be reopened or have its completion metadata changed.'
        using errcode = 'P0001';
    end if;

    return new;
  end if;

  if new.status = 'completed' then
    if old.status <> 'accepted' then
      raise exception
        'Only an accepted listing request can be completed.'
        using errcode = 'P0001';
    end if;

    if auth.uid() is null
      or auth.uid() <> new.buyer_user_id then
      raise exception
        'Only the buyer can complete this listing request through final-delivery approval.'
        using errcode = '42501';
    end if;

    if not exists (
      select 1
      from public.listing_request_final_deliveries
      where listing_request_final_deliveries.listing_request_id =
          new.id
        and listing_request_final_deliveries.agreement_id
          is not null
        and listing_request_final_deliveries.buyer_user_id =
          new.buyer_user_id
        and listing_request_final_deliveries.status =
          'buyer_approved'
        and listing_request_final_deliveries.buyer_approved_at
          is not null
    ) then
      raise exception
        'An approved final delivery is required before completing this listing request.'
        using errcode = 'P0001';
    end if;

    new.completed_at :=
      coalesce(new.completed_at, now());

    new.completed_by_user_id :=
      coalesce(
        new.completed_by_user_id,
        auth.uid()
      );

    return new;
  end if;

  new.completed_at := null;
  new.completed_by_user_id := null;

  return new;
end;
$$;

drop trigger if exists listing_requests_protect_completion on public.listing_requests;

create trigger listing_requests_protect_completion
before update of status, completed_at, completed_by_user_id on public.listing_requests
for each row execute function public.protect_listing_request_completion();
