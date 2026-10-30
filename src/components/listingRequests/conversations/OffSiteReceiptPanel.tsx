import { useState } from "react";

import { offSiteSubjectText } from "../../../domain/conversations/conversations";
import { describeOffSiteDelivery } from "../../../domain/listings/offSiteDelivery";
import {
  useAdminRecordOffSiteReceipt,
  useOffSiteReceipts,
  useRespondOffSiteReceipt,
  type OffSiteReceiptRow,
} from "../../../hooks/conversations/useOffSiteReceipts";
import { hasErrorMessage } from "../../../lib/errorMessage";
import { useT } from "../../../lib/i18n/i18n";
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
  const t = useT();
  const { data: receipts = [] } = useOffSiteReceipts(requestId);
  const respond = useRespondOffSiteReceipt(requestId);
  const record = useAdminRecordOffSiteReceipt(requestId);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const open = receipts.filter((receipt) => receipt.status !== "received");

  if (open.length === 0) return null;

  const error = respond.error ?? record.error;

  const describe = (receipt: OffSiteReceiptRow) =>
    t("offSiteReceipt.says", {
      creator: creatorName,
      subject: offSiteSubjectText(receipt.subject, t),
      methods: describeOffSiteDelivery(receipt.methods, receipt.other, t) ?? t("offSiteReceipt.anotherWay"),
    });

  return (
    <div className={classes.anchor} id={OFF_SITE_RECEIPTS_TARGET} tabIndex={-1}>
      {open.map((receipt) => (
        <section className={classes.card} key={receipt.id} aria-label={t("offSiteReceipt.label")}>
          <h3 className={classes.title}>
            {t(viewer === "buyer" ? "offSiteReceipt.titleBuyer" : "offSiteReceipt.titleOther")}
          </h3>

          <p className={classes.text}>{describe(receipt)}</p>

          {receipt.status === "not_received" && (
            <p className={classes.text}>
              {viewer === "buyer"
                ? t("offSiteReceipt.notArrivedBuyer")
                : `${t("offSiteReceipt.notArrived", { buyer: buyerName })} ${viewer === "creator" ? t("offSiteReceipt.notArrivedCreator") : ""}`}
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
                  {t("offSiteReceipt.received")}
                </button>

                {receipt.status === "awaiting" && (
                  <button
                    className={classes.outline}
                    disabled={respond.isPending}
                    type="button"
                    onClick={() => respond.mutate({ receiptId: receipt.id, received: false })}
                  >
                    {t("offSiteReceipt.notArrivedButton")}
                  </button>
                )}
              </div>

              <p className={classes.hint}>
                {t("deliveryReview.offSiteFirst")} {t("offSiteReceipt.answerNote")}
              </p>
            </>
          )}

          {viewer === "creator" && receipt.status === "awaiting" && (
            <p className={classes.hint}>
              {t("offSiteReceipt.creatorHint", { buyer: buyerName })}
            </p>
          )}

          {viewer === "admin" && (
            <div className={classes.wrap}>
              <label className={classes.label} htmlFor={`off-site-note-${receipt.id}`}>
                {t("offSiteReceipt.adminLabel")}
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
                  {t("offSiteReceipt.adminRecord")}
                </button>
              </div>
              <p className={classes.hint}>
                {t("offSiteReceipt.adminHint")}
              </p>
            </div>
          )}
        </section>
      ))}

      {error && (
        <p className={classes.error} role="alert">
          {hasErrorMessage(error) ? error.message : t("offSiteReceipt.saveFailed")}
        </p>
      )}
    </div>
  );
};

export default OffSiteReceiptPanel;
