---
feature: site/guide
status: active
surfaces:
  - src/pages/Guide.tsx                                      # /guide, /guide/creators, /guide/buyers
  - src/domain/guide/guide.ts                                # the steps and what ticks each one
  - src/domain/guide/tours.ts                                # the spotlight tours and what they point at
  - src/components/guide/GuideTour.tsx:268                   # runs ?tour=<id> on any page
  - src/components/guide/GuideWelcome.tsx:29                 # the once-per-account welcome window
  - src/components/guide/GuideHelpLink.tsx                   # "How this works" on workflow pages
  - src/components/layout/ScrollToTop.tsx                    # ignores ?tour= and #step-…
  - src/hooks/guide/useGuide.ts
  - src/lib/theme/theme.ts                                   # the light/dark step's setting
  - public.user_site_update_preferences.guide_welcome_seen_at
  - my_guide_progress()
  - supabase/migrations/20261104_188_add_guide_progress.sql
unmatched_tier: 2
---

# Guide and spotlight tours — Support Playbook

The site explains itself in three parts (since V0.17.00):

- **The welcome window.** The first time someone signs in, a window offers
  the creator guide, the buyer guide or "Maybe later". Any choice, or
  closing it, records `guide_welcome_seen_at` on their row of
  `user_site_update_preferences`, so it shows once per account on any
  device. It never shows on `/guide…`, `/signin` or during a tour, and it
  sits inside the policy gate, so it never covers a policy acceptance.
- **The guides.** `/guide` offers both. `/guide/creators` and `/guide/buyers`
  list the steps in order. Anyone can read them. Signed in, each step shows
  **Done**, **Waiting for review** (an application under review) or **To do**.
  These come from what the account has actually done, never a box someone
  ticks. Steps that are only worth knowing have no badge. The first step
  in both (since V0.18.00) is "Pick light or dark": Light, Dark or "Match
  my device", the same setting as the sun/moon button in the top bar. It's
  saved in the browser (`creatorhub-theme` in local storage), not on the
  account, so each device keeps its own.
- **Spotlight tours.** "Show me" on a step opens the page it's about with
  `?tour=<id>` in the address. The page dims, and a card walks through its
  parts with Back, Next and Done. The highlight and card slide from one
  part to the next, and the highlighted part glows and pulses twice when the
  highlight lands (since V0.17.01). People who turn on reduced motion get
  the glow with no sliding or pulse. Done, "End tour" or Escape ends it
  (since V0.19.00): the spotlight slides down to the footer's Guide link
  (`data-tour="footer-guide"`) with "The guide is always here", and "Got
  it" or a second Escape closes it. The page can't be clicked until then. Commission pages need an id, so
  their tours start from the "Show me around this page" link on the page
  itself. "How this works" links on the workflow pages go to the matching
  step (`/guide/<track>#step-<key>`).

Where the ticks come from:

| Step | Ticked when |
| --- | --- |
| Profile (both) | `useSellerAccess().profileReady` |
| Apply to sell | approved (Done), submitted or under review (Waiting) |
| Connect payouts | `getCreatorPaymentAccountIsReady` |
| Everything else with a badge | `my_guide_progress()`: published listing, request received or sent, commission delivered or received, download sold or bought, any paid sale or payment |

`my_guide_progress()` is `security definer`, only answers for `auth.uid()`,
and refuses anyone signed out (`42501` "Sign in to see your guide
progress."). It returns yes/no only, never counts or ids.

Nothing here touches money, and nothing here is needed to use the site. A
broken guide means people get less help, not that they're blocked.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "The welcome window keeps coming back" | [`GDE-001`](#gde-001--welcome-window-keeps-coming-back) |
| "A step says To do but I've done it" | [`GDE-002`](#gde-002--a-step-isnt-ticked) |
| "The tour is pointing at nothing / the middle of the screen" | [`GDE-003`](#gde-003--a-tour-step-shows-in-the-middle-of-the-screen) |
| "There's no Show me button" | [`GDE-004`](#gde-004--no-show-me-button) |
| "My light/dark choice didn't stick" | [`GDE-006`](#gde-006--lightdark-choice-doesnt-stick) |
| "I can't click anything" | [`GDE-005`](#gde-005--the-page-cant-be-clicked) |

---

## `GDE-001` — Welcome window keeps coming back

```yaml
id: GDE-001
tier: 2
signals:
  - source: client
    match: "new row violates row-level security policy for table \"user_site_update_preferences\""
    where: "src/hooks/guide/useGuide.ts (useMarkGuideWelcomeSeen)"
auto_fix: none
reason_not_automatable: "usually a policy or grant problem on the table, which needs a migration"
escalate_with:
  - "the person's user id"
  - "select guide_welcome_seen_at from public.user_site_update_preferences where user_id = '<id>'"
```

**Cause.** Closing the window hides it straight away and then saves
`guide_welcome_seen_at`. If the save fails, the window comes back on the
next visit. The table's insert and update policies (migration 161) only let
people write their own row. A failure there means those policies or the
table's grants changed.

**What the user sees.** "Welcome to Made for Stream" on every visit.

**Manual fix.** Check the row. If `guide_welcome_seen_at` stays empty after
they close the window, check the table's policies and grants against
migration 161. As a stopgap the owner can set the column for that one
person, with their agreement. That's a data change, never done by an agent.

**Money impact.** None.

---

## `GDE-002` — A step isn't ticked

```yaml
id: GDE-002
tier: 2
signals:
  - source: db
    match: "Sign in to see your guide progress."
    where: "public.my_guide_progress()"
auto_fix: none
reason_not_automatable: "needs to know which step and whether the action really happened"
escalate_with:
  - "which track and step"
  - "the result of my_guide_progress() for that person (run with their claims in a rolled-back session)"
```

**Cause.** Each badge has a fixed rule (table above). The usual reasons it
doesn't tick:
- **Listing step:** the listing is a draft, inactive or unpublished.
- **"Sale" steps:** these need a payment with `paid_at` set, and a checkout
  that was never finished isn't a sale.
- **Payouts step:** this follows Stripe's readiness, and the Payouts section
  shows the same thing.
- **No ticks at all:** `my_guide_progress()` failed. The page then shows
  every activity step as To do.

**What the user sees.** "To do" on a step they believe they've done.

**Manual fix.** Find the rule for the step and check the account against it.
If the account has really done it and the rule says no, the rule is wrong
(a bug), so raise it with the step and the data.

**Money impact.** None.

---

## `GDE-003` — A tour step shows in the middle of the screen

```yaml
id: GDE-003
tier: 2
signals:
  - source: client
    match: "none: no error is raised; the step simply has no spotlight"
    where: "src/components/guide/GuideTour.tsx (findTarget)"
auto_fix: none
reason_not_automatable: "the page's markup changed; needs a code change"
escalate_with:
  - "the tour id (?tour= in the address), the step number and the page"
  - "phone or desktop"
```

**Cause.** Each step points at a CSS selector in `tours.ts` (an id such as
`#settings-payouts`, or a `data-tour="…"` attribute on the page). The tour
looks for a visible match for about 1.5 seconds. If it finds none, the step
shows as a centred card. That's expected in these cases:
- the part is hidden on a phone, such as a top bar link inside the menu, or
  the project side of a commission while the Messages tab is open;
- it isn't shown in that state, for example no milestones yet;
- the page is still loading.

If it happens on desktop with the part plainly on screen, someone renamed
or removed the marker.

**What the user sees.** The step's text, with no highlighted spot.

**Manual fix.** Search the page for the selector named in `tours.ts`. Put the
`data-tour` back, or update the selector.

**Money impact.** None.

---

## `GDE-004` — No Show me button

```yaml
id: GDE-004
tier: 1
signals:
  - source: client
    match: "none: no error is raised; the button is left out"
    where: "src/domain/guide/guide.ts (canTakeTour)"
auto_fix: none
verify:
  - "the person is signed in, and for a creator tour, an approved creator"
```

**Cause.** By design. "Show me" only appears for pages the person can open:
signed in for every tour, and an approved creator for the dashboard, new
listing, commissions and earnings tours. Otherwise the button would land on
a sign-in page or a refusal. Some steps have no tour at all, only text.

**What the user sees.** Only the step's text and its link.

**Fix.** Explain the condition. Nothing to repair.

**Money impact.** None.

---

## `GDE-005` — The page can't be clicked

```yaml
id: GDE-005
tier: 1
signals:
  - source: client
    match: "/[?&]tour=/ in the page address"
    where: "src/components/guide/GuideTour.tsx"
auto_fix: none
verify:
  - "the address has no tour= after Got it on the last card, or Escape twice"
```

**Cause.** By design while a tour runs: a clear layer over the page stops
clicks, so the tour can't be lost halfway through. Done, "End tour" or Escape
moves to a last card at the footer's Guide link. "Got it" there, or a second
Escape, removes `tour=` from the address and the layer goes with it. A
shared or bookmarked link with `?tour=` starts the tour again. If the
footer link can't be found, the last card shows in the middle of the screen
instead, and it closes the same way.

**What the user sees.** A dimmed page with a card on it.

**Fix.** Tell them to press "End tour" and then "Got it" on the card, or
Escape twice, or to open the address without `?tour=…`.

**Money impact.** None.

---

## `GDE-006` — Light/dark choice doesn't stick

```yaml
id: GDE-006
tier: 1
signals:
  - source: client
    match: "none: no error is raised; writeStoredPreference swallows a storage failure"
    where: "src/lib/theme/theme.ts (writeStoredPreference)"
auto_fix: none
verify:
  - "the same browser, not a private window, and site data not cleared on close"
```

**Cause.** By design the choice lives in the browser, not the account. It
comes back as "Match my device" when:
- they're on another device or browser;
- they're in a private window;
- the browser clears site data, or blocks storage for the site.

A storage failure is ignored on purpose, so the site still works. The
choice then lasts only until the page reloads.

**What the user sees.** The site back in the other mode on their next
visit, or on their phone.

**Fix.** Explain that each device keeps its own choice, and check for a
private window or cleared storage. Nothing to repair.

**Money impact.** None.

---

## Known gaps

- **Text is checked in tests, not by readers.** The guide's English is the
  source; the French and Spanish were drafted with it and need a native
  speaker's check, like the rest of those languages. A test fails if any
  step or tour step has no text.
- **The guide describes how the site works, not the policies.** It links to
  the Refund Policy and Fee Schedule rather than restating them. If a
  policy changes, check the steps that summarise it, especially Pay,
  Downloads and Refunds.
- **Tours don't follow the person between pages.** Each tour covers one
  page. Multi-page walk-throughs are the guide's job.
- **No "show the welcome again" switch.** The guide is always in the footer
  and on the creator dashboard. Add a switch to Settings → Preferences if
  people ask.
