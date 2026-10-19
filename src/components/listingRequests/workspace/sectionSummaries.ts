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

const shortDate = (value: string | null | undefined): string | null => {
  const date = new Date(value ?? "");

  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" }).format(date);
};

export const summarizeAgreement = (
  agreement: {
    status: ListingRequestAgreementStatus;
    version_number: number;
    total_amount: number;
    currency: string;
  } | null,
  emptyText: string
): string =>
  agreement
    ? `v${agreement.version_number} · ${getListingRequestAgreementStatusLabel(agreement.status)} · ${money(agreement.total_amount, agreement.currency)}`
    : emptyText;

export const summarizeSchedule = (
  agreement: {
    currency: string;
    listing_request_payment_schedule_items: Array<{ amount: number; status: string }>;
  } | null
): string => {
  const items = (agreement?.listing_request_payment_schedule_items ?? []).filter(
    (item) => item.status !== "cancelled"
  );

  if (!agreement || items.length === 0) return "No payments scheduled";

  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const paid = items
    .filter((item) => item.status === "paid" || item.status === "waived")
    .reduce((sum, item) => sum + item.amount, 0);
  const dueNow = items.some((item) => item.status === "payment_required");

  return `${money(paid, agreement.currency)} of ${money(total, agreement.currency)} paid${dueNow ? " · payment due" : ""}`;
};

export const summarizeMilestones = (
  milestones: Array<{ status: ListingRequestMilestoneStatus; sort_order: number; title: string }>
): string => {
  if (milestones.length === 0) return "No milestones yet";

  const { done, total } = getRequestMilestoneProgress(milestones);
  const active = getActiveListingRequestMilestone(milestones);

  return active ? `${done} of ${total} complete · Now: ${active.title}` : `All ${total} complete`;
};

export const summarizeChangeOrders = (changeOrders: Array<{ status: string }>): string => {
  const pending = changeOrders.filter((order) => order.status === "sent" || order.status === "draft");

  if (pending.length > 0) return `${pending.length} awaiting a response`;
  if (changeOrders.length === 0) return "None proposed";

  return `${changeOrders.length} on record`;
};

export const summarizeDeliveries = (
  finalDeliveries: Array<{ status: ListingRequestFinalDeliveryStatus; version_number: number }>
): string => {
  const latest = [...finalDeliveries].sort((a, b) => b.version_number - a.version_number)[0];

  return latest
    ? `v${latest.version_number} · ${getListingRequestFinalDeliveryStatusLabel(latest.status)}`
    : "Not submitted yet";
};

export const summarizeProgress = (updates: Array<{ created_at?: string | null }>): string => {
  if (updates.length === 0) return "No updates yet";

  const latest = [...updates].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? "")
  )[0];
  const latestDate = shortDate(latest.created_at);
  const count = `${updates.length} update${updates.length === 1 ? "" : "s"}`;

  return latestDate ? `${count} · latest ${latestDate}` : count;
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

export const workspaceDate = (value: string): string => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
