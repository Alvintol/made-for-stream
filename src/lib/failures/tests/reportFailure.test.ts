import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../supabaseClient", () => ({ supabase: { rpc: mocks.rpc } }));

import { getFailureRoute, reportFailure } from "../reportFailure";

describe("reportFailure", () => {
  beforeEach(() => {
    mocks.rpc.mockReset().mockReturnValue(Promise.resolve({ error: null }));
  });

  it("takes ids out of the page address, so every commission page is one place", () => {
    expect(
      getFailureRoute("/creator/requests/4fb4b602-73f1-474f-9ef8-7d55ce1cfa9a"),
    ).toBe("/creator/requests/:id");
    expect(getFailureRoute("/settings/personal")).toBe("/settings/personal");
  });

  it("sends the database's own message and code, as Supabase hands them back", () => {
    reportFailure(
      "action",
      { message: "This change order is not available for your response.", code: "P0001" },
      undefined,
    );

    expect(mocks.rpc).toHaveBeenCalledWith("log_app_failure", {
      p_source: "action",
      p_message: "This change order is not available for your response.",
      p_code: "P0001",
      p_route: getFailureRoute(window.location.pathname),
      p_label: null,
    });
  });

  it("names what was being loaded when a page load fails", () => {
    reportFailure("load", new Error("column x does not exist"), "listingRequestMilestones");

    expect(mocks.rpc).toHaveBeenCalledWith(
      "log_app_failure",
      expect.objectContaining({
        p_source: "load",
        p_message: "column x does not exist",
        p_label: "listingRequestMilestones",
      }),
    );
  });

  it("never throws, even when the log itself cannot be reached", () => {
    mocks.rpc.mockImplementation(() => {
      throw new Error("offline");
    });

    expect(() => reportFailure("action", new Error("boom"))).not.toThrow();
  });
});
