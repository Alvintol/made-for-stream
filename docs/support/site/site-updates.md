---
feature: site/site-updates
status: active
surfaces:
  - src/domain/site/siteUpdates.ts                       # the version and the list
  - src/pages/SiteUpdates.tsx                            # /updates
  - src/components/app/SiteUpdatesNotice.tsx             # the closable window
  - src/components/layout/Footer.tsx                     # "Version ... · What's new"
  - src/pages/PreferencesSettings.tsx                    # the checkbox
  - src/hooks/settings/useSiteUpdatePreference.ts
  - public.user_site_update_preferences
  - supabase/migrations/20261012_161_add_site_update_preferences.sql
unmatched_tier: 2
---

# Site Updates ("What's new") — Support Playbook

The site has a version, and a list of what changed in each one, written for
the people using it. The list is at `/updates`; the footer shows the current
version and links to it. Someone who ticks **Show me what's new after the
site is updated** (Settings → Preferences, off unless they turn it on) gets a
small closable window with the latest changes, once per update, the next
time they sign in. **Site updates are never emailed.**

The list is part of the website's code, not the database:
`src/domain/site/siteUpdates.ts`. To publish an update, add an entry at the
top and set `siteVersion` to its version. A test fails if the two disagree.
The database only remembers, per person, whether they asked and the last
version they were shown.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I ticked the box and nothing appeared" / "The window keeps coming back" | [`SITE-001`](#site-001--the-whats-new-window-does-not-appear-or-comes-back) |
| "The footer shows an old version" | [`SITE-001`](#site-001--the-whats-new-window-does-not-appear-or-comes-back) |

---

## `SITE-001` — The what's-new window does not appear, or comes back

```yaml
id: SITE-001
tier: 2
signals:
  - source: user_report
    match: "ticked the site updates box and saw nothing, or the window appears on every visit"
  - source: ui
    match: "Your choice could not be saved. Please try again."
    where: "PreferencesSettings, when the row cannot be written"
auto_fix: none
reason_not_automatable: "almost always expected behaviour that needs explaining"
escalate_with:
  - "select show_site_updates, last_seen_version, updated_at from public.user_site_update_preferences where user_id = '<user>'"
  - "the version shown in the footer"
```

**Cause.** In order of likelihood:

- *Nothing appeared after ticking the box:* expected. The window is decided
  when a person signs in or opens the site, not while they are on it, so it
  appears on the next sign-in or the next time the site is opened.
- *Nothing appeared after an update:* their `last_seen_version` already
  equals the current version (they closed it on another device), or
  `show_site_updates` is off.
- *It comes back every visit:* closing it could not be saved, so
  `last_seen_version` never changes. The failure is in the failure log
  ([`OPS-006`](../operations/alerting.md#ops-006--yesterdays-failures-on-the-site)).
  If the table is missing, migration `20261012_161` was not applied.
- *The footer shows an old version:* the browser has an old copy of the
  site; a reload fixes it.

**Fix.** Explain. Nobody's row needs editing.

**Money impact.** None.

---

## Known gaps

- **Nothing checks that an update was written up.** A release that changes
  what people see but adds no entry leaves the version, and this page,
  unchanged.
- **The window is not shown to someone who is signed out**, and the choice
  cannot be made without an account. The page and the footer link are open
  to everyone.
