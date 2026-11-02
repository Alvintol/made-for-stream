---
feature: operations/rate-limits
status: active
surfaces:
  - api/rateLimit.js          # limits, and what is never limited
  - api/server.js             # trust proxy and the /api limiter
  - api/tests/rateLimit.test.js
unmatched_tier: 2
---

# API rate limits — Support Playbook

The API counts requests per internet address per minute: 600 reads and 60 writes.
This stops one person or script from running up the bill or crowding out everyone
else. Past the limit the API answers `429` until the minute is up.

Calls from Stripe, the email provider and our own scheduled jobs are never limited,
because they're already checked by signature or secret, and a refused webhook would
mean a missed payment event. `/api/health` isn't limited either.

A caller can't get around this by sending a fake address, because the API trusts
only the address Cloud Run saw. To check that, open `/api/health`: `yourAddress`
must be your own public address, even when sending a fake `X-Forwarded-For` header.
If it shows a Google address, every visitor is sharing one limit, so fix `trust
proxy` straight away.
## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "Too many requests. Please wait a moment and try again." | [`RATE-001`](#rate-001--someone-reached-the-request-limit) |
| Live status missing for a minute on a shared network | [`RATE-001`](#rate-001--someone-reached-the-request-limit) |

---

## `RATE-001` — Someone reached the request limit

```yaml
id: RATE-001
tier: 2
signals:
  - source: api
    match: "RATE-001: request limit reached on"
    where: "api/server.js, logged once per address per minute, with the route"
  - source: client
    match: "Too many requests. Please wait a moment and try again."
    where: "429 from api/server.js, with a Retry-After header"
auto_fix: none
reason_not_automatable: "whether it is abuse or a shared address takes a person to judge"
escalate_if:
  - "real people on one network are refused repeatedly"
  - "the log line appears on a Stripe or scheduler route, which must never be limited"
  - "hundreds of different addresses hit the limit together, which suggests an attack"
```

**Cause.** One address sent too many requests. Usually a script. Sometimes many
real people share an address, such as a school, or a phone network.

**What the user sees.** The message above on an action, or no live status for up to
a minute. Nothing is lost: waiting and trying again works.

**Fix.** Do nothing for a script. If it happens site-wide, check `yourAddress` as
above. If real people are affected, raise
`READS_PER_MINUTE` or `WRITES_PER_MINUTE` in `api/rateLimit.js` and redeploy.

**Money impact.** A refused checkout delays a payment and doesn't charge anyone.

---

## Known gaps

- **Each copy of the API counts separately,** so the real limit is these numbers
  times the copies running. Cloud Run's maximum number of copies is what caps the
  total bill, so keep it set.
- **This only protects the API.** The site reads the database directly with the
  public key, and that path has no limit per address. It relies on small pages,
  fast indexes, and Supabase's 3 second limit on anonymous queries.
- **Moving the API behind a proxy breaks this.** `trust proxy` assumes Cloud Run is
  the only hop. Behind Cloudflare or a load balancer, every visitor would look like
  one address and share one limit, so update it in the same change.
