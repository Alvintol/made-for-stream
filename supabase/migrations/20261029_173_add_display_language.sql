-- The language a person chose for the site (decided 2026-10-29: French is
-- the second language, translated in the site's own code).
--
-- Kept beside the display currency in user_display_preferences, private to
-- the person like the rest of that row. Null means "follow my browser". The
-- list matches src/lib/i18n/languages.ts.
--
-- Nothing reads it yet outside the website. Emails stay in English until they
-- are translated too.
-- Playbook: docs/support/site/languages.md (LANG-001).

alter table public.user_display_preferences
  add column if not exists language text check (language in ('en', 'fr'));

comment on column public.user_display_preferences.language is
  'The language the person chose for the site (en or fr). Null means follow the browser.';
