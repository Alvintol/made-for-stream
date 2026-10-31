-- The language a person's browser last showed the site in (2026-10-31), so
-- emails can follow it.
--
-- Most people never choose a language: the site follows their browser, and
-- `language` stays null. The API cannot see a browser, so without this a
-- Spanish reader would get English email. The site writes it (LanguageSync)
-- only when it differs from what is saved and the person has not chosen a
-- language. Null means English, so English readers are never written.
-- The list matches src/lib/i18n/languages.ts.
-- Playbook: docs/support/messaging/transactional-email.md (EMAIL-005).

alter table public.user_display_preferences
  add column if not exists browser_language text
  check (browser_language in ('en', 'fr', 'es'));

comment on column public.user_display_preferences.browser_language is
  'The language the site last showed this person from their browser (en, fr or es). Used for email when language is null.';
