import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreatorPayoutSettings from "../settings/CreatorPayoutSettings";
import { creatorTermsVersion } from "../../domain/legal/creatorTerms";

const mocks = vi.hoisted(() => ({
  acceptances: [] as Array<Record<string, unknown>>,
  acceptancesLoading: false,
  record: vi.fn(),
  createSession: vi.fn(),
  order: [] as string[],
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "creator-1" }, session: { access_token: "token" }, loading: false }),
}));

vi.mock("../../hooks/payments/useCreatorPaymentAccount", () => ({
  useCreatorPaymentAccount: () => ({ data: null, refetch: vi.fn() }),
  getCreatorPaymentAccountIsReady: () => false,
}));

// Sprint 5: the recovery balance section renders nothing when there is no
// outstanding balance, which is the case this file's tests are about.
vi.mock("../../hooks/payments/useCreatorRecoveryBalance", () => ({
  useCreatorRecoveryBalance: () => ({ data: null }),
  useCreatorRecoveryEntries: () => ({ data: [] }),
}));

vi.mock("../../hooks/payments/useCreateCreatorRecoverySettlementCheckout", () => ({
  useCreateCreatorRecoverySettlementCheckout: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("../../hooks/payments/useStripeConnectOnboarding", () => ({
  useSyncStripeConnectAccount: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../../hooks/payments/useStripeConnectAccountSession", () => ({
  createStripeConnectAccountSession: async (input: unknown) => {
    mocks.order.push("stripe");
    return mocks.createSession(input);
  },
}));

vi.mock("../../lib/stripeClient", () => ({
  getStripePublishableKey: () => "pk_test_example",
}));

vi.mock("@stripe/connect-js", () => ({
  loadConnectAndInitialize: () => ({}),
}));

vi.mock("@stripe/react-connect-js", () => ({
  ConnectComponentsProvider: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  ConnectAccountOnboarding: ({ onLoadError }: { onLoadError: () => void }) => (
    <button type="button" onClick={onLoadError}>
      Stripe onboarding
    </button>
  ),
}));

vi.mock("../../hooks/legal/usePolicyAcceptances", () => ({
  usePolicyAcceptances: () => ({
    data: mocks.acceptancesLoading ? undefined : mocks.acceptances,
    isLoading: mocks.acceptancesLoading,
  }),
  useRecordPolicyAcceptances: () => ({
    mutateAsync: async (input: unknown) => {
      mocks.order.push("record");
      return mocks.record(input);
    },
    isPending: false,
  }),
  logPolicyAcceptanceFailure: vi.fn(),
}));

const renderSettings = (isCreatorApproved = true) =>
  render(
    <MemoryRouter>
      <CreatorPayoutSettings isCreatorApproved={isCreatorApproved} />
    </MemoryRouter>,
  );

const getStartButton = () => screen.getByRole("button", { name: /Start Stripe setup/i });
const getTermsCheckbox = () => screen.getByRole("checkbox", { name: /I accept the Made for Stream Creator Terms/i });

describe("CreatorPayoutSettings creator terms acceptance", () => {
  beforeEach(() => {
    mocks.acceptances = [];
    mocks.acceptancesLoading = false;
    mocks.record.mockReset().mockResolvedValue(undefined);
    mocks.createSession.mockReset().mockResolvedValue({
      accountSession: { clientSecret: "secret" },
    });
    mocks.order = [];
  });

  it("does not ask for acceptance before the creator is approved", () => {
    renderSettings(false);

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows the vetted acceptance line, unchecked, with links to each agreement", () => {
    renderSettings();

    expect(getTermsCheckbox()).not.toBeChecked();
    expect(getTermsCheckbox().closest("label")).toHaveTextContent(
      "I accept the Made for Stream Creator Terms and the Stripe Connected Account Agreement, including its incorporated Stripe Services Agreement.",
    );
    expect(screen.getByRole("link", { name: "Creator Terms" })).toHaveAttribute("href", "/terms/creator");
    expect(screen.getByRole("link", { name: "Stripe Connected Account Agreement" })).toHaveAttribute(
      "href",
      "https://stripe.com/connect-account/legal/full",
    );
    expect(screen.getByRole("link", { name: "Stripe Services Agreement" })).toHaveAttribute(
      "href",
      "https://stripe.com/legal/ssa",
    );
  });

  it("keeps Stripe setup disabled until the box is checked", () => {
    renderSettings();

    expect(getStartButton()).toBeDisabled();

    fireEvent.click(getTermsCheckbox());

    expect(getStartButton()).toBeEnabled();
  });

  it("records the acceptance before starting Stripe onboarding", async () => {
    renderSettings();

    fireEvent.click(getTermsCheckbox());
    fireEvent.click(getStartButton());

    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledTimes(1));
    expect(mocks.record).toHaveBeenCalledWith({
      policies: [{ policyType: "creator_terms", policyVersion: creatorTermsVersion }],
    });
    expect(mocks.order).toEqual(["record", "stripe"]);
  });

  it("does not start onboarding if the acceptance could not be recorded", async () => {
    mocks.record.mockRejectedValue(new Error("insert failed"));

    renderSettings();

    fireEvent.click(getTermsCheckbox());
    fireEvent.click(getStartButton());

    expect(await screen.findByText(/couldn.t record your acceptance of the Creator Terms/i)).toBeInTheDocument();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("asks again when only an older Creator Terms version was accepted", () => {
    mocks.acceptances = [
      { policy_type: "creator_terms", policy_version: "2020-01-01-old", accepted_at: "2026-01-01T00:00:00Z" },
    ];

    renderSettings();

    expect(getTermsCheckbox()).not.toBeChecked();
    expect(getStartButton()).toBeDisabled();
  });

  it("skips the checkbox once the current version is accepted", async () => {
    mocks.acceptances = [
      { policy_type: "creator_terms", policy_version: creatorTermsVersion, accepted_at: "2026-09-18T12:00:00Z" },
    ];

    renderSettings();

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText(/You accepted the/i)).toBeInTheDocument();

    fireEvent.click(getStartButton());

    await waitFor(() => expect(mocks.createSession).toHaveBeenCalledTimes(1));
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("tells the creator when Stripe's form fails to load", async () => {
    mocks.acceptances = [
      { policy_type: "creator_terms", policy_version: creatorTermsVersion, accepted_at: "2026-09-18T12:00:00Z" },
    ];

    renderSettings();

    fireEvent.click(getStartButton());
    fireEvent.click(await screen.findByText("Stripe onboarding"));

    expect(await screen.findByText(/Stripe's setup form couldn't load/i)).toBeInTheDocument();
    expect(screen.queryByText("Stripe onboarding")).not.toBeInTheDocument();
  });
});

describe("CreatorPayoutSettings country", () => {
  it("offers a dropdown of supported countries, not a free-text box", () => {
    renderSettings();

    const country = screen.getByLabelText("Country") as HTMLSelectElement;

    expect(country.tagName).toBe("SELECT");
    expect(country.value).toBe("CA");
    expect(screen.getByRole("option", { name: "Ireland" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Japan" })).not.toBeInTheDocument();
  });

  it("switches the currency to the chosen country's own", () => {
    renderSettings();

    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "IE" } });

    expect((screen.getByLabelText("Currency") as HTMLSelectElement).value).toBe("eur");

    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "US" } });

    expect((screen.getByLabelText("Currency") as HTMLSelectElement).value).toBe("usd");
  });
});
