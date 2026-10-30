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
- 2026-10-29: the buyer's commission list (active, completed, archived) and
  checkout: the payment summary, tip and contribution, billing location and
  the terms box with the early-start request. Commission statuses, payment
  types and the fee and tax lines follow the language wherever they appear.
- 2026-10-29: on the commission page, the project agreement (with its
  "I understand" boxes and the accept-or-decline box), the work-readiness
  card and the payments card. Agreement statuses, payment structures and
  timings, timeline-hold reasons and payment statuses follow the language
  wherever they appear.
- 2026-10-29: on the commission page, milestones (with the buyer's review
  box), the final delivery (with its files and the buyer's response box) and
  progress updates (with the update schedule). How work was sent off site
  follows the language too.
- 2026-10-29: on the commission page, change orders (with the buyer's
  response box), cancelling before payment, the cancellation proposal and
  statement, cancellation warnings, and non-response notices with early
  review.
- 2026-10-30: the rest of the buyer's commission page: its headings, stages,
  next-step card, section summaries, the brief, the listing snapshot and the
  off-site confirmation, plus the page shown after checkout. The next-step
  wording, stages and summaries follow the language for creators and admins
  too once their pages pass it on; those pages are still English.
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
- **The consent wording needs the policy translator's check.** The checkout
  agreement line, the early-start request (`consent.earlyStart*`, also
  used when accepting an agreement), the agreement's "I understand" boxes
  (`agreement.understand`, `agreementReview.progress`), what approving a
  final delivery confirms (`deliveryReview.approveNote`) and what accepting
  a change order agrees to (`changeOrderReview.acceptNote`) were translated
  here, not by a translator. They are what the buyer agrees to, so check
  them with the policies before French is marked ready.
- **A buyer's recorded confirmations stay in English.** The lines under
  "Buyer confirmations" on an agreement are the wording saved when the buyer
  accepted, so they are shown as saved. The same goes for the payment names
  saved on a cancellation statement, and for the "I am requesting
  administrative closure" message the closure button posts in the chat
  (admins recognise it there). The subject inside an off-site confirmation
  ("the final delivery (title)") is saved in English by the database, so it
  appears in English inside the French sentence.
- **The chat box is still English,** apart from its report notes: the
  buttons, the message form and the reasons for ending a conversation.
- **Messages from the server** (an error from checkout, for example) are
  still in English.
- **Numbers and money** still use English formatting: French writes "5 %" and
  "105 € EUR", the site shows "5%" and "€105 EUR". Dates and currency names
  follow the language.
- **Listings and messages are not translated.** They stay in the language they
  were written in.
- **The French has not been checked by a French speaker.** Do that before
  French is marked ready.
