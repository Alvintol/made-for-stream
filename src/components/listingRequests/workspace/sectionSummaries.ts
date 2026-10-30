import type { ReactNode } from "react";
import {
  getListingRequestAgreementStatusLabel,
  type ListingRequestAgreementStatus,
} from "../../../domain/listings/listingRequestAgreements";
import {
  getListingRequestFinalDeliveryStatusLabel,
  type ListingRequestFinalDeliveryStatus,
} from "../../../domain/listings/listingRequestFinalDeliveries";
import {
  getActiveListingRequestMilestone,
  type ListingRequestMilestoneStatus,
} from "../../../domain/listings/listingRequestMilestones";
import {
  getRequestMilestoneProgress,
  type RequestWorkspaceSectionId,
} from "../../../domain/listings/requestWorkspace";
import { english, type Translate } from "../../../lib/i18n/i18n";

// Summaries are secondary UI, so malformed amounts or currencies degrade instead of throwing.
const money = (amount: number | null | undefined, currency: string | null | undefined) => {
  const value = Number(amount ?? 0);
  const safeValue = Number.isFinite(value) ? value : 0;

  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: (currency || "CAD").toUpperCase(),
      maximumFractionDigits: safeValue % 1 === 0 ? 0 : 2,
    }).format(safeValue);
  } catch {
    return `${safeValue}`;
  }
};

const shortDate = (value: string | null | undefined, language: string): string | null => {
  const date = new Date(value ?? "");

  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(language, { month: "short", day: "numeric" }).format(date);
};

export const summarizeAgreement = (
  agreement: {
    status: ListingRequestAgreementStatus;
    version_number: number;
    total_amount: number;
    currency: string;
  } | null,
  emptyText: string,
  t: Translate = english
): string =>
  agreement
    ? `v${agreement.version_number} · ${getListingRequestAgreementStatusLabel(agreement.status, t)} · ${money(agreement.total_amount, agreement.currency)}`
    : emptyText;

export const summarizeSchedule = (
  agreement: {
    currency: string;
    listing_request_payment_schedule_items: Array<{ amount: number; status: string }>;
  } | null,
  t: Translate = english
): string => {
  const items = (agreement?.listing_request_payment_schedule_items ?? []).filter(
    (item) => item.status !== "cancelled"
  );

  if (!agreement || items.length === 0) return t("summary.noPayments");

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const paid = items
    .filter((item) => item.status === "paid" || item.status === "waived")
    .reduce((sum, item) => sum + item.amount, 0);
  const dueNow = items.some((item) => item.status === "payment_required");

  const paidText = t("summary.paid", {
    paid: money(paid, agreement.currency),
    total: money(total, agreement.currency),
  });

  return dueNow ? `${paidText} · ${t("summary.paymentDue")}` : paidText;
};

export const summarizeMilestones = (
  milestones: Array<{ status: ListingRequestMilestoneStatus; sort_order: number; title: string }>,
  t: Translate = english
): string => {
  if (milestones.length === 0) return t("milestones.emptyTitle");

  const { done, total } = getRequestMilestoneProgress(milestones);
  const active = getActiveListingRequestMilestone(milestones);

  return active
    ? t("summary.milestonesNow", { done, total, title: active.title })
    : t("summary.milestonesAll", { total });
};

export const summarizeChangeOrders = (
  changeOrders: Array<{ status: string }>,
  t: Translate = english
): string => {
  const pending = changeOrders.filter((order) => order.status === "sent" || order.status === "draft");

  if (pending.length > 0) return t("summary.changeOrdersPending", { count: pending.length });
  if (changeOrders.length === 0) return t("summary.changeOrdersNone");

  return t("summary.changeOrdersOnRecord", { count: changeOrders.length });
};

export const summarizeDeliveries = (
  finalDeliveries: Array<{ status: ListingRequestFinalDeliveryStatus; version_number: number }>,
  t: Translate = english
): string => {
  const latest = [...finalDeliveries].sort((a, b) => b.version_number - a.version_number)[0];

  return latest
    ? `v${latest.version_number} · ${getListingRequestFinalDeliveryStatusLabel(latest.status, t)}`
    : t("summary.deliveryNone");
};

export const summarizeProgress = (
  updates: Array<{ created_at?: string | null }>,
  t: Translate = english,
  language = "en-CA"
): string => {
  if (updates.length === 0) return t("summary.updatesNone");

  const latest = [...updates].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
  )[0];
  const latestDate = shortDate(latest.created_at, language);
  const count = t("summary.updates", { count: updates.length });

  return latestDate ? t("summary.updatesLatest", { updates: count, date: latestDate }) : count;
};

export type WorkspaceSectionSpec = {
  id: RequestWorkspaceSectionId;
  title: string;
  summary: string;
  content: ReactNode;
  visible?: boolean;
  attention?: boolean;
  defaultOpen?: boolean;
};

// Sections needing the viewer float to the top; the rest keep their lifecycle order.
export const orderSections = (
  sections: WorkspaceSectionSpec[],
  order: RequestWorkspaceSectionId[]
): WorkspaceSectionSpec[] =>
  sections
    .filter((section) => section.visible !== false)
    .sort(
      (a, b) =>
        Number(Boolean(b.attention)) - Number(Boolean(a.attention)) ||
        order.indexOf(a.id) - order.indexOf(b.id)
    );

export const getSectionOrder = (requestStatus: string): RequestWorkspaceSectionId[] =>
  requestStatus === "submitted"
    ? ["request", "snapshot", "agreement", "payments", "milestones", "delivery", "changeOrders", "progress"]
    : requestStatus === "completed"
      ? ["delivery", "milestones", "payments", "changeOrders", "progress", "agreement", "request", "snapshot"]
      : ["milestones", "delivery", "payments", "changeOrders", "progress", "agreement", "request", "snapshot"];

export const workspaceDate = (value: string, language?: string): string => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(language, { year: "numeric", month: "short", day: "numeric" });
};

// Sections open for everyone when the next step lives there; only the owner sees the attention flag.
// Nothing auto-opens while data is loading, so sections don't flash open for a provisional step.
export const getSectionFlags = (
  step: { owner: string | null; sectionId?: RequestWorkspaceSectionId },
  viewer: string,
  options: { readOnly: boolean; isLoading: boolean }
) => (id: RequestWorkspaceSectionId) => {
  const isStepSection = !options.isLoading && step.sectionId === id;

  return {
    defaultOpen: isStepSection,
    attention: isStepSection && !options.readOnly && step.owner !== null && step.owner === viewer,
  };
};
