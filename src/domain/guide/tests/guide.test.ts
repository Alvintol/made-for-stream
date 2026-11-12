import { describe, expect, it } from "vitest";

import { hasMessage } from "../../../lib/i18n/i18n";
import {
  canTakeTour,
  guideProgressCount,
  guideSteps,
  guideTracks,
  type GuideFacts,
  type GuideProgress,
} from "../guide";
import { isTourId, tourHref, tours, type TourId } from "../tours";

const noProgress: GuideProgress = {
  listing_published: false,
  request_received: false,
  commission_delivered: false,
  download_sold: false,
  sale_made: false,
  request_sent: false,
  payment_made: false,
  commission_received: false,
  download_bought: false,
};

const facts = (overrides: Partial<GuideFacts> = {}): GuideFacts => ({
  signedIn: true,
  isCreator: false,
  profileReady: false,
  applicationStatus: null,
  payoutsReady: false,
  progress: noProgress,
  ...overrides,
});

const stateOf = (track: "creators" | "buyers", key: string, input: GuideFacts) =>
  guideSteps[track].find((entry) => entry.key === key)?.state(input);

describe("guide text", () => {
  it("has a title and body for every step, and a label for every link", () => {
    for (const track of guideTracks) {
      for (const entry of guideSteps[track]) {
        expect(hasMessage(`guide.${track}.${entry.key}.title`), `${track}.${entry.key}`).toBe(true);
        expect(hasMessage(`guide.${track}.${entry.key}.body`), `${track}.${entry.key}`).toBe(true);
        if (entry.link) expect(hasMessage(entry.link.label)).toBe(true);
        if (entry.tour) expect(isTourId(entry.tour)).toBe(true);
      }
    }
  });

  it("has a title and body for every tour step", () => {
    for (const [id, tour] of Object.entries(tours)) {
      for (const entry of tour.steps) {
        expect(hasMessage(`tour.${id}.${entry.key}`), `${id}.${entry.key}`).toBe(true);
        expect(hasMessage(`tour.${id}.${entry.key}Text`), `${id}.${entry.key}`).toBe(true);
      }
    }
  });
});

describe("guide steps", () => {
  it("ticks setup steps from the account", () => {
    expect(stateOf("creators", "profile", facts())).toBe("todo");
    expect(stateOf("creators", "profile", facts({ profileReady: true }))).toBe("done");
    expect(stateOf("creators", "payouts", facts({ payoutsReady: true }))).toBe("done");
  });

  it("only explains payouts while payments are locked, and asks for them once open", () => {
    const payouts = guideSteps.creators.find((entry) => entry.key === "payouts");
    const locked = facts({ isCreator: true, paymentsLive: false });
    const open = facts({ isCreator: true, paymentsLive: true });

    expect(stateOf("creators", "payouts", locked)).toBe("read");
    expect(payouts?.body?.(locked)).toBe("bodyClosed");
    expect(hasMessage("guide.creators.payouts.bodyClosed")).toBe(true);
    expect(guideProgressCount("creators", locked).total).toBe(guideProgressCount("creators", open).total - 1);

    expect(stateOf("creators", "payouts", open)).toBe("todo");
    expect(payouts?.body?.(open)).toBe("body");
    // A ready account still shows as done, whatever the switch says.
    expect(stateOf("creators", "payouts", facts({ payoutsReady: true, paymentsLive: false }))).toBe("done");
  });

  it("shows an application under review as waiting, and an approved one as done", () => {
    expect(stateOf("creators", "apply", facts({ applicationStatus: "draft" }))).toBe("todo");
    expect(stateOf("creators", "apply", facts({ applicationStatus: "under_review" }))).toBe("waiting");
    expect(stateOf("creators", "apply", facts({ isCreator: true, applicationStatus: "approved" }))).toBe("done");
  });

  it("ticks activity steps from what the account has done", () => {
    const did = facts({ progress: { ...noProgress, listing_published: true, request_sent: true } });

    expect(stateOf("creators", "listing", did)).toBe("done");
    expect(stateOf("creators", "requests", did)).toBe("todo");
    expect(stateOf("buyers", "request", did)).toBe("done");
  });

  it("counts only steps with something to do", () => {
    const count = guideProgressCount("buyers", facts({ profileReady: true }));
    const actionable = guideSteps.buyers.filter((entry) => entry.state(facts()) !== "read").length;

    expect(count).toEqual({ done: 1, total: actionable });
  });

  it("offers creator tours to creators only, and no tour when signed out", () => {
    expect(canTakeTour("dashboard", facts())).toBe(false);
    expect(canTakeTour("dashboard", facts({ isCreator: true }))).toBe(true);
    expect(canTakeTour("market", facts())).toBe(true);
    expect(canTakeTour("market", facts({ signedIn: false }))).toBe(false);
  });
});

describe("tourHref", () => {
  it("goes to a tour's own page", () => {
    expect(tourHref("dashboard")).toBe("/creator/dashboard?tour=dashboard");
  });

  it("starts a page tour where it is, keeping the page's own address", () => {
    expect(tourHref("creatorRequest" as TourId, "/creator/requests/r1", "?tab=messages")).toBe(
      "/creator/requests/r1?tab=messages&tour=creatorRequest",
    );
  });
});
