import {
  getListingRequestStatusSummary,
  type ListingRequestArchiveContext,
  type ListingRequestCancellationContext,
  type ListingRequestStatus,
} from "../../../domain/listings/listingRequests";
import { useT } from "../../../lib/i18n/i18n";
type RequestStatusNoticeProps = {
  status: ListingRequestStatus;
  reason?: string | null;
  archiveContext?: ListingRequestArchiveContext;
  cancellationContext?: ListingRequestCancellationContext;
};

// Closed requests explain why in the header; open ones rely on the next-step card instead.
const RequestStatusNotice = ({
  status,
  reason,
  archiveContext,
  cancellationContext,
}: RequestStatusNoticeProps) => {
  const t = useT();

  if (status !== "declined" && status !== "archived" && status !== "cancelled")
    return null;

  return (
    <div className={status === "declined" ? "notice noticeError" : "notice noticeNeutral"}>
      <p>
        {getListingRequestStatusSummary(status, archiveContext, cancellationContext, t)}
      </p>
      {status === "declined" && reason && (
        <p className="mt-1">
          <span className="font-semibold">{t("statusNotice.declineReason")}</span>{" "}
          {reason}
        </p>
      )}
    </div>
  );
};

export default RequestStatusNotice;
