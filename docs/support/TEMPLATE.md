---
feature: <area>/<feature-name>
status: active
surfaces:
  - <path/to/file.ts:LINE>
  - <public.table_name>
  - <rpc_name()>
unmatched_tier: 2
---

# <Feature Name> — Support Playbook

One paragraph: what this feature does, and what it means when it breaks. Who is
blocked, and is money involved.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "..." | [`<AREA>-001`](#area-001--short-title) |

---

## `<AREA>-001` — Short title

```yaml
id: <AREA>-001
tier: 1
signals:
  - source: api | db | client | stripe | worker
    match: "<verbatim error string or /regex/i>"
    where: "<table, endpoint, or file that produces it>"
auto_fix: <whitelisted_action_name>
params:
  <arg>: "$.<field from the signal>"
verify:
  - "<machine-checkable post-condition>"
retry_limit: 2
escalate_if:
  - "<condition that makes this not the documented case>"
```

**Cause.** Why this happens, mechanically. Point at the code path.

**What the user sees.** The actual UI message or behaviour, so support can match
a report to this entry.

**Fix.** What the auto-fix does, in words. If tier 2, the manual steps.

**If the fix does not work.** What to check next, and what to include in the
escalation.

**Money impact.** Whether funds are held, captured, or at risk. "None" is a
valid and useful answer — say it explicitly.

---

## `<AREA>-002` — Short title

```yaml
id: <AREA>-002
tier: 2
signals:
  - source: db
    match: "<...>"
auto_fix: none
reason_not_automatable: "<why a human is required>"
escalate_with:
  - "<extra context the agent should gather before escalating>"
```

**Cause.**

**What the user sees.**

**Manual fix.**

**Money impact.**

---

## Known gaps

Failure modes this feature has that are **not** yet documented as issues, and
why. Being honest here is what stops the agent from silently mishandling them —
anything listed here falls through to `unmatched_tier`.
