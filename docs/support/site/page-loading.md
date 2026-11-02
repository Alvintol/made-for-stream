---
feature: site/page-loading
status: active
surfaces:
  - src/App.tsx                                  # each page is lazy
  - src/components/layout/Layout.tsx             # loading state
  - src/components/app/PageErrorBoundary.tsx     # PAGE-001
  - src/lib/reloadForNewRelease.ts
  - src/main.tsx                                 # waits for the starting language
  - src/lib/i18n/i18n.ts                         # loadLanguage, PAGE-002
  - src/domain/legal/policyVersions.ts           # versions, apart from policy text
  - vite.config.js                               # library download groups
unmatched_tier: 2
---

# Page loading — Support Playbook

The website used to be one 2 MB download. Now a first visit downloads the site's
frame and the page it lands on, about 810 KB (250 KB compressed), and every other
page downloads the first time it's opened. French and Spanish download only for
people reading them, and policy text only on legal pages.

If this breaks, one page or the whole site can fail to appear. Payments and
commissions in the database are unaffected, and nothing is lost.

**When a release goes out.** A release replaces the page files, so someone with
the site already open can ask for a file that's gone. The site reloads itself once
to get the new release, at most once a minute so a broken page can't loop.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "This page didn't load" with a Reload page button | [`PAGE-001`](#page-001--a-page-failed-to-load-or-crashed) |
| The page reloaded by itself once | Expected, just after a release |
| The site is in English after choosing French or Spanish | [`PAGE-002`](#page-002--a-language-could-not-be-downloaded) |
| "Loading..." for a moment on a page's first visit | Expected on a slow connection |

---

## `PAGE-001` — A page failed to load or crashed

```yaml
id: PAGE-001
tier: 2
signals:
  - source: client
    match: "PAGE-001: a page failed to load or crashed."
    where: "src/components/app/PageErrorBoundary.tsx, also counted in the ops digest (OPS-006)"
  - source: client
    match: "Failed to fetch dynamically imported module"
    where: "browser console, on the same failure"
auto_fix: none
reason_not_automatable: "either the visitor's connection or a bug in a page, and telling them apart takes a person"
escalate_if:
  - "many people report it on the same page"
  - "the ops digest shows it rising just after a release"
```

**Cause.** A page's file couldn't be downloaded and reloading didn't help, or the
page itself crashed while drawing. A crash used to blank the whole site. Now the
top bar and footer stay, and moving to another page clears the message.

**Fix.** One person: a connection problem, so ask them to reload. Everyone on one
page: read the error after `PAGE-001` in the console. If it's a crash, roll back
the release. If it's a file that won't download, check the website's Worker has
the release and that `dist/assets` was published.

**Money impact.** None directly, but a failure on a payment page stops that buyer
until it is fixed.

---

## `PAGE-002` — A language could not be downloaded

```yaml
id: PAGE-002
tier: 2
signals:
  - source: client
    match: "PAGE-002: a language could not be downloaded, so English is showing."
    where: "src/lib/i18n/i18n.ts (loadOrWarn)"
auto_fix: none
reason_not_automatable: "usually one person's connection, and it clears by itself"
```

**Cause.** The French or Spanish file didn't download. The site shows English
rather than an unfinished page.

**Fix.** Ask them to reload. If it affects everyone, treat it as `PAGE-001`.

**Money impact.** None.

---

## Known gaps

- **No file is fetched ahead of time.** The first click on each page waits for a
  small download. Fetching likely pages early would add data for everyone.
- **English stays in the main download,** about 160 KB before compression, as the
  fallback for any missing text.
- **A reload loses unsent text.** If someone is typing when a release lands and
  they then open a page that has never loaded, the reload clears their form.
