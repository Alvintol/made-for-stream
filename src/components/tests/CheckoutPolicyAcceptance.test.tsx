import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CheckoutPolicyAcceptance from "../legal/CheckoutPolicyAcceptance";
import { paymentTermsVersion } from "../../domain/legal/paymentTerms";
import { refundPolicyVersion } from "../../domain/legal/refundPolicy";

const mocks = vi.hoisted(() => ({
  acceptances: [] as Array<Record<string, unknown>>,
  record: vi.fn(),
  queryOptions: null as Record<string, unknown> | null,
}));

vi.mock("../../hooks/legal/usePolicyAcceptances", () => ({
  usePolicyAcceptances: (options: Record<string, unknown>) => {
    mocks.queryOptions = options;
    return { data: mocks.acceptances, isLoading: false };
  },
  useRecordPolicyAcceptances: () => ({ mutateAsync: mocks.record, isPending: false }),
  logPolicyAcceptanceFailure: vi.fn(),
}));

const renderAcceptance = (onAccepted = vi.fn()) => {
  render(
    <MemoryRouter>
      <CheckoutPolicyAcceptance listingRequestId="request-1" onAccepted={onAccepted} />
    </MemoryRouter>,
  );
  return onAccepted;
};

const getTermsCheckbox = () =>
  screen.getByRole("checkbox", { name: /I agree to the project scope, payment schedule, usage rights/i });
const getEarlyStartCheckbox = () =>
  screen.getByRole("checkbox", { name: /I expressly request that the creator begin work now/i });
const getContinueButton = () => screen.getByRole("button", { name: /Continue to payment/i });

describe("CheckoutPolicyAcceptance", () => {
  beforeEach(() => {
    mocks.acceptances = [];
    mocks.record.mockReset().mockResolvedValue(undefined);
    mocks.queryOptions = null;
  });

  it("only counts acceptances tied to this listing commission", () => {
    renderAcceptance();

    expect(mocks.queryOptions).toMatchObject({ relatedListingRequestId: "request-1" });
  });

  it("shows the vetted agreement line and a separate early-start request, both unchecked", () => {
    renderAcceptance();

    expect(getTermsCheckbox()).not.toBeChecked();
    expect(getTermsCheckbox().closest("label")).toHaveTextContent(
      "I agree to the project scope, payment schedule, usage rights, Fee Schedule and Refund, Cancellation and Dispute Policy shown here.",
    );
    expect(getEarlyStartCheckbox()).not.toBeChecked();
    expect(getEarlyStartCheckbox()).not.toBe(getTermsCheckbox());

    expect(screen.getAllByRole("link", { name: "Fee Schedule" })[0]).toHaveAttribute("href", "/policies/fees");
    expect(
      screen.getAllByRole("link", { name: "Refund, Cancellation and Dispute Policy" })[0],
    ).toHaveAttribute("href", "/policies/refunds");
    expect(screen.getByRole("link", { name: "project agreement" })).toHaveAttribute("href", "/requests/request-1");
  });

  it("requires both the agreement and the early-start request", () => {
    renderAcceptance();

    expect(getContinueButton()).toBeDisabled();

    fireEvent.click(getTermsCheckbox());
    expect(getContinueButton()).toBeDisabled();

    fireEvent.click(getTermsCheckbox());
    fireEvent.click(getEarlyStartCheckbox());
    expect(getContinueButton()).toBeDisabled();

    fireEvent.click(getTermsCheckbox());
    expect(getContinueButton()).toBeEnabled();
  });

  it("does not ask again for an early start already requested at agreement acceptance", async () => {
    mocks.acceptances = [
      {
        policy_type: "early_service_request",
        policy_version: refundPolicyVersion,
        related_listing_request_id: "request-1",
        accepted_at: "2026-09-23T00:00:00Z",
      },
    ];
    renderAcceptance();

    expect(
      screen.queryByRole("checkbox", { name: /I expressly request that the creator begin work now/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(getTermsCheckbox());
    expect(getContinueButton()).toBeEnabled();
    fireEvent.click(getContinueButton());

    await waitFor(() =>
      expect(mocks.record).toHaveBeenCalledWith({
        policies: [
          { policyType: "refund", policyVersion: refundPolicyVersion },
          { policyType: "payment_terms", policyVersion: paymentTermsVersion },
        ],
        relatedListingRequestId: "request-1",
      }),
    );
  });

  it("records each policy against the listing commission, then continues", async () => {
    const onAccepted = renderAcceptance();

    fireEvent.click(getTermsCheckbox());
    fireEvent.click(getEarlyStartCheckbox());
    fireEvent.click(getContinueButton());

    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
    expect(mocks.record).toHaveBeenCalledWith({
      policies: [
        { policyType: "refund", policyVersion: refundPolicyVersion },
        { policyType: "payment_terms", policyVersion: paymentTermsVersion },
        { policyType: "early_service_request", policyVersion: refundPolicyVersion },
      ],
      relatedListingRequestId: "request-1",
    });
  });

  it("does not continue to payment if the acceptance could not be recorded", async () => {
    mocks.record.mockRejectedValue(new Error("insert failed"));
    const onAccepted = renderAcceptance();

    fireEvent.click(getTermsCheckbox());
    fireEvent.click(getEarlyStartCheckbox());
    fireEvent.click(getContinueButton());

    expect(await screen.findByText(/checkout hasn.t started/i)).toBeInTheDocument();
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it("goes straight through when this commission already has current acceptances", async () => {
    mocks.acceptances = [
      { policy_type: "refund", policy_version: refundPolicyVersion, accepted_at: "2026-09-18T12:00:00Z" },
      { policy_type: "payment_terms", policy_version: paymentTermsVersion, accepted_at: "2026-09-18T12:00:00Z" },
      { policy_type: "early_service_request", policy_version: refundPolicyVersion, accepted_at: "2026-09-18T12:00:00Z" },
    ];

    const onAccepted = renderAcceptance();

    await waitFor(() => expect(onAccepted).toHaveBeenCalled());
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it("asks again, and records only what is missing, when a policy version changed", async () => {
    mocks.acceptances = [
      { policy_type: "refund", policy_version: "2020-01-01-old", accepted_at: "2026-01-01T00:00:00Z" },
      { policy_type: "payment_terms", policy_version: paymentTermsVersion, accepted_at: "2026-01-01T00:00:00Z" },
      { policy_type: "early_service_request", policy_version: "2020-01-01-old", accepted_at: "2026-01-01T00:00:00Z" },
    ];

    renderAcceptance();

    fireEvent.click(getTermsCheckbox());
    fireEvent.click(getEarlyStartCheckbox());
    fireEvent.click(getContinueButton());

    await waitFor(() => expect(mocks.record).toHaveBeenCalled());
    expect(mocks.record.mock.calls[0][0].policies.map((policy: { policyType: string }) => policy.policyType)).toEqual([
      "refund",
      "early_service_request",
    ]);
  });
});
