---
feature: profiles
status: active
surfaces:
  - public.profiles
  - src/hooks/profile/useMyProfile.ts
  - supabase/migrations/20261105_189_close_public_storage_and_profile_gaps.sql   # PRF-004
  - public.profile_platform_accounts
  - src/domain/profileMedia.ts
  - src/pages/ProfileSettings.tsx
unmatched_tier: 2
---

# Profiles and Media — Support Playbook

Profiles are the public face of a creator: handle, bio, avatar, banner, and
linked platform accounts. The public profile at `/creator/:handle` is what buyers
judge before commissioning, so profile problems are conversion problems.

Admins can mark a profile under review, which affects its visibility.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "My profile won't save" | [`PRF-002`](#prf-002--profile-update-rejected) |
| "My avatar/banner won't upload" | [`PRF-001`](#prf-001--media-upload-failed) |
| "My profile isn't visible" | [`PRF-003`](#prf-003--profile-under-review) |
| A page or the profile form fails to load after a profiles change | [`PRF-004`](#prf-004--a-query-asks-for-a-hidden-profile-column) |
| "My Twitch link is gone" | [`auth/twitch-linking.md`](../auth/twitch-linking.md) |

---

## `PRF-001` — Media upload failed

```yaml
id: PRF-001
tier: 2
signals:
  - source: client
    match: "/upload failed|storage|payload too large|413|unsupported (file|media) type/i"
    where: src/domain/profileMedia.ts
auto_fix: none
reason_not_automatable: "client or storage issue; the agent cannot re-upload a file it does not have"
escalate_if:
  - "uploads failing for multiple users"   # -> tier 3, storage problem
escalate_with:
  - "file size and type"
  - "the storage error verbatim"
```

**Cause.** Usually the file: too large, wrong format, or corrupt. Occasionally
Supabase Storage itself.

**Distinguish by spread.** One user with one file is the file. Several users at
once is storage.

**What the user sees.** An upload that fails, often without saying which
constraint it violated.

**Fix.** Resize or convert the file. If storage is failing broadly, that is an
availability incident.

**Money impact.** None. A creator without a portfolio image converts far worse,
so it is not cosmetic.

---

## `PRF-002` — Profile update rejected

```yaml
id: PRF-002
tier: 2
signals:
  - source: db
    match: "/handle .*(taken|already exists|unique)/i"
  - source: db
    match: "/violates check constraint/i"
    where: public.profiles
auto_fix: none
reason_not_automatable: "user input correction"
escalate_if:
  - "a constraint violation with valid-looking input"   # schema/client mismatch
```

**Cause.** A handle collision, or input failing a format or length constraint.

**What the user sees.** A rejected save. Handle collisions are the common case
and are self-explanatory; constraint violations usually are not.

**Fix.** Choose a different handle, or correct the field. **A constraint
violation on input that looks valid is a client bug** — the front end is not
enforcing what the database does.

**Money impact.** None.

---

## `PRF-003` — Profile under review

```yaml
id: PRF-003
tier: 2
signals:
  - source: db
    match: "You must be signed in to mark a profile under review."
  - source: db
    match: "Only admins can mark profiles under review."
  - source: db
    match: "Only admins can clear profile review."
  - source: user_report
    match: "creator reports their profile is not publicly visible"
auto_fix: none
reason_not_automatable: "review status is a moderation decision"
escalate_with:
  - "the profile's review status and the linked moderation report"
  - "whether the creator was notified"
```

**Cause.** An admin marked the profile under review, usually from a report.

**What the user sees.** Reduced or no public visibility, often without knowing
why or that it happened.

**Fix.** Human review. **The agent may not write to `profiles`** and may not
clear a review.

**Note.** As with hidden listings, creators appear to find out by noticing rather
than by being told. See [`messaging/moderation.md`](../messaging/moderation.md).

**Money impact.** None directly. An invisible profile earns nothing.

---

## `PRF-004` — A query asks for a hidden profile column

```yaml
id: PRF-004
tier: 2
signals:
  - source: db
    match: "permission denied for table profiles"
    where: "any read of public.profiles through the API (supabase-js .from(\"profiles\").select(...))"
auto_fix: none
reason_not_automatable: "the query or the grant is wrong; needs a code change or a migration"
escalate_with:
  - "the page, and the columns the failing query selects"
```

**Cause.** Since `20261105_189`, `profiles` can't be read whole. Everyone,
signed in or not, can read every column **except** `country_code`,
`timezone` and `auth_provider_last_used`. Before that, anyone could read
every person's country, timezone and sign-in method. The site still writes
those three, and the database's own functions can read them, but no page can.

Postgres refuses the **whole** query, with "permission denied for table
profiles", when it names one of those three or uses `select *`. The same
happens for **a column added to profiles later** until it's added to the grant.

**What the user sees.** Whatever that query fills stays empty or shows its
error. For `useMyProfile`, that's the profile form and the first-time setup.

**Fix.** Take the hidden column out of the query, or name the columns instead
of `*`. For a new column that should be public, a migration adds it:
`grant select (<column>) on public.profiles to anon, authenticated;`. Never
grant the three hidden ones back. A page that needs the person's own value
should get it from a `security definer` function that only answers for
`auth.uid()`.

**Money impact.** None.

---

## Known gaps

- **Media upload constraints are not documented** anywhere user-facing — size
  limits and accepted formats are discovered by failing.
- **No creator notification** on being marked under review.
- **Handle change side effects are undocumented.** Whether old profile URLs
  break, and what happens to links already shared with buyers, is not written
  down.
- **Only Twitch platform accounts are implemented**, though the product describes
  YouTube and Kick creators.
