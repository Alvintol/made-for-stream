import { describe, expect, it } from "vitest";

import {
  getAccountSetupProgress,
  getAccountSetupSteps,
  getNextAccountSetupStep,
  type AccountSetupInput,
} from "../settings/accountSetup";

const input = (overrides: Partial<AccountSetupInput> = {}): AccountSetupInput => ({
  profileReady: false,
  hasLinkedPlatform: false,
  applicationStatus: null,
  payoutsReady: false,
  ...overrides,
});

const states = (value: AccountSetupInput) =>
  Object.fromEntries(getAccountSetupSteps(value).map((step) => [step.key, step.state]));

describe("account setup steps", () => {
  it("starts new accounts on the profile step, with creator access optional and payouts locked", () => {
    const steps = getAccountSetupSteps(input());

    expect(states(input())).toEqual({
      profile: "todo",
      connections: "todo",
      creator: "optional",
      payouts: "locked",
    });
    expect(getNextAccountSetupStep(steps)?.key).toBe("profile");
    expect(getAccountSetupProgress(steps)).toEqual({ done: 0, total: 2 });
  });

  it("has nothing pending for members who have not applied to sell", () => {
    const steps = getAccountSetupSteps(input({ profileReady: true, hasLinkedPlatform: true }));

    expect(getNextAccountSetupStep(steps)).toBeNull();
    expect(getAccountSetupProgress(steps)).toEqual({ done: 2, total: 2 });
  });

  it("moves on to connections once the profile is ready", () => {
    const steps = getAccountSetupSteps(input({ profileReady: true }));

    expect(getNextAccountSetupStep(steps)?.key).toBe("connections");
  });

  it("treats a submitted application as waiting rather than actionable", () => {
    const value = input({ profileReady: true, hasLinkedPlatform: true, applicationStatus: "under_review" });

    expect(states(value).creator).toBe("waiting");
    expect(getNextAccountSetupStep(getAccountSetupSteps(value))).toBeNull();
  });

  it("asks for application changes when reviewers commission them", () => {
    const steps = getAccountSetupSteps(
      input({ profileReady: true, hasLinkedPlatform: true, applicationStatus: "needs_changes" })
    );

    expect(getNextAccountSetupStep(steps)).toMatchObject({
      key: "creator",
      actionLabel: "Update application",
    });
  });

  it("unlocks payouts for approved creators", () => {
    const value = input({ profileReady: true, hasLinkedPlatform: true, applicationStatus: "approved" });
    const steps = getAccountSetupSteps(value);

    expect(states(value).payouts).toBe("todo");
    expect(getNextAccountSetupStep(steps)?.key).toBe("payouts");
    expect(getAccountSetupProgress(steps)).toEqual({ done: 3, total: 4 });
  });

  it("is complete when an approved creator's payouts are ready", () => {
    const steps = getAccountSetupSteps(
      input({ profileReady: true, hasLinkedPlatform: true, applicationStatus: "approved", payoutsReady: true })
    );

    expect(getNextAccountSetupStep(steps)).toBeNull();
    expect(getAccountSetupProgress(steps)).toEqual({ done: 4, total: 4 });
  });

  it("locks creator access for rejected or suspended applications", () => {
    expect(states(input({ applicationStatus: "rejected" })).creator).toBe("locked");
    expect(states(input({ applicationStatus: "suspended" })).creator).toBe("locked");
  });
});
