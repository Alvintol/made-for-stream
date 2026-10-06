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
  account: null as Record<string, unknown> | null,
  sync: vi.fn(),
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "creator-1" }, session: { access_token: "token" }, loading: false }),
}));

vi.mock("../../hooks/payments/useCreatorPaymentAccount", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/payments/useCreatorPaymentAccount")>()),
  useCreatorPaymentAccount: () => ({ data: mocks.account, refetch: vi.fn() }),
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
  useSyncStripeConnectAccount: () => ({ mutateAsync: mocks.sync, isPending: false }),
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
  ConnectAccountOnboarding: ({ onLoadError, onExit }: { onLoadError: () => void; onExit: () => void }) => (
    <>
      <button type="button" onClick={onLoadError}>
        Stripe onboarding
      </button>
      <button type="button" onClick={onExit}>
        Finish Stripe form
      </button>
    </>
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

const chooseAndConfirmCountry = (code = "CA") => {
  fireEvent.change(screen.getByLabelText("Country"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: /^Confirm / }));
};

// A new creator, country chosen and confirmed, so the Stripe button is on offer.
const renderReadyToStart = () => {
  const view = renderSettings();

  chooseAndConfirmCountry();

  return view;
};
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
    mocks.account = null;
    mocks.sync.mockReset().mockResolvedValue(undefined);
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
    renderReadyToStart();

    expect(getStartButton()).toBeDisabled();

    fireEvent.click(getTermsCheckbox());

    expect(getStartButton()).toBeEnabled();
  });

  it("records the acceptance before starting Stripe onboarding", async () => {
    renderReadyToStart();

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

    renderReadyToStart();

    fireEvent.click(getTermsCheckbox());
    fireEvent.click(getStartButton());

    expect(await screen.findByText(/couldn.t record your acceptance of the Creator Terms/i)).toBeInTheDocument();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it("asks again when only an older Creator Terms version was accepted", () => {
    mocks.acceptances = [
      { policy_type: "creator_terms", policy_version: "2020-01-01-old", accepted_at: "2026-01-01T00:00:00Z" },
    ];

    renderReadyToStart();

    expect(getTermsCheckbox()).not.toBeChecked();
    expect(getStartButton()).toBeDisabled();
  });

  it("skips the checkbox once the current version is accepted", async () => {
    mocks.acceptances = [
      { policy_type: "creator_terms", policy_version: creatorTermsVersion, accepted_at: "2026-09-18T12:00:00Z" },
    ];

    renderReadyToStart();

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

    renderReadyToStart();

    fireEvent.click(getStartButton());
    fireEvent.click(await screen.findByText("Stripe onboarding"));

    expect(await screen.findByText(/Stripe's setup form couldn't load/i)).toBeInTheDocument();
    expect(screen.queryByText("Stripe onboarding")).not.toBeInTheDocument();
  });
});

describe("CreatorPayoutSettings setup status", () => {
  const accepted = [
    { policy_type: "creator_terms", policy_version: creatorTermsVersion, accepted_at: "2026-09-18T12:00:00Z" },
  ];
  const account = {
    country: "IE",
    default_currency: "eur",
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: false,
    requirements_due_count: 0,
  };

  beforeEach(() => {
    mocks.acceptances = accepted;
    mocks.account = null;
    mocks.sync.mockReset().mockResolvedValue(undefined);
    mocks.createSession.mockReset().mockResolvedValue({ accountSession: { clientSecret: "secret" } });
  });

  it("says Stripe is checking the details when nothing is due from the creator", () => {
    mocks.account = account;

    renderSettings();

    expect(screen.getByRole("status")).toHaveTextContent(/Stripe is checking your details/i);
    expect(screen.getByRole("button", { name: "Continue Stripe setup" })).toBeInTheDocument();
  });

  it("shows the account's own country and currency, locked, not the defaults", () => {
    mocks.account = account;

    renderSettings();

    const country = screen.getByLabelText("Country") as HTMLSelectElement;
    const currency = screen.getByLabelText("Currency") as HTMLSelectElement;

    expect(country.value).toBe("IE");
    expect(currency.value).toBe("eur");
    expect(country).toBeDisabled();
    expect(currency).toBeDisabled();
  });

  it("asks the creator to continue when Stripe needs more from them", () => {
    mocks.account = { ...account, requirements_due_count: 3 };

    renderSettings();

    expect(screen.getByText(/Stripe needs more information from you/i)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says the account is ready once Stripe has enabled it", () => {
    mocks.account = { ...account, charges_enabled: true, payouts_enabled: true, details_submitted: true };

    renderSettings();

    expect(screen.getByText(/Your payout account is ready/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review Stripe details" })).toBeInTheDocument();
  });

  it("closes the finished form and refreshes the status", async () => {
    mocks.account = account;

    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Continue Stripe setup" }));
    fireEvent.click(await screen.findByText("Finish Stripe form"));

    await waitFor(() => expect(mocks.sync).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Finish Stripe form")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Stripe is checking your details/i);
  });
});

describe("CreatorPayoutSettings country", () => {
  beforeEach(() => {
    mocks.account = null;
  });

  it("offers a dropdown of supported countries with nothing preselected", () => {
    renderSettings();

    const country = screen.getByLabelText("Country") as HTMLSelectElement;

    expect(country.tagName).toBe("SELECT");
    expect(country.value).toBe("");
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

  it("hides the Stripe button and warns until a country is confirmed", () => {
    renderSettings();

    expect(screen.getByRole("alert")).toHaveTextContent(/can't change your country/i);
    expect(screen.queryByRole("button", { name: /Stripe setup/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Confirm / })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "US" } });

    expect(screen.queryByRole("button", { name: /Stripe setup/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm United States (USD)" }));

    expect(getStartButton()).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeDisabled();
    expect(screen.getByLabelText("Currency")).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("lets the creator change a confirmed country before Stripe setup starts", () => {
    renderSettings();

    chooseAndConfirmCountry("IE");
    fireEvent.click(screen.getByRole("button", { name: "Change country" }));

    expect(screen.getByLabelText("Country")).toBeEnabled();
    expect(screen.queryByRole("button", { name: /Stripe setup/i })).not.toBeInTheDocument();
  });

  it("starts Stripe with the confirmed country and currency", async () => {
    mocks.acceptances = [
      { policy_type: "creator_terms", policy_version: creatorTermsVersion, accepted_at: "2026-09-18T12:00:00Z" },
    ];
    mocks.createSession.mockReset().mockResolvedValue({ accountSession: { clientSecret: "secret" } });

    renderSettings();

    chooseAndConfirmCountry("US");
    fireEvent.click(getStartButton());

    await waitFor(() =>
      expect(mocks.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ country: "US", defaultCurrency: "usd" }),
      ),
    );
  });
});
