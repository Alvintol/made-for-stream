import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ListingRequestPaymentCheckout from "../payments/ListingRequestPaymentCheckout";

const mocks = vi.hoisted(() => ({
  useListingRequestPayment: vi.fn(),
  createCheckout: vi.fn(),
}));

vi.mock("../../hooks/payments/useListingRequestPayments", () => ({
  useListingRequestPayment: mocks.useListingRequestPayment,
}));

vi.mock("../../hooks/payments/useCreateListingRequestPaymentCheckout", () => ({
  useCreateListingRequestPaymentCheckout: () => ({
    mutateAsync: mocks.createCheckout,
    isPending: false,
    error: null,
  }),
}));

vi.mock("../../hooks/payments/useSetListingRequestPaymentTipAndSupport", () => ({
  useSetListingRequestPaymentTipAndSupport: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

// The embedded Stripe checkout only mounts after policy acceptance, which this
// test never performs -- the fee disclosure renders above it either way.
vi.mock("../../hooks/settings/useAccountDetails", () => ({
  useAccountDetails: () => ({ data: { country_code: "CA" }, isLoading: false }),
}));

vi.mock("@stripe/react-stripe-js", () => ({
  EmbeddedCheckout: () => null,
  EmbeddedCheckoutProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("../../components/legal/CheckoutPolicyAcceptance", () => ({
  default: () => null,
}));

const createPayment = (overrides = {}) => ({
  id: "payment-1",
  listing_request_id: "request-1",
  payment_type: "starting_payment" as const,
  status: "requires_checkout" as const,
  currency: "cad",
  base_amount_cents: 10000,
  creator_tip_cents: 0,
  buyer_service_fee_cents: 500,
  buyer_service_fee_bps: 500,
  buyer_service_fee_minimum_cents: 100,
  platform_support_cents: 0,
  total_checkout_cents: 10500,
  metadata: {},
  ...overrides,
});

const renderCheckout = () =>
  render(
    <MemoryRouter initialEntries={["/payments/payment-1"]}>
      <Routes>
        <Route
          path="/payments/:paymentId"
          element={<ListingRequestPaymentCheckout />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe("checkout fee disclosure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the buyer what they pay and what the fee is", () => {
    mocks.useListingRequestPayment.mockReturnValue({
      data: createPayment(),
      isLoading: false,
      isError: false,
    });

    renderCheckout();

    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$5.00")).toBeInTheDocument();
    expect(screen.getByText("$105.00")).toBeInTheDocument();
    expect(
      screen.getByText(/5% of the project payment/),
    ).toBeInTheDocument();
  });

  it("states that the creator's fee does not increase the buyer's total", () => {
    mocks.useListingRequestPayment.mockReturnValue({
      data: createPayment(),
      isLoading: false,
      isError: false,
    });

    renderCheckout();

    expect(
      screen.getByText(/does not increase this total/),
    ).toBeInTheDocument();
  });

  it("explains the minimum when it is what the buyer is charged", () => {
    mocks.useListingRequestPayment.mockReturnValue({
      // 5% of 10.00 is 0.50, so the 1.00 minimum is the binding figure.
      data: createPayment({
        base_amount_cents: 1000,
        buyer_service_fee_cents: 100,
        total_checkout_cents: 1100,
      }),
      isLoading: false,
      isError: false,
    });

    renderCheckout();

    expect(screen.getByText(/\$1\.00 minimum/)).toBeInTheDocument();
  });

  it("links to the published fee schedule", () => {
    mocks.useListingRequestPayment.mockReturnValue({
      data: createPayment(),
      isLoading: false,
      isError: false,
    });

    renderCheckout();

    expect(
      screen.getByRole("link", { name: /Fee Schedule and Payment Terms/ }),
    ).toHaveAttribute("href", "/policies/fees");
  });

  it("does not show the fee note when the payment could not be loaded", () => {
    mocks.useListingRequestPayment.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    });

    renderCheckout();

    expect(screen.queryByText(/of the project payment/)).not.toBeInTheDocument();
  });
});

describe("checkout fee disclosure when the fee is waived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads correctly with no fee added", () => {
    mocks.useListingRequestPayment.mockReturnValue({
      data: createPayment({
        buyer_service_fee_cents: 0,
        buyer_service_fee_bps: 0,
        total_checkout_cents: 10000,
      }),
      isLoading: false,
      isError: false,
    });

    renderCheckout();

    expect(screen.getByText(/waived on this payment/)).toBeInTheDocument();
    expect(
      screen.getByText(/Nothing is added to the project payment/),
    ).toBeInTheDocument();
    // The "only fee added" sentence would contradict a waived fee.
    expect(
      screen.queryByText(/only fee added to what you pay/),
    ).not.toBeInTheDocument();
  });
});
