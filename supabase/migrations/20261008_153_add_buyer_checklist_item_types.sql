-- =====================================================================
-- 20261008_153: scope checklist lines can say who they are for
--
-- A line on an agreement's scope checklist was always saved as an
-- "included" item, whatever it said. Two more kinds let the creator mark
-- what the buyer has to do, so the agreement can show it beside the line:
--
--   buyer_provides   something the buyer must send (references, logins)
--   buyer_approves   something the buyer must approve (sketches, a draft)
--
-- Neither carries a price. create_listing_request_agreement() already
-- passes item_type through unchanged, and only treats 'milestone'
-- specially, so no function changes.
--
-- Apply BEFORE the website that offers the two new kinds is merged.
-- Playbook: docs/support/requests/agreements.md.
-- =====================================================================

alter table public.listing_request_agreement_items
  drop constraint if exists listing_request_agreement_items_item_type_check;

alter table public.listing_request_agreement_items
  add constraint listing_request_agreement_items_item_type_check
  check (
    item_type = any (
      array[
        'included'::text,
        'optional_addon'::text,
        'required_payment_item'::text,
        'milestone'::text,
        'buyer_provides'::text,
        'buyer_approves'::text
      ]
    )
  );
