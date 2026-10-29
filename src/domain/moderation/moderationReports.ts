export type ModerationReportTargetType =
  | "conversation"
  | "conversation_message"
  | "listing"
  | "profile";

export type ModerationReportReasonCode =
  | "spam"
  | "harassment"
  | "scam_or_suspicious"
  | "inappropriate_content"
  | "unsolicited_images"
  | "off_platform_payment"
  | "misleading_listing"
  | "stolen_or_copied_work"
  | "impersonation"
  | "policy_violation"
  | "other";

export type ModerationReportStatus =
  | "submitted"
  | "reviewing"
  | "needs_more_info"
  | "action_taken"
  | "resolved"
  | "dismissed";

export type ModerationReportResolutionCode =
  | "warning_issued"
  | "content_removed"
  | "conversation_locked"
  | "account_restricted"
  | "no_violation_found"
  | "insufficient_information"
  | "duplicate_report"
  | "other";

export const conversationModerationReportReasonOptions: Array<{
  value: ModerationReportReasonCode;
  label: string;
}> = [
    { value: "spam", label: "Spam or repeated unwanted messages" },
    { value: "harassment", label: "Harassment or abusive behaviour" },
    { value: "scam_or_suspicious", label: "Scam or suspicious behaviour" },
    { value: "inappropriate_content", label: "Inappropriate, mature or adult content" },
    { value: "unsolicited_images", label: "Unsolicited images or references" },
    { value: "off_platform_payment", label: "Asked to move payment off-platform" },
    { value: "policy_violation", label: "Illegal, or against another Made for Stream rule" },
    { value: "other", label: "Other" },
  ];

export const moderationReportStatusOptions: Array<{
  value: ModerationReportStatus;
  label: string;
}> = [
    { value: "submitted", label: "Submitted" },
    { value: "reviewing", label: "Under review" },
    { value: "needs_more_info", label: "Needs more info" },
    { value: "action_taken", label: "Action taken" },
    { value: "resolved", label: "Resolved" },
    { value: "dismissed", label: "Dismissed" },
  ];

export const moderationReportResolutionOptions: Array<{
  value: ModerationReportResolutionCode;
  label: string;
}> = [
    { value: "warning_issued", label: "Warning issued" },
    { value: "content_removed", label: "Content removed" },
    { value: "conversation_locked", label: "Conversation locked" },
    { value: "account_restricted", label: "Account restricted" },
    { value: "no_violation_found", label: "No violation found" },
    { value: "insufficient_information", label: "Insufficient information" },
    { value: "duplicate_report", label: "Duplicate report" },
    { value: "other", label: "Other" },
  ];


export const moderationReportReasonOptions: Array<{
  value: ModerationReportReasonCode;
  label: string;
}> = [
    { value: "spam", label: "Spam or repeated unwanted messages" },
    { value: "harassment", label: "Harassment or abusive behaviour" },
    { value: "scam_or_suspicious", label: "Scam or suspicious behaviour" },
    { value: "inappropriate_content", label: "Inappropriate, mature or adult content" },
    { value: "unsolicited_images", label: "Unsolicited images or references" },
    { value: "off_platform_payment", label: "Asked to move payment off-platform" },
    { value: "misleading_listing", label: "Misleading listing" },
    { value: "stolen_or_copied_work", label: "Stolen or copied work" },
    { value: "impersonation", label: "Impersonation" },
    { value: "policy_violation", label: "Illegal, or against another Made for Stream rule" },
    { value: "other", label: "Other" },
  ];

// The note above every report form's submit button is report.submitNote in
// lib/i18n: a notice of illegal content must explain why it is illegal and
// carry the sender's statement that it is accurate (EU Digital Services Act
// article 16). report.withoutAccountNote tells someone signed out that they
// can report by email (Terms section 10).

export const getModerationReportTargetTypeLabel = (
  targetType: ModerationReportTargetType
): string =>
  targetType === "conversation"
    ? "Conversation report"
    : targetType === "conversation_message"
      ? "Message report"
      : targetType === "listing"
        ? "Listing report"
        : "Profile report";

export const getModerationReportStatusLabel = (
  status: ModerationReportStatus
): string =>
  moderationReportStatusOptions.find((option) => option.value === status)
    ?.label ?? "Unknown status";

export const getModerationReportStatusSummary = (
  status: ModerationReportStatus
): string =>
  status === "submitted"
    ? "Your report has been received."
    : status === "reviewing"
      ? "An admin is reviewing this report."
      : status === "needs_more_info"
        ? "An admin needs more information from you."
        : status === "action_taken"
          ? "An admin reviewed this report and took appropriate action."
          : status === "resolved"
            ? "This report has been reviewed and resolved."
            : "This report was reviewed and dismissed.";

export const getModerationReportReasonLabel = (
  reasonCode: ModerationReportReasonCode
): string =>
  moderationReportReasonOptions.find(
    (option) => option.value === reasonCode
  )?.label ?? "Unknown reason";

export const getModerationReportResolutionLabel = (
  resolutionCode: ModerationReportResolutionCode | null
): string =>
  resolutionCode
    ? moderationReportResolutionOptions.find(
      (option) => option.value === resolutionCode
    )?.label ?? "Unknown resolution"
    : "No resolution selected";