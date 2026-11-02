---
feature: discovery/twitch-live
status: active
surfaces:
  - api/server.js:2812    # GET /api/twitch/live, what the site calls
  - api/server.js:464     # live answer cached 60s / linked logins cached 5 min
  - api/twitchLive.js     # batches of 100
  - api/tests/twitchLive.test.js
  - src/hooks/useTwitchStreams.ts
  - src/pages/Live.tsx
unmatched_tier: 2
---

# Twitch Live Status — Support Playbook

The Live page, the home page and the top bar show which creators are streaming
now. The API keeps one shared answer: it reads the linked Twitch logins every 5
minutes, asks Twitch about them at most once a minute, and gives that answer to
every visitor. A visitor costs no database read and no Twitch call, so a busy site
costs the same as a quiet one. Twitch takes 100 logins a request, so the list goes
in batches. What the Live and home pages then
read from the database is in [`efficient-reads.md`](../site/efficient-reads.md).

This is a **discovery convenience, not a transactional feature**. Nothing here
touches money or blocks a commission, so almost everything in this playbook is
low urgency — with one exception: a credentials failure takes out account
linking too, and that one is not cosmetic.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I'm live but not showing" | [`LIV-001`](#liv-001--live-status-is-stale-or-wrong) |
| "The Live page is empty" | [`LIV-002`](#liv-002--twitch-api-unavailable) |
| "Live has been broken all day" | [`LIV-003`](#liv-003--twitch-credentials-rejected) |
| "Live status unavailable" with a message about linked logins | [`LIV-004`](#liv-004--linked-logins-could-not-be-read) |

---

## `LIV-001` — Live status is stale or wrong

```yaml
id: LIV-001
tier: 2
signals:
  - source: user_report
    match: "creator is live on Twitch but not shown, or shown when offline"
auto_fix: none
reason_not_automatable: "usually cache latency resolving itself"
escalate_if:
  - "wrong for more than 5 minutes"
  - "affecting many creators at once"
```

**Cause.** Cache lag, usually. The API's answer lasts 60 seconds and each open page
checks once a minute, so up to about 2 minutes behind is expected. A creator who
linked Twitch just now can take 5 more minutes. A persistent mismatch means the
creator's Twitch link is stale or missing, which is really
[`twitch-linking.md`](../auth/twitch-linking.md) presenting here.

**Fix.** Wait out the cache. If it persists, check the linked account — a
creator who changed or renamed their Twitch account will never show as live.

**Money impact.** None. Reduced discovery for that creator.

---

## `LIV-002` — Twitch API unavailable

```yaml
id: LIV-002
tier: 2
signals:
  - source: api
    match: "/Twitch streams failed \\(5\\d\\d\\)/"
  - source: api
    match: "/Token request failed \\(5\\d\\d\\)/"
auto_fix: none
reason_not_automatable: "upstream outage; nothing to fix on our side"
escalate_if:
  - "sustained beyond 15 minutes"
```

**Cause.** Twitch is having problems. 5xx responses are theirs.

**What the user sees.** An empty or stale Live page.

**Fix.** None. It resolves when Twitch recovers. Worth confirming against
Twitch's status page before investigating anything locally.

**Money impact.** None.

---

## `LIV-003` — Twitch credentials rejected

```yaml
id: LIV-003
tier: 3
signals:
  - source: api
    match: "/Token request failed \\(401|403\\)/"
  - source: api
    match: "Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET"
auto_fix: none
reason_not_automatable: "configuration; affects every user"
escalate_with:
  - "which variables are present"
  - "whether credentials were recently rotated"
```

**Cause.** Credentials missing, expired, or revoked.

**Why Tier 3 despite Live being non-critical.** The same credentials power
account linking. A 401 here means creators cannot verify their identity either —
see [`twitch-linking.md`](../auth/twitch-linking.md) `TWL-004`. The visible
symptom is a cosmetic page; the actual impact is verification being down.

**Fix.** Restore the credentials.

**Money impact.** None directly. Creator verification is blocked, and
verification is a trust feature the product sells on.

---

## `LIV-004` — Linked logins could not be read

```yaml
id: LIV-004
tier: 2
signals:
  - source: api
    match: "Linked Twitch logins failed:"
    where: "api/server.js fetchLinkedTwitchLogins, on GET /api/twitch/live"
  - source: api
    match: "Supabase admin not configured"
    where: "api/server.js fetchLinkedTwitchLogins, on GET /api/twitch/live"
auto_fix: none
reason_not_automatable: "the cause is the database or the API's configuration"
escalate_if:
  - "other API routes are failing too"
```

**Cause.** The API could not read `profile_platform_accounts`, because the database
was unreachable or `SUPABASE_SERVICE_ROLE_KEY` is missing or wrong on the service.

**What the user sees.** "Live status unavailable" on the Live and home pages, and
no live count on the top bar. Everything else on those pages still works.

**Fix.** Check the service's variables and the database. It recovers by itself:
failures are not cached, so the next visitor's request tries again.

**Money impact.** None.

---

## Known gaps

- **No alerting on Live page failures.** Everything here is discovered by a user
  mentioning it.
- **Failures are not cached.** During a Twitch outage each new request tries
  again, though requests arriving together share one attempt.
- **Each copy of the API has its own cache,** so with several running, Twitch is
  asked once a minute per copy. A shared cache isn't worth adding until many run.
- **Only Twitch is implemented.** YouTube and Kick creators have no live status
  at all.
