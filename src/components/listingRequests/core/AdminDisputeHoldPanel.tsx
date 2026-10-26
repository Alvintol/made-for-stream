import { useState } from "react";

import {
  useCommissionImageRetention,
  useSetCommissionDisputeHold,
} from "../../../hooks/admin/useCommissionDisputeHold";
import { hasErrorMessage } from "../../../lib/errorMessage";
import KeptPlaceholder from "../../ui/KeptPlaceholder";

type AdminDisputeHoldPanelProps = {
  requestId: string;
};

const classes = {
  card: "card space-y-4 p-6",
  title: "font-display text-base font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  held: "notice noticeWarning",
  field: "space-y-2",
  label: "formLabel",
  input: "formControl",
  error: "notice noticeError",
  actions: "flex flex-wrap items-center gap-3",
  btnPrimary: "btnPrimary",
  btnOutline: "btnOutline",
} as const;

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value));

// Admin only. Marks a commission as in dispute, which stops its images from
// being deleted by the 180-day rule until the dispute is ended here. The
// database decides who may do this and keeps the record.
const AdminDisputeHoldPanel = ({ requestId }: AdminDisputeHoldPanelProps) => {
  const retentionQuery = useCommissionImageRetention(requestId);
  const setHold = useSetCommissionDisputeHold(requestId);
  const [reason, setReason] = useState("");

  const retention = retentionQuery.data ?? null;
  const inDispute = Boolean(retention?.on_hold);
  const trimmedReason = reason.trim();

  const status = retention?.deleted_at
    ? `This commission's images were deleted on ${formatDate(retention.deleted_at)}. A hold cannot bring them back.`
    : retention?.delete_after
      ? `This commission is closed. Its images are due to be deleted on ${formatDate(retention.delete_after)}.`
      : "Images are deleted 180 days after a commission closes. This one has no deletion date yet: it is still open, or it has no images.";

  return (
    <div className={classes.card}>
      <h2 className={classes.title}>Dispute hold</h2>

      <p className={classes.text}>
        {status} Marking a commission as in dispute keeps its images until you end the
        dispute here; they are then kept at least 30 more days.
      </p>

      {inDispute && (
        <div className={classes.held}>
          In dispute{retention?.hold_placed_at ? ` since ${formatDate(retention.hold_placed_at)}` : ""}:{" "}
          {retention?.hold_reason}
        </div>
      )}

      {setHold.error && (
        <div className={classes.error} role="alert">
          {hasErrorMessage(setHold.error)
            ? setHold.error.message
            : "The dispute hold could not be changed."}
        </div>
      )}

      {inDispute ? (
        <div className={classes.actions}>
          <button
            className={classes.btnOutline}
            disabled={setHold.isPending}
            type="button"
            onClick={() => setHold.mutate({ inDispute: false })}
          >
            {setHold.isPending ? "Ending dispute…" : "End dispute"}
          </button>
        </div>
      ) : (
        !retention?.deleted_at && (
          <>
            <div className={classes.field}>
              <label className={classes.label} htmlFor="dispute-hold-reason">
                Why is this commission in dispute?
              </label>

              <KeptPlaceholder>
              <input
                className={classes.input}
                id="dispute-hold-reason"
                maxLength={500}
                placeholder="Chargeback opened by the buyer's bank on 12 January"
                type="text"
                value={reason}
                onChange={(event) => setReason(event.currentTarget.value)}
              />
              </KeptPlaceholder>
            </div>

            <div className={classes.actions}>
              <button
                className={classes.btnPrimary}
                disabled={setHold.isPending || trimmedReason.length < 5}
                type="button"
                onClick={() =>
                  setHold.mutate(
                    { inDispute: true, reason: trimmedReason },
                    { onSuccess: () => setReason("") },
                  )
                }
              >
                {setHold.isPending ? "Marking as in dispute…" : "Mark as in dispute"}
              </button>
            </div>
          </>
        )
      )}
    </div>
  );
};

export default AdminDisputeHoldPanel;
