---
feature: auth/sign-in
status: active
surfaces:
  - src/pages/SignIn.tsx:161   # signInWithOAuth
  - src/pages/SignIn.tsx:196   # signInWithOtp (magic link)
  - src/providers/               # auth provider and session handling
  - api/server.js                # requireSupabaseUserId — bearer token validation
  - src/components/legal/PolicyAcceptanceGate.tsx   # records the sign-in box, or asks again
  - src/domain/legal/policyAcceptance.ts            # getSignInAcceptancesToRecord
  - public.policy_acceptances
unmatched_tier: 2
---

# Sign-in — Support Playbook

**Made for Stream has no passwords.** Sign-in is a Supabase magic link (email OTP) or
an OAuth provider. That removes a whole category of support load — there are no
password resets, no lockouts from failed attempts, no credential stuffing
against our own store — and replaces it with a narrower one: **email delivery**.

Almost every sign-in problem here is an email that did not arrive, arrived late,
or was opened in the wrong place.

Because there is no password fallback, a user whose email is unreachable cannot
sign in at all. There is no alternate route, which makes email problems more
severe here than in a password-based product.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I never got the email" | [`AUTH-001`](#auth-001--magic-link-email-did-not-arrive) |
| "The link says expired / invalid" | [`AUTH-002`](#auth-002--magic-link-expired-or-already-used) |
| "It logged me out again" | [`AUTH-004`](#auth-004--session-expired-mid-use) |
| "Nothing happens when I click the link" | [`AUTH-003`](#auth-003--link-opened-in-a-different-browser) |
| "Signing in with Twitch/Google fails" | [`AUTH-005`](#auth-005--oauth-provider-sign-in-failed) |
| "It says too many requests" | [`AUTH-006`](#auth-006--rate-limited) |
| "The buttons don't do anything" / "A red box shakes" | [`AUTH-007`](#auth-007--terms-box-not-ticked) |
| "I ticked the box and it asked me again" | [`AUTH-007`](#auth-007--terms-box-not-ticked) |

---

## `AUTH-001` — Magic link email did not arrive

```yaml
id: AUTH-001
tier: 2
signals:
  - source: user_report
    match: "no sign-in email received"
  - source: supabase
    match: "auth email delivery failure in logs"
auto_fix: none
reason_not_automatable: "the agent cannot see the user's inbox, and resending blindly can rate-limit them out entirely"
escalate_if:
  - "more than 2 users in 30m report non-delivery"    # -> tier 3, delivery is down
escalate_with:
  - "the email domain (not the full address)"
  - "Supabase auth log result for the send"
  - "whether other users are receiving mail in the same window"
```

**Cause, in rough order of likelihood.** Spam folder. A typo in the address. A
corporate mail filter eating it. Supabase's email rate limit. Or a genuine
delivery outage.

**What the user sees.** Nothing at all, which is the problem — an unsent email
and a filtered email look identical from their side.

**Fix.** Check spam first, then confirm the address character by character, then
retry once. Do not resend repeatedly: each attempt consumes rate-limit budget
and can push them into [`AUTH-006`](#auth-006--rate-limited), making it worse.

**Escalate as Tier 3 if multiple users report it at once.** Email delivery
failing across the board locks *everyone* out of the product, with no fallback.
That is a full availability incident even though nothing has crashed.

**Money impact.** None directly, though a buyer who cannot sign in cannot pay.

---

## `AUTH-002` — Magic link expired or already used

```yaml
id: AUTH-002
tier: 2
signals:
  - source: client
    match: "/Token has expired or is invalid|otp_expired|invalid_token/i"
auto_fix: none
reason_not_automatable: "self-service; sending a new link is the user's action"
escalate_if:
  - "reported immediately after requesting the link"  # links should not expire that fast
```

**Cause.** Magic links are single-use and time-limited. Common triggers: the user
took too long, requested several links and clicked an older one, or a mail
scanner "visited" the link first and consumed it.

That last one is worth knowing — some corporate security products follow links
in incoming mail, which silently burns the token before the user ever clicks.

**What the user sees.** An expired-or-invalid message, often confusing because
they *just* received the email.

**Fix.** Request a fresh link and use the newest email. If it recurs on a
corporate address, the scanner is the likely cause and an OAuth provider is the
practical workaround.

**Escalate if a link fails within seconds of being issued** — that is not normal
expiry and suggests a clock or configuration problem.

**Money impact.** None.

---

## `AUTH-003` — Link opened in a different browser

```yaml
id: AUTH-003
tier: 2
signals:
  - source: user_report
    match: "clicked the link, nothing happened / returned to signed-out state"
auto_fix: none
reason_not_automatable: "client-side environment issue"
```

**Cause.** The link was requested in one browser and opened in another — most
often because the mail app opens links in its own in-app browser. The session
lands somewhere the user is not looking.

**What the user sees.** The link appears to do nothing, or signs them in to a
window they then close.

**Fix.** Copy the link and paste it into the same browser where they requested
it. On phones, opening the email in the actual browser rather than the mail app
avoids it.

**Money impact.** None.

---

## `AUTH-004` — Session expired mid-use

```yaml
id: AUTH-004
tier: 2
signals:
  - source: api
    match: "Invalid session"
  - source: api
    match: "Missing Authorization bearer token"
auto_fix: none
reason_not_automatable: "normal expiry; only abnormal volume is actionable"
escalate_if:
  - "sustained volume across many users"              # -> tier 3
  - "sessions failing well inside their expected lifetime"
```

**Cause.** Normal token expiry, a stale tab left open overnight, or refresh
failing.

**What the user sees.** An action fails unexpectedly — and if it was a checkout,
they see [`PAY-007`](../payments/checkout.md#pay-007--session-or-authorization-failure)
instead, which is the same root cause wearing a payment error.

**Fix.** Sign in again.

**Escalate on volume.** Many users losing sessions at once means refresh is
broken, not that everyone idled simultaneously.

**Money impact.** None directly, but it interrupts checkouts.

---

## `AUTH-005` — OAuth provider sign-in failed

```yaml
id: AUTH-005
tier: 2
signals:
  - source: client
    match: "/oauth|provider|redirect_uri_mismatch|access_denied/i"
    where: src/pages/SignIn.tsx:161
auto_fix: none
reason_not_automatable: "cause is usually provider or redirect configuration"
escalate_if:
  - "every attempt with a given provider fails"       # -> tier 3, provider is down or misconfigured
escalate_with:
  - "which provider"
  - "the verbatim provider error"
  - "whether redirect URLs changed recently"
```

**Cause.** The user declined consent (benign), or the redirect URL does not match
what the provider expects (not benign — it breaks for everyone).

**Distinguish by pattern.** Scattered single failures are users changing their
minds. Uniform failure is configuration, and it is a total block on that
provider.

**Fix.** For the configuration case, the redirect URL must match in the provider
console, Supabase auth settings, and `APP_ORIGIN`. A domain change breaks all
three at once.

**Money impact.** None directly.

---

## `AUTH-007` — Terms box not ticked

```yaml
id: AUTH-007
tier: 2
signals:
  - source: ui
    match: "Please accept the Terms of Service and Privacy Policy to continue."
    where: "src/pages/SignIn.tsx, under the agreement box"
auto_fix: none
reason_not_automatable: "the person has to tick the box; nothing is wrong"
```

**What it is (2026-10-26).** The sign-in card lists Twitch and Google,
then the email link, then the agreement box ("I agree to the Terms of
Service and the Privacy Policy"). The buttons are never greyed out:
pressing one without the box ticked sends nothing, and instead the box
shakes, gets a red ring, takes the focus and shows the sentence above.
Ticking it clears the ring. Someone with reduced motion turned on gets the
ring without the shake.

**Asked again straight after signing in (2026-10-28).** The ticked box is
recorded once the person arrives, except for a document they accepted
before in an older version: for that one they get the "What changed in
the Privacy Policy (…)" card and accept it there, so they see the changes
first. A new account, or someone who already accepted the current
version, is not asked again. This is expected, not a fault. If the card
keeps coming back after they accept, the write failed: the browser
console shows `[policy_acceptances] signup acceptance failed (<code>)`
or the card's own error, and their rows in `policy_acceptances` show
which version is missing.

**Fix.** Tell them to tick the box under the email field, then choose a way
to sign in again. Nothing is recorded until they do.

**Money impact.** None.

---

## `AUTH-006` — Rate limited

```yaml
id: AUTH-006
tier: 2
signals:
  - source: client
    match: "/rate limit|too many requests|429|For security purposes/i"
auto_fix: none
reason_not_automatable: "the limit is doing its job"
escalate_if:
  - "many distinct users hitting it simultaneously"   # -> tier 3, possible abuse
```

**Cause.** Usually a user clicking "send link" repeatedly because the first email
had not arrived yet — [`AUTH-001`](#auth-001--magic-link-email-did-not-arrive)
causing this one.

**What the user sees.** A hard block for a cooldown period, on top of not having
received the original email. From their perspective the product has refused to
let them in.

**Fix.** Wait out the cooldown, then check spam before retrying. OAuth is not
rate-limited the same way and is a faster route if available.

**Escalate if it is widespread** — many accounts hitting auth rate limits at once
can indicate enumeration rather than impatience.

**Money impact.** None.

---

## Known gaps

- **No alerting on auth failure rates.** Every entry here that escalates "on
  volume" depends on somebody noticing, because nothing counts them.
- **Email delivery is a single point of failure with no fallback.** No passwords
  means a delivery outage is a full lockout. Worth a decision before launch:
  accept the risk, or add a second route.
- **No visibility into Supabase auth logs from the app.** Diagnosing
  `AUTH-001` requires leaving the product.
- Session lifetime and refresh behaviour are Supabase defaults; they have not
  been reviewed against how long a commission workflow actually takes.
