import { useState } from "react";

import { describeOffSiteDelivery } from "../../../domain/listings/offSiteDelivery";
import {
  useAdminRecordOffSiteReceipt,
  useOffSiteReceipts,
  useRespondOffSiteReceipt,
  type OffSiteReceiptRow,
} from "../../../hooks/conversations/useOffSiteReceipts";
import { hasErrorMessage } from "../../../lib/errorMessage";
import { OFF_SITE_RECEIPTS_TARGET } from "../workspace/focusMessages";

type OffSiteReceiptPanelProps = {
  requestId: string;
  viewer: "buyer" | "creator" | "admin";
  buyerName: string;
  creatorName: string;
};

const classes = {
  wrap: "space-y-3",
  // Clears the sticky header and tabs when the approval button jumps here.
  anchor: "space-y-3 scroll-mt-40 outline-none",
  card: "card space-y-3 border-amber-200 p-5",
  title: "font-display text-sm font-extrabold tracking-tight text-zinc-900",
  text: "text-sm leading-6 text-zinc-700",
  hint: "text-xs text-zinc-500",
  row: "flex flex-wrap items-center gap-2",
  primary: "btnPrimary btnSm",
  outline: "btnOutline btnSm",
  label: "formLabel",
  textarea: "formControl min-h-20",
  error: "formError",
} as const;

// Above a commission's chat: work the creator sent outside Made for Stream
// that the buyer has not yet confirmed. The buyer answers here; the answer
// is written into the chat. The commission cannot be completed until every
// one is confirmed (MIL-008).
const OffSiteReceiptPanel = ({ requestId, viewer, buyerName, creatorName }: OffSiteReceiptPanelProps) => {
  const { data: receipts = [] } = useOffSiteReceipts(requestId);
  const respond = useRespondOffSiteReceipt(requestId);
  const record = useAdminRecordOffSiteReceipt(requestId);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const open = receipts.filter((receipt) => receipt.status !== "received");

  if (open.length === 0) return null;

  const error = respond.error ?? record.error;

  const describe = (receipt: OffSiteReceiptRow) =>
    `${creatorName} says the work for ${receipt.subject} was sent outside Made for Stream, by: ${describeOffSiteDelivery(receipt.methods, receipt.other) ?? "another way"}.`;

  return (
    <div className={classes.anchor} id={OFF_SITE_RECEIPTS_TARGET} tabIndex={-1}>
      {open.map((receipt) => (
        <section className={classes.card} key={receipt.id} aria-label="Work sent outside Made for Stream">
          <h3 className={classes.title}>
            {viewer === "buyer" ? "Did the work arrive?" : "Waiting for the buyer to confirm"}
          </h3>

          <p className={classes.text}>{describe(receipt)}</p>

          {receipt.status === "not_received" && (
            <p className={classes.text}>
              {viewer === "buyer"
                ? "You said it hasn't arrived. Confirm here once it does."
                : `${buyerName} says it has not arrived. ${viewer === "creator" ? "Send it again, or deliver it through this page, and say so in the chat." : ""}`}
            </p>
          )}

          {viewer === "buyer" && (
            <>
              <div className={classes.row}>
                <button
                  className={classes.primary}
                  disabled={respond.isPending}
                  type="button"
                  onClick={() => respond.mutate({ receiptId: receipt.id, received: true })}
                >
                  I received it
                </button>

                {receipt.status === "awaiting" && (
                  <button
                    className={classes.outline}
                    disabled={respond.isPending}
                    type="button"
                    onClick={() => respond.mutate({ receiptId: receipt.id, received: false })}
                  >
                    It hasn&rsquo;t arrived
                  </button>
                )}
              </div>

              <p className={classes.hint}>
                Confirm in the chat that you received the work sent outside Made for Stream before
                approving the final delivery. Your answer is written into the chat.
              </p>
            </>
          )}

          {viewer === "creator" && receipt.status === "awaiting" && (
            <p className={classes.hint}>
              {buyerName} has been asked to confirm in this chat. The commission cannot be completed
              until they do.
            </p>
          )}

          {viewer === "admin" && (
            <div className={classes.wrap}>
              <label className={classes.label} htmlFor={`off-site-note-${receipt.id}`}>
                How was the receipt confirmed?
              </label>
              <textarea
                className={classes.textarea}
                id={`off-site-note-${receipt.id}`}
                maxLength={500}
                value={notes[receipt.id] ?? ""}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setNotes((current) => ({ ...current, [receipt.id]: value }));
                }}
              />
              <div className={classes.row}>
                <button
                  className={classes.outline}
                  disabled={record.isPending || (notes[receipt.id] ?? "").trim().length < 10}
                  type="button"
                  onClick={() => record.mutate({ receiptId: receipt.id, note: notes[receipt.id] ?? "" })}
                >
                  Record as received
                </button>
              </div>
              <p className={classes.hint}>
                Only when the buyer has confirmed it some other way, for example to support. The
                note is written into the chat.
              </p>
            </div>
          )}
        </section>
      ))}

      {error && (
        <p className={classes.error} role="alert">
          {hasErrorMessage(error) ? error.message : "The answer could not be saved. Reload the page and try again."}
        </p>
      )}
    </div>
  );
};

export default OffSiteReceiptPanel;
