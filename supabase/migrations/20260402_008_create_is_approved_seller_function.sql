-- Helper for RLS and future SQL logic
create
or replace function public.is_approved_seller(_user_id uuid) returns boolean language sql stable as $$
select
  exists (
    select
      1
    from
      public.seller_applications sa
    where
      sa.profile_user_id = _user_id
      and sa.status = 'approved'
  );

$$;