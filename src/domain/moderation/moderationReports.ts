import { english, hasMessage, type Translate } from "../../lib/i18n/i18n";

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
    { value: "submitted", label: english("modReport.status.submitted") },
    { value: "reviewing", label: english("modReport.status.reviewing") },
    { value: "needs_more_info", label: english("modReport.status.needs_more_info") },
    { value: "action_taken", label: english("modReport.status.action_taken") },
    { value: "resolved", label: english("modReport.status.resolved") },
    { value: "dismissed", label: english("modReport.status.dismissed") },
  ];

export const moderationReportResolutionOptions: Array<{
  value: ModerationReportResolutionCode;
  label: string;
}> = [
    { value: "warning_issued", label: english("modReport.resolution.warning_issued") },
    { value: "content_removed", label: english("modReport.resolution.content_removed") },
    { value: "conversation_locked", label: english("modReport.resolution.conversation_locked") },
    { value: "account_restricted", label: english("modReport.resolution.account_restricted") },
    { value: "no_violation_found", label: english("modReport.resolution.no_violation_found") },
    { value: "insufficient_information", label: english("modReport.resolution.insufficient_information") },
    { value: "duplicate_report", label: english("modReport.resolution.duplicate_report") },
    { value: "other", label: english("modReport.resolution.other") },
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
  targetType: ModerationReportTargetType,
  t: Translate = english
): string => t(`modReport.target.${targetType}`);

export const getModerationReportStatusLabel = (
  status: ModerationReportStatus,
  t: Translate = english
): string => {
  const key = `modReport.status.${status}`;

  return hasMessage(key) ? t(key) : t("modReport.status.unknown");
};

export const getModerationReportStatusSummary = (
  status: ModerationReportStatus,
  t: Translate = english
): string =>
  status === "submitted"
    ? t("modReport.summary.submitted")
    : status === "reviewing"
      ? t("modReport.summary.reviewing")
      : status === "needs_more_info"
        ? t("modReport.summary.needs_more_info")
        : status === "action_taken"
          ? t("modReport.summary.action_taken")
          : status === "resolved"
            ? t("modReport.summary.resolved")
            : t("modReport.summary.dismissed");

export const getModerationReportReasonLabel = (
  reasonCode: ModerationReportReasonCode,
  t: Translate = english
): string => {
  const key = `report.reason.${reasonCode}`;

  return hasMessage(key) ? t(key) : t("modReport.reasonUnknown");
};

export const getModerationReportResolutionLabel = (
  resolutionCode: ModerationReportResolutionCode | null,
  t: Translate = english
): string => {
  if (!resolutionCode) return t("modReport.resolutionNone");

  const key = `modReport.resolution.${resolutionCode}`;

  return hasMessage(key) ? t(key) : t("modReport.resolutionUnknown");
};