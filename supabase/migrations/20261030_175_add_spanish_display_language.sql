-- Spanish as a site language (decided 2026-10-30, for the North American
-- beta: Spanish speakers in the United States).
--
-- The check on the saved language has to allow it before anyone can choose
-- it. The list matches src/lib/i18n/languages.ts. Spanish stays hidden from
-- the public until it is marked ready there.
-- Playbook: docs/support/site/languages.md (LANG-001).

alter table public.user_display_preferences
  drop constraint if exists user_display_preferences_language_check;

alter table public.user_display_preferences
  add constraint user_display_preferences_language_check
  check (language in ('en', 'fr', 'es'));

comment on column public.user_display_preferences.language is
  'The language the person chose for the site (en, fr or es). Null means follow the browser.';
