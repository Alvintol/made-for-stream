import { english, type Translate } from "../../lib/i18n/i18n";

export type AccountSetupStepKey = "profile" | "connections" | "creator" | "payouts";

// optional: available but not expected of every member (e.g. applying to sell).
export type AccountSetupStepState = "done" | "todo" | "waiting" | "locked" | "optional";

export type AccountSetupStep = {
  key: AccountSetupStepKey;
  label: string;
  detail: string;
  state: AccountSetupStepState;
  actionLabel: string;
};

export type AccountSetupInput = {
  profileReady: boolean;
  hasLinkedPlatform: boolean;
  applicationStatus:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "rejected"
    | "needs_changes"
    | "suspended"
    | null;
  payoutsReady: boolean;
};

const creatorStep = (
  status: AccountSetupInput["applicationStatus"],
  t: Translate
): AccountSetupStep => {
  const base = { key: "creator" as const, label: t("setup.creator") };

  switch (status) {
    case "approved":
      return { ...base, state: "done", detail: t("setup.creatorApproved"), actionLabel: t("setup.viewAccess") };
    case "submitted":
    case "under_review":
      return {
        ...base,
        state: "waiting",
        detail: t("setup.creatorReview"),
        actionLabel: t("setup.viewApplication"),
      };
    case "needs_changes":
      return { ...base, state: "todo", detail: t("setup.creatorChanges"), actionLabel: t("setup.updateApplication") };
    case "draft":
      return { ...base, state: "todo", detail: t("setup.creatorDraft"), actionLabel: t("setup.continueApplication") };
    case "rejected":
    case "suspended":
      return {
        ...base,
        state: "locked",
        detail: t(status === "rejected" ? "setup.creatorRejected" : "setup.creatorSuspended"),
        actionLabel: t("setup.viewStatus"),
      };
    default:
      return { ...base, state: "optional", detail: t("setup.creatorApply"), actionLabel: t("apply.start") };
  }
};

// Ordered setup steps for the settings checklist; later steps depend on earlier ones.
export const getAccountSetupSteps = (
  input: AccountSetupInput,
  t: Translate = english
): AccountSetupStep[] => {
  const isCreator = input.applicationStatus === "approved";

  return [
    {
      key: "profile",
      label: t("setup.profile"),
      state: input.profileReady ? "done" : "todo",
      detail: t(input.profileReady ? "setup.profileDone" : "setup.profileTodo"),
      actionLabel: t("setup.editProfile"),
    },
    {
      key: "connections",
      label: t("setup.connections"),
      state: input.hasLinkedPlatform ? "done" : "todo",
      detail: t(input.hasLinkedPlatform ? "setup.connectionsDone" : "setup.connectionsTodo"),
      actionLabel: t("setup.connect"),
    },
    creatorStep(input.applicationStatus, t),
    {
      key: "payouts",
      label: t("setup.payouts"),
      state: !isCreator ? "locked" : input.payoutsReady ? "done" : "todo",
      detail: t(
        !isCreator
          ? "setup.payoutsLocked"
          : input.payoutsReady
            ? "setup.payoutsDone"
            : "setup.payoutsTodo"
      ),
      actionLabel: t("setup.setUpPayouts"),
    },
  ];
};

// The first step the viewer can act on, or null when nothing is pending.
export const getNextAccountSetupStep = (steps: AccountSetupStep[]): AccountSetupStep | null =>
  steps.find((step) => step.state === "todo") ?? null;

export const getAccountSetupProgress = (steps: AccountSetupStep[]) => {
  const applicable = steps.filter((step) => step.state !== "locked" && step.state !== "optional");

  return {
    done: applicable.filter((step) => step.state === "done").length,
    total: applicable.length,
  };
};
