-- Work-sample links are shown as clickable links to administrators reviewing
-- a creator application. Until now only the applicant's browser checked that a
-- link was an ordinary web address; the "insert own editable" policy lets a
-- signed-in applicant write the row directly, so anything could be stored.
--
-- Require an http(s) address with no spaces and no "user@" part in front of
-- the host (https://youtube.com@evil.example goes to evil.example). The admin
-- page checks again when it renders (src/domain/links/externalLinks.ts).
--
-- Checked against the live table 2026-10-05: all 10 rows already comply.
-- Playbook: docs/support/creators/applications.md (APP-005).
alter table public.seller_application_samples
  drop constraint if exists seller_application_samples_url_is_web_link;

alter table public.seller_application_samples
  add constraint seller_application_samples_url_is_web_link
  check (
    url is null
    or (
      char_length(url) <= 2000
      and url ~* '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$'
    )
  );
