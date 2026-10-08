---
feature: messaging/conversations
status: active
surfaces:
  - public.conversations
  - public.conversation_messages
  - public.conversation_events
  - src/components/conversations/
unmatched_tier: 2
---

# Conversations — Support Playbook

Conversations carry everything buyers and creators say to each other: inquiries,
request discussion, revision requests, and the negotiation behind an agreement.

They are also **the evidence record**. When a dispute reaches a bank, the
conversation is a large part of what proves what was agreed and delivered — see
[`REF-003`](../payments/refunds-and-disputes.md#ref-003--dispute-opened-against-a-creator).
That makes message loss more serious here than in a typical chat feature, and it
is why nothing in this playbook deletes anything.

Buyers can upload images, but only after the creator approves image access. That
gate is deliberate: it stops unsolicited image sending to creators.

## Quick triage

| Symptom the user reports | Likely issue |
| --- | --- |
| "I can't see this conversation" | [`MSG-001`](#msg-001--access-denied-to-a-conversation) |
| "I can't send a message" | [`MSG-002`](#msg-002--message-rejected), [`MSG-003`](#msg-003--conversation-is-closed-or-locked) |
| "The chat is locked" | [`MSG-003`](#msg-003--conversation-is-closed-or-locked) |
| "I can't upload an image" | [`MSG-004`](#msg-004--image-upload-access-not-granted) |
| "Messages are missing" | [`MSG-005`](#msg-005--reported-missing-messages) |

---

## `MSG-001` — Access denied to a conversation

```yaml
id: MSG-001
tier: 2
signals:
  - source: db
    match: "You do not have access to this conversation."
  - source: db
    match: "Conversation not found."
  - source: db
    match: "You cannot start a conversation with yourself."
auto_fix: none
reason_not_automatable: "authorization boundary"
escalate_if:
  - "repeated denials from one user across conversations"   # -> tier 3, probing
escalate_with:
  - "the acting user id and the conversation participants"
  - "count of denials from that user in the window"
```

**Cause.** The user is not a participant, is signed into the wrong account, or
the conversation was deleted. Also produced by stale links.

**Fix.** Confirm the signed-in account. Nothing to repair for the innocent case.

**Escalate on volume.** Someone walking conversation ids to find readable threads
is attempting to read other people's private negotiations. That is a
confidentiality breach, not a permissions annoyance.

**Money impact.** None directly. A breach here exposes commercial terms between
other parties.

---

## `MSG-002` — Message rejected

```yaml
id: MSG-002
tier: 2
signals:
  - source: db
    match: "Message must be 2000 characters or less."
  - source: db
    match: "Message must be at least 10 characters."
  - source: db
    match: "Message not found in this conversation."
auto_fix: none
reason_not_automatable: "user input correction"
```

**Cause.** Length validation. The 10-character minimum on opening messages exists
to stop low-effort inquiries reaching creators.

**What the user sees.** A rejected message. The minimum surprises people sending
a short but reasonable reply.

**Fix.** Adjust the message. Worth noting if the minimum is blocking legitimate
short replies — "yes, approved" is a perfectly reasonable message and is under
the limit.

**Money impact.** None.

---

## `MSG-003` — Conversation is closed or locked

```yaml
id: MSG-003
tier: 2
signals:
  - source: db
    match: "Only open conversations can be closed."
  - source: db
    match: "Only open conversations can be admin locked."
  - source: db
    match: "Only admins can lock conversations."
  - source: db
    match: "Only admins can reopen conversations."
  - source: db
    match: "A decline reason is required before closing the conversation."
auto_fix: none
reason_not_automatable: "closure and locking are deliberate decisions"
escalate_with:
  - "why the conversation was closed or locked"
  - "whether the request is still active"
```

**Cause.** The conversation was closed by a participant, locked by an admin after
a report, or auto-closed on request completion.

**What the user sees.** They cannot reply. If it closed on completion, that is
expected. If an admin locked it, they may not know why.

**Fix.** Depends on the cause. **A locked conversation stays locked until an
admin decides otherwise** — that is a moderation outcome, not a bug, and the
agent may not reopen it.

**Watch for:** a conversation closed while its request is still active. Those two
states disagreeing leaves participants unable to discuss live work.

**Money impact.** None directly. Parties on an active project who cannot
communicate will stall.

---

## `MSG-004` — Image upload access not granted

```yaml
id: MSG-004
tier: 2
signals:
  - source: db
    match: "Only the buyer can request image upload access."
  - source: db
    match: "Only the creator can approve buyer image uploads."
  - source: db
    match: "Only the creator can disable buyer image uploads."
  - source: db
    match: "You must be signed in to approve image access."
  - source: db
    match: "You must be signed in to request image access."
auto_fix: none
reason_not_automatable: "consent gate; approval is the creator's decision"
```

**Cause.** The buyer tried to upload before the creator granted access, or the
wrong party attempted the grant.

**What the user sees.** A buyer unable to send a reference image, which is a real
friction point — reference images are often central to a commission brief.

**Fix.** The creator grants access. **Nobody may grant it on the creator's
behalf.** It is a consent gate protecting creators from unsolicited images, and
overriding it defeats the purpose.

**Money impact.** None. Can delay a brief.

---

## `MSG-005` — Reported missing messages

```yaml
id: MSG-005
tier: 3
signals:
  - source: user_report
    match: "messages missing from a conversation"
auto_fix: none
reason_not_automatable: "potential data loss in the evidence record"
escalate_with:
  - "conversation id and the window of the reported gap"
  - "message and event rows for that window"
  - "whether both participants see the same gap"
```

**Cause.** Possibilities in order of likelihood: the user is looking at a
different conversation (the request and message views share one thread, and they
have been confused before); a client-side rendering or pagination bug; or actual
data loss.

**Why Tier 3 on the first report.** Conversations are evidence. If messages can
disappear, the dispute record is unreliable, and that undermines the product's
central promise. The claim needs verifying against the database directly rather
than being explained away — and the first two causes are cheap to rule out.

**Fix.** Confirm against the stored rows before concluding anything.

**Money impact.** None directly. A compromised evidence record affects every
dispute.

---

## The inbox (2026-10-08)

`/messages` files every conversation in exactly one folder
(`src/domain/conversations/inboxFolders.ts`):

| Folder | What is in it |
| --- | --- |
| Messages | Listing and creator inquiries whose chat is open |
| Active commissions | Commission conversations whose commission is `submitted` or `accepted` |
| Completed commissions | Commission is `completed` |
| Ended conversations | A closed or locked inquiry, or a commission that was declined, cancelled or archived |

"Reports" in the folder list is a link to Settings → My reports, not a folder.
The folder is in the address (`/messages?folder=ended`).

**What is loaded.** The inbox reads the person's 50 most recently active
conversations (`INBOX_PAGE_SIZE`), and for unread counts only the messages
that arrived after their last read in conversations that can have any. The
same query feeds the unread number in the top bar on every page, so it is
kept small on purpose. When someone has more than 50 conversations, an
**Older conversations** folder appears with the rest; those are fetched 50 at
a time and only when that folder is opened. Folder counts and the instant
search cover what is loaded, so an old conversation is found by opening Older
conversations first. Capital letters never matter in either kind of search.

**Search** matches every word typed against the conversation's title, listing,
the other person and the latest message, as it is typed. Once three or more
characters are typed and typing pauses, `useInboxMessageSearch` also asks the
database which of the person's conversations contain that text in any message
(`conversation_messages.body`, limited by row level security to their own).

**"Search doesn't find a message I know is there."** The message search needs
three characters, matches the text exactly as typed (not word by word), and
returns at most 500 matching messages. If the database query fails, the inbox
still filters on titles, people and the latest message and shows no error.
The conversation must also be in the folder being viewed: search in **All**.

## Known gaps

- **No documented export of a conversation** for dispute evidence. `REF-003`
  requires assembling exactly this, by hand, under a deadline.
- **Chat UI is duplicated** (`RequestConversationThread` and `MessageDetails`),
  which is a plausible source of `MSG-005` reports and is a known refactor.
- **Read receipts and unread counts** have no documented failure modes.
- **No retention policy** for conversations on completed requests, which matters
  because they are the dispute record.
