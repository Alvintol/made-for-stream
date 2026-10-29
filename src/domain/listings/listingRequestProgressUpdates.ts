import type { ListingRequestAgreementRow } from "../../hooks/creatorRequests/useListingRequestAgreement";
import type { ListingRequestProgressUpdateRow } from "../../hooks/creatorRequests/useListingRequestProgressUpdates";
import { english, type Translate } from "../../lib/i18n/i18n";

export type ListingRequestProgressUpdateScheduleStatus =
  | "not_started"
  | "upcoming"
  | "due_soon"
  | "overdue"
  | "satisfied";

export type ListingRequestProgressUpdateSchedule = {
  status: ListingRequestProgressUpdateScheduleStatus;
  nextUpdateDueAt: string | null;
  lastUpdateAt: string | null;
  completedUpdateCount: number;
  summary: string;
};

type ProgressUpdateScheduleAgreement = Pick<
  ListingRequestAgreementRow,
  | "status"
  | "starting_payment_status"
  | "minimum_update_rule"
  | "first_update_due_days"
  | "update_frequency_days"
  | "estimated_start_at"
  | "adjusted_estimated_completion_at"
>;

type ProgressUpdateScheduleRow = Pick<
  ListingRequestProgressUpdateRow,
  "created_at"
>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DUE_SOON_DAYS = 2;

const addCalendarDays = (
  isoDate: string,
  daysToAdd: number
): string | null => {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setUTCDate(date.getUTCDate() + daysToAdd);

  return date.toISOString();
};

const getValidUpdateDates = (
  updates: ProgressUpdateScheduleRow[]
): Date[] =>
  updates
    .map((update) => new Date(update.created_at))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort(
      (firstDate, secondDate) =>
        firstDate.getTime() - secondDate.getTime()
    );

const getScheduleStatus = (
  dueAt: string,
  now: Date
): ListingRequestProgressUpdateScheduleStatus => {
  const dueDate = new Date(dueAt);

  if (Number.isNaN(dueDate.getTime())) {
    return "upcoming";
  }

  const millisecondsUntilDue =
    dueDate.getTime() - now.getTime();

  if (millisecondsUntilDue < 0) {
    return "overdue";
  }

  return millisecondsUntilDue <= DUE_SOON_DAYS * MS_PER_DAY
    ? "due_soon"
    : "upcoming";
};

const getWeeklySummary = (
  status: ListingRequestProgressUpdateScheduleStatus,
  t: Translate
): string =>
  status === "overdue"
    ? t("updateSchedule.weeklyOverdue")
    : status === "due_soon"
      ? t("updateSchedule.weeklyDueSoon")
      : t("updateSchedule.weeklyScheduled");

export const getListingRequestProgressUpdateSchedule = (input: {
  agreement: ProgressUpdateScheduleAgreement;
  updates: ProgressUpdateScheduleRow[];
  now?: Date;
  t?: Translate;
}): ListingRequestProgressUpdateSchedule => {
  const { agreement, updates, t = english } = input;
  const now = input.now ?? new Date();
  const validUpdateDates = getValidUpdateDates(updates);
  const lastUpdateDate =
    validUpdateDates.at(-1) ?? null;
  const lastUpdateAt =
    lastUpdateDate?.toISOString() ?? null;

  if (
    agreement.status !== "buyer_accepted" ||
    agreement.starting_payment_status ===
      "payment_required" ||
    !agreement.estimated_start_at
  ) {
    return {
      status: "not_started",
      nextUpdateDueAt: null,
      lastUpdateAt,
      completedUpdateCount: validUpdateDates.length,
      summary: t("updateSchedule.notStarted"),
    };
  }

  if (
    agreement.minimum_update_rule ===
    "single_progress_update"
  ) {
    if (validUpdateDates.length > 0) {
      return {
        status: "satisfied",
        nextUpdateDueAt: null,
        lastUpdateAt,
        completedUpdateCount: validUpdateDates.length,
        summary: t("updateSchedule.singleDone"),
      };
    }

    const dueAt =
      agreement.adjusted_estimated_completion_at;

    const status = getScheduleStatus(dueAt, now);

    return {
      status,
      nextUpdateDueAt: dueAt,
      lastUpdateAt: null,
      completedUpdateCount: 0,
      summary:
        status === "overdue"
          ? t("updateSchedule.singleOverdue")
          : status === "due_soon"
            ? t("updateSchedule.singleDueSoon")
            : t("updateSchedule.singleRequired"),
    };
  }

  const firstUpdateDueDays =
    agreement.first_update_due_days ?? 5;

  const updateFrequencyDays =
    agreement.update_frequency_days ?? 7;

  const nextUpdateDueAt = lastUpdateDate
    ? addCalendarDays(
        lastUpdateDate.toISOString(),
        updateFrequencyDays
      )
    : addCalendarDays(
        agreement.estimated_start_at,
        firstUpdateDueDays
      );

  if (!nextUpdateDueAt) {
    return {
      status: "upcoming",
      nextUpdateDueAt: null,
      lastUpdateAt,
      completedUpdateCount: validUpdateDates.length,
      summary: t("updateSchedule.unknownDate"),
    };
  }

  const status = getScheduleStatus(
    nextUpdateDueAt,
    now
  );

  return {
    status,
    nextUpdateDueAt,
    lastUpdateAt,
    completedUpdateCount: validUpdateDates.length,
    summary: getWeeklySummary(status, t),
  };
};