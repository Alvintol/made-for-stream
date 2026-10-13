import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PolicyAcceptanceGate from "../legal/PolicyAcceptanceGate";
import {
  signupPolicyTypes,
  toCurrentPolicyAcceptances,
} from "../../domain/legal/policyAcceptance";
import { privacyVersion } from "../../domain/legal/privacyPolicy";
import { termsVersion } from "../../domain/legal/termsOfService";
import {
  clearPendingPolicyAcceptance,
  readPendingPolicyAcceptance,
  savePendingPolicyAcceptance,
} from "../../lib/legal/pendingPolicyAcceptance";

type Row = { policy_type: string; policy_version: string; accepted_at: string };

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  authLoading: false,
  insert: vi.fn(),
  insertError: null as { code: string; message: string } | null,
  rows: [] as Row[],
  selectError: null as { code: string; message: string } | null,
  signOut: vi.fn(),
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: () => ({ user: mocks.user, session: null, loading: mocks.authLoading }),
}));

vi.mock("../../lib/supabaseClient", () => {
  const selectChain = () => {
    const chain = {
      eq: () => chain,
      in: () => chain,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({
          data: mocks.selectError ? null : mocks.rows,
          error: mocks.selectError,
        }).then(resolve),
    };
    return chain;
  };

  return {
    supabase: {
      auth: { signOut: mocks.signOut },
      from: () => ({
        insert: async (rows: Array<{ policy_type: string; policy_version: string }>) => {
          mocks.insert(rows);

          if (mocks.insertError) return { error: mocks.insertError };

          mocks.rows = [
            ...mocks.rows,
            ...rows.map((row) => ({ ...row, accepted_at: "2026-09-19T10:00:00Z" })),
          ];
          return { error: null };
        },
        select: selectChain,
      }),
    },
  };
});

const renderGate = (path = "/market") => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <PolicyAcceptanceGate>
          <p>Page content</p>
        </PolicyAcceptanceGate>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const acceptCurrent = () => {
  mocks.rows = [
    { policy_type: "terms", policy_version: termsVersion, accepted_at: "2026-09-19T09:00:00Z" },
    { policy_type: "privacy", policy_version: privacyVersion, accepted_at: "2026-09-19T09:00:00Z" },
  ];
};

describe("PolicyAcceptanceGate", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.user = { id: "user-1" };
    mocks.authLoading = false;
    mocks.insert.mockReset();
    mocks.insertError = null;
    mocks.rows = [];
    mocks.selectError = null;
    mocks.signOut.mockReset().mockResolvedValue({ error: null });
    clearPendingPolicyAcceptance();
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    clearPendingPolicyAcceptance();
    warn.mockRestore();
  });

  it("lets signed-out visitors through", () => {
    mocks.user = null;

    renderGate();

    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("lets a user through once the current versions are accepted", async () => {
    acceptCurrent();

    renderGate();

    expect(await screen.findByText("Page content")).toBeInTheDocument();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("blocks the page until a user with no acceptance agrees", async () => {
    renderGate();

    const accept = await screen.findByRole("button", { name: /Accept and continue/i });
    expect(screen.queryByText("Page content")).not.toBeInTheDocument();
    expect(accept).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to the Terms of Service/i }));
    fireEvent.click(accept);

    expect(await screen.findByText("Page content")).toBeInTheDocument();
    expect(mocks.insert.mock.calls[0][0].map((row: Row) => row.policy_type)).toEqual(["terms", "privacy"]);
  });

  it("records the acceptance parked at sign-in, without waiting for a profile", async () => {
    savePendingPolicyAcceptance(toCurrentPolicyAcceptances(signupPolicyTypes));

    renderGate();

    expect(await screen.findByText("Page content")).toBeInTheDocument();
    expect(mocks.insert.mock.calls[0][0]).toEqual([
      { user_id: "user-1", policy_type: "terms", policy_version: termsVersion, related_listing_request_id: null },
      { user_id: "user-1", policy_type: "privacy", policy_version: privacyVersion, related_listing_request_id: null },
    ]);
    expect(readPendingPolicyAcceptance()).toBeNull();
  });

  it("records the parked acceptance once when the gate mounts twice at sign-in", async () => {
    savePendingPolicyAcceptance(toCurrentPolicyAcceptances(signupPolicyTypes));

    renderGate();
    renderGate();

    await waitFor(() => expect(screen.getAllByText("Page content")).toHaveLength(2));
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it("keeps blocking, and keeps the parked intent, when the write fails", async () => {
    mocks.insertError = { code: "42501", message: "new row violates row-level security policy" };
    savePendingPolicyAcceptance(toCurrentPolicyAcceptances(signupPolicyTypes));

    renderGate();

    expect(await screen.findByRole("button", { name: /Accept and continue/i })).toBeInTheDocument();
    expect(screen.queryByText("Page content")).not.toBeInTheDocument();
    expect(readPendingPolicyAcceptance()).not.toBeNull();

    const logged = warn.mock.calls.map((call: unknown[]) => call.join(" ")).join("\n");
    expect(logged).toContain("signup acceptance failed (42501)");
    expect(logged).not.toContain("user-1");
  });

  it("asks again, only for the changed policy, after a version change", async () => {
    mocks.rows = [
      { policy_type: "terms", policy_version: "2026-09-17-draft-1", accepted_at: "2026-09-17T00:00:00Z" },
      { policy_type: "privacy", policy_version: privacyVersion, accepted_at: "2026-09-17T00:00:00Z" },
    ];

    renderGate();

    fireEvent.click(await screen.findByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Accept and continue/i }));

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));
    expect(mocks.insert.mock.calls[0][0].map((row: Row) => row.policy_type)).toEqual(["terms"]);
  });

  it.each(["/terms", "/privacy", "/terms/creator", "/legal", "/policies/refunds", "/signin"])(
    "leaves %s readable before acceptance",
    (path) => {
      renderGate(path);

      expect(screen.getByText("Page content")).toBeInTheDocument();
    },
  );

  it("fails closed with a retry when acceptance cannot be checked", async () => {
    mocks.selectError = { code: "PGRST205", message: "table not found" };

    renderGate();

    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Page content")).not.toBeInTheDocument();

    mocks.selectError = null;
    acceptCurrent();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Page content")).toBeInTheDocument();
  });

  it("lets a blocked user sign out", async () => {
    renderGate();

    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
  });

  it("shows nothing gated while the session is still loading", () => {
    mocks.authLoading = true;

    renderGate();

    expect(screen.queryByText("Page content")).not.toBeInTheDocument();
  });
});
