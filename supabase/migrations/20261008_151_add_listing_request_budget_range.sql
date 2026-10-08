-- =====================================================================
-- 20261008_151: a commission request's budget can be a range
--
-- A buyer may type "100-150" as their budget. budget_amount stays the
-- single figure, or the bottom of the range; budget_amount_max is the top
-- of the range and is empty for a single figure. Both are in the listing's
-- currency, like budget_amount always was.
--
-- Apply BEFORE the website that reads the new column is merged.
-- Playbook: docs/support/requests/request-lifecycle.md.
-- =====================================================================

alter table public.listing_requests
  add column if not exists budget_amount_max numeric(12, 2);

comment on column public.listing_requests.budget_amount_max is
  'Top of the buyer''s budget range, in the listing''s currency. Null when the budget is a single figure (budget_amount) or was not given.';

alter table public.listing_requests
  drop constraint if exists listing_requests_budget_amount_max_check;

alter table public.listing_requests
  add constraint listing_requests_budget_amount_max_check
  check (
    budget_amount_max is null
    or (
      budget_amount is not null
      and budget_amount_max > budget_amount
      and budget_amount_max <= 999999.99
    )
  );
