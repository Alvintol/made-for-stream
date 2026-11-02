---
feature: site/efficient-reads
status: active
surfaces:
  - public.market_listings()               # 20261102_178
  - public.creator_directory()             # 20261102_178
  - public.my_unread_message_count()       # 20261102_178
  - public.contains_pattern()              # 20261102_178
  - src/hooks/listings/useMarketListings.ts
  - src/hooks/useCreatorDirectory.ts
  - src/hooks/conversations/useUnreadMessageCount.ts
  - src/hooks/useTwitchStreams.ts
  - src/lib/pageOfRows.ts
  - src/lib/useDebouncedValue.ts
  - src/pages/Market.tsx
  - src/pages/creator/Creators.tsx
  - src/pages/Live.tsx
  - src/pages/Home.tsx
  - src/components/layout/Nav.tsx
unmatched_tier: 2
---

# Page-at-a-time reads — Support Playbook

Public pages used to load whole tables into each visitor's browser and filter
them there. Now each asks the database for one small page.

| Where | What it reads |
| --- | --- |
| Market and Free | 24 listings at a time; search and filters run in the database |
| Home | The 6 newest listings, and the 6 most-watched live creators |
| Creators | 24 creators at a time, with a summary of their listings |
| Live | The 48 most-watched live creators |
| Top bar | One unread number a minute, paused while the tab is hidden |
| Who is live | One shared answer from the API, see [`twitch-live.md`](../discovery/twitch-live.md) |

Nothing here touches money. If it breaks, people cannot browse: that blocks new
sales but not any commission already running, because commission pages do not use
these functions.

**How a page works.** Each function returns one row more than asked for. That row
is never shown: it only tells the site there is another page, so Load more
appears. The next page starts straight after the last row shown, using an index,
so a deep page costs about the same as the first. The search box asks once typing
pauses for 300 ms.

**Order of release.** The migration must be applied before the website merges.
Otherwise the lists fail with `READ-001`.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "Could not load marketplace listings." or "Could not load creators." | [`READ-001`](#read-001--a-list-function-is-missing-or-refused) |
| The unread number is stuck or never appears | [`READ-002`](#read-002--the-unread-number-does-not-load) |
| Search takes seconds or fails with lots of listings | [`READ-003`](#read-003--search-times-out) |
| A new listing is not showing | Expected for up to a minute: the site keeps a page for 60 seconds. Reloading shows it |
| The unread number is behind | Expected for up to a minute. Opening the inbox updates it |
| "There's no Load more button" | Expected: everything that matches is already showing |

---

## `READ-001` — A list function is missing or refused

```yaml
id: READ-001
tier: 2
signals:
  - source: client
    match: "/Could not find the function public\\.(market_listings|creator_directory)/"
    where: "PostgREST PGRST202 on /rest/v1/rpc/market_listings or creator_directory"
  - source: client
    match: "/permission denied for function (market_listings|creator_directory)/"
    where: "Postgres 42501 on the same calls"
auto_fix: none
reason_not_automatable: "applying a migration is the owner's step"
escalate_if:
  - "the functions exist and are granted, and the lists still fail"
```

**Cause.** The website went out before migration 178, or the grants on the
functions were changed. Both functions run as the person asking and need
`execute` for `anon` and `authenticated`.

**What the user sees.** The Market, Free and Creators pages show the load error.
The home page shows no featured listings and no live cards.

**Fix.** Check the functions exist with
`select proname from pg_proc where proname in ('market_listings', 'creator_directory');`.
If they don't, apply `20261102_178_add_efficient_public_reads.sql`. If they do,
re-run the migration's `grant` lines.

**Money impact.** None directly. New buyers cannot browse until it is fixed.

---

## `READ-002` — The unread number does not load

```yaml
id: READ-002
tier: 2
signals:
  - source: client
    match: "/Could not find the function public\\.my_unread_message_count/"
    where: "PostgREST PGRST202 on /rest/v1/rpc/my_unread_message_count"
auto_fix: none
reason_not_automatable: "applying a migration is the owner's step"
escalate_if:
  - "someone reports a message they cannot see at all, which is not this issue"
```

**Cause.** Same as `READ-001`. The function reads the signed-in person from their
session, so it is not granted to `anon` and a signed-out call is refused on
purpose.

**What the user sees.** No number on the Inbox link. The inbox itself still works:
it does not use this function, so messages are not lost.

**Fix.** As `READ-001`.

**Money impact.** None.

---

## `READ-003` — Search times out

```yaml
id: READ-003
tier: 2
signals:
  - source: client
    match: "canceling statement due to statement timeout"
    where: "Postgres 57014 on /rest/v1/rpc/market_listings or creator_directory"
auto_fix: none
reason_not_automatable: "the fix is a new index, which needs a migration"
escalate_if:
  - "plain browsing with an empty search box is slow too"
```

**Cause.** Search looks through each row for the text, stopping once a page is
full. A rare word has to read every public listing. This is fine well past
100,000 listings, and browsing with no search does not have this cost.

**What the user sees.** The load error, only while searching.

**Fix.** Add a `pg_trgm` index for the search text in a new migration.

**Money impact.** None.

---

## Known gaps

- **The Live page shows the 48 most-watched creators,** and its search covers only
  those. It needs paging if more than 48 are regularly live at once.
- **Filtering Creators by Live covers everyone live,** so a list of live logins
  goes to the database with each change. Fine into the thousands.
- **The Market page keeps filters from the last link.** After following a category
  link and then changing the dropdown, the address bar still shows the old
  category. Reloading the page returns to what the address says.
