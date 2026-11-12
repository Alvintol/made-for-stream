import { describe, expect, it, vi } from "vitest";
import {
  alertNewCreatorApplications,
  describeOfferings,
  isAwaitingAdminAlert,
  renderNewCreatorApplicationAlert,
} from "../creatorApplicationAlerts.js";

const application = (overrides = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  profile_user_id: "user-1",
  status: "submitted",
  submitted_at: "2026-11-12T10:00:00.000Z",
  reviewed_at: null,
  admin_alerted_at: null,
  ...overrides,
});

// A stand-in for the Supabase client: each from(table) records its filters
// and resolves to whatever `respond` returns for that table and operation.
const fakeSupabase = (respond) => {
  const calls = [];

  return {
    calls,
    from: (table) => {
      const call = { table, op: "select", filters: [], patch: null };
      calls.push(call);

      const builder = {
        select: () => builder,
        order: () => builder,
        limit: () => builder,
        update: (patch) => {
          call.op = "update";
          call.patch = patch;
          return builder;
        },
        eq: (column, value) => {
          call.filters.push(["eq", column, value]);
          return builder;
        },
        is: (column, value) => {
          call.filters.push(["is", column, value]);
          return builder;
        },
        maybeSingle: () => Promise.resolve(respond(call)),
        then: (resolve, reject) => Promise.resolve(respond(call)).then(resolve, reject),
      };

      return builder;
    },
  };
};

const profile = {
  handle: "Guffball",
  display_name: "Guffball",
  offering_types: ["emotes", "other"],
  offering_other: "Logo design",
};

const respondWith = ({ candidates, claimed = [{ id: "claimed" }] }) => (call) => {
  if (call.table === "seller_applications" && call.op === "select") return { data: candidates, error: null };
  if (call.table === "seller_applications" && call.op === "update") {
    // The claim sets a time; the release puts the old value back.
    return { data: call.patch.admin_alerted_at ? claimed : null, error: null };
  }
  if (call.table === "profiles") return { data: profile, error: null };
  if (call.table === "profile_platform_accounts") {
    return { data: [{ platform: "twitch", platform_login: "guffball", profile_url: "https://twitch.tv/guffball" }], error: null };
  }
  if (call.table === "seller_application_samples") return { count: 3, error: null };
  return { data: null, error: null };
};

const run = (supabaseAdmin, sendEmail, extra = {}) =>
  alertNewCreatorApplications({
    supabaseAdmin,
    sendEmail,
    to: "ops@madeforstream.com",
    siteUrl: "https://madeforstream.com",
    now: () => "2026-11-12T10:00:05.000Z",
    ...extra,
  });

describe("isAwaitingAdminAlert", () => {
  it("is due for a submission that was never alerted", () => {
    expect(isAwaitingAdminAlert(application())).toBe(true);
  });

  it("is not due once this submission was alerted", () => {
    expect(isAwaitingAdminAlert(application({ admin_alerted_at: "2026-11-12T10:00:05.000Z" }))).toBe(false);
  });

  it("is due again when it was resubmitted after the last alert", () => {
    expect(
      isAwaitingAdminAlert(
        application({ admin_alerted_at: "2026-11-01T09:00:00.000Z", submitted_at: "2026-11-12T10:00:00.000Z" }),
      ),
    ).toBe(true);
  });

  it("is never due for a draft or a decided application", () => {
    expect(isAwaitingAdminAlert(application({ status: "draft" }))).toBe(false);
    expect(isAwaitingAdminAlert(application({ status: "approved" }))).toBe(false);
  });
});

describe("the email", () => {
  it("says who applied, what they'll offer, their channels, and links to the review", () => {
    const email = renderNewCreatorApplicationAlert({
      application: application(),
      profile: { ...profile, display_name: "Guff Ball" },
      platforms: [{ platform: "twitch", platform_login: "guffball", profile_url: "https://twitch.tv/guffball" }],
      sampleCount: 3,
      siteUrl: "https://madeforstream.com",
    });

    expect(email.subject).toBe("[Made for Stream ops] New creator application: Guff Ball (@Guffball)");
    expect(email.text).toContain("Plans to offer: Emotes, Something else: Logo design");
    expect(email.text).toContain("Work samples: 3");
    expect(email.text).toContain("Twitch @guffball: https://twitch.tv/guffball");
    expect(email.text).toContain(
      "https://madeforstream.com/admin/creator-applications?application=11111111-1111-4111-8111-111111111111",
    );
    expect(email.html).toContain("Review the application");
  });

  it("marks dev's emails and resubmissions", () => {
    const email = renderNewCreatorApplicationAlert({
      application: application({ reviewed_at: "2026-11-10T00:00:00.000Z" }),
      profile,
      siteUrl: "https://dev.madeforstream.com",
    });

    expect(email.subject).toBe("[Made for Stream dev ops] Creator application resubmitted: Guffball (@Guffball)");
    expect(email.text).toContain("No linked Twitch or YouTube account.");
  });

  it("describes offerings in the site's order", () => {
    expect(describeOfferings(["games", "emotes"], null)).toBe("Emotes, Games");
    expect(describeOfferings([], null)).toBe("Not chosen");
    expect(describeOfferings(["other"], "")).toBe("Something else");
  });
});

describe("alertNewCreatorApplications", () => {
  it("claims the application, then sends one email to the team", async () => {
    const supabaseAdmin = fakeSupabase(respondWith({ candidates: [application()] }));
    const sendEmail = vi.fn().mockResolvedValue({ status: "sent" });

    await expect(run(supabaseAdmin, sendEmail)).resolves.toEqual({ sent: 1, failed: 0, skipped: 0 });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toEqual(expect.objectContaining({ to: "ops@madeforstream.com" }));

    const claim = supabaseAdmin.calls.find((call) => call.op === "update");
    expect(claim.patch).toEqual({ admin_alerted_at: "2026-11-12T10:00:05.000Z" });
    expect(claim.filters).toContainEqual(["is", "admin_alerted_at", null]);
  });

  it("sends nothing when another attempt claimed it first", async () => {
    const supabaseAdmin = fakeSupabase(respondWith({ candidates: [application()], claimed: [] }));
    const sendEmail = vi.fn();

    await expect(run(supabaseAdmin, sendEmail)).resolves.toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips one already alerted for this submission", async () => {
    const supabaseAdmin = fakeSupabase(
      respondWith({ candidates: [application({ admin_alerted_at: "2026-11-12T10:00:05.000Z" })] }),
    );
    const sendEmail = vi.fn();

    await expect(run(supabaseAdmin, sendEmail)).resolves.toEqual({ sent: 0, failed: 0, skipped: 1 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("releases the claim when the email fails, so the hourly run retries", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const supabaseAdmin = fakeSupabase(respondWith({ candidates: [application()] }));
    const sendEmail = vi.fn().mockResolvedValue({ status: "failed", failedReason: "SMTP down" });

    await expect(run(supabaseAdmin, sendEmail)).resolves.toEqual({ sent: 0, failed: 1, skipped: 0 });

    const updates = supabaseAdmin.calls.filter((call) => call.op === "update");
    expect(updates).toHaveLength(2);
    expect(updates[1].patch).toEqual({ admin_alerted_at: null });
    expect(updates[1].filters).toContainEqual(["eq", "admin_alerted_at", "2026-11-12T10:00:05.000Z"]);
    expect(errors).toHaveBeenCalledWith(expect.stringContaining("APP-007"));
    errors.mockRestore();
  });

  it("looks up only the asked-for application when given one", async () => {
    const supabaseAdmin = fakeSupabase(respondWith({ candidates: [] }));

    await run(supabaseAdmin, vi.fn(), { applicationId: "11111111-1111-4111-8111-111111111111" });

    expect(supabaseAdmin.calls[0].filters).toContainEqual(["eq", "id", "11111111-1111-4111-8111-111111111111"]);
  });
});
