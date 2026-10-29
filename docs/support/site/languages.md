---
feature: site/languages
status: active
surfaces:
  - src/lib/i18n/languages.ts            # SUPPORTED_LANGUAGES, OFFERED_LANGUAGES, resolveLanguage
  - src/lib/i18n/i18n.ts                 # translate, useT, useLanguage
  - src/lib/i18n/messages/en.ts          # the English master list
  - src/lib/i18n/messages/fr.ts          # French
  - src/components/app/LanguageSync.tsx  # sets the page language and <html lang>
  - src/components/settings/DisplayCurrencySettings.tsx
  - src/domain/listings/listingRequestForm.ts  # form errors are translation keys
  - public.user_display_preferences.language  # 20261029_173
unmatched_tier: 2
---

# Languages — Support Playbook

The site can be shown in English or French (decided 2026-10-29). The text is
translated in the site's own code, not by a translation widget. English is the
master list; French must have every English line, or the build fails.

**French is not ready yet.** Screens are moved to the translation lists a few at
a time; anything not moved yet is still English. Until every screen and every
policy is translated, French is offered only on a local development server or
where `VITE_OFFER_UNFINISHED_LANGUAGES=true` is set (the dev website). Everyone
else sees English only, and Quebec stays blocked (ACC-006).

**How the language is chosen.** The language saved in Settings → Preferences
(or the globe button in the top bar); otherwise the browser's language
(`fr-CA` counts as French) if it is offered; otherwise English. A signed-in
person's choice is saved on their account (`user_display_preferences.language`).
A visitor's choice lasts until they reload, and nothing is stored in the
browser. Emails are still in English.

**What is translated:**

- 2026-10-29: the top bar, menu and category names, the footer, the language
  and currency dialog, and the sign-in page.
- 2026-10-29: the home page, the market and free pages, the creators list and
  creator cards, listing cards and prices, the listing page (including its
  report form), the report notes on creator profiles and conversations, and
  the page-not-found page.
- 2026-10-29: the creator profile page (message form and report form), the
  commission request form and its estimated invoice, and the request form's
  error messages.
A category, listing type or video type the lists do not know (an old value
on a listing) is shown as it is written, never as an error (`hasMessage`).

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "Part of the page is in English" (French chosen) | Expected until French is ready: that screen is not translated yet |
| "I can't choose French" | Expected: French is not offered outside development until it is ready |
| "My language and currency settings won't load" / prices stopped converting | [`LANG-001`](#lang-001--language-column-missing) |

---

## `LANG-001` — Language column missing

```yaml
id: LANG-001
tier: 2
signals:
  - source: db
    match: "/column \"?(user_display_preferences\\.)?language\"? does not exist/"
    where: "useDisplayPreferences (src/hooks/money/useDisplayCurrency.ts), when migration 20261029_173 is not applied"
auto_fix: none
reason_not_automatable: "applying a migration is the owner's step"
```

**Cause.** The website reads `language` with the display preferences. If the
website was deployed before migration `20261029_173`, that read fails for every
signed-in person.

**What the user sees.** Converted prices disappear (creators' own prices still
show), the language falls back to the browser's, and saving preferences fails
with "Your choice could not be saved. Please try again."

**Fix.** Apply migration `20261029_173`.

**Money impact.** None. Nobody is charged a converted price.

---

## Adding a screen to the translation

1. Move each piece of text into `messages/en.ts` under a key named after the
   screen (`signin.title`), and write the French in `messages/fr.ts`.
2. In the component, `const t = useT();` and `{t("signin.title")}`. Values go in
   braces: `t("footer.copyright", { year })`. Counts use a plural message:
   `t("nav.unread", { count })`.
3. A sentence with links in the middle is split into pieces around the links
   (see `signin.agree*`).
4. Keep the English word for word unless the change is meant: tests and
   playbook signals quote it.

## Known gaps

- **Most screens are not translated yet.** Including the policies, which need a
  human translator.
- **Emails are English only.**
- **Numbers and money** still use English formatting: French writes "5 %" and
  "105 € EUR", the site shows "5%" and "€105 EUR". Dates and currency names
  follow the language.
- **Listings and messages are not translated.** They stay in the language they
  were written in.
- **The French has not been checked by a French speaker.** Do that before
  French is marked ready.
