import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ListingRequestPaymentCheckout from "../payments/ListingRequestPaymentCheckout";

const mocks = vi.hoisted(() => ({
  payment: null as Record<string, unknown> | null,
  createCheckout: vi.fn(),
  setTipAndSupport: vi.fn(),
  billingCountry: "CA" as string | null,
}));

vi.mock("../../hooks/settings/useAccountDetails", () => ({
  useAccountDetails: () => ({
    data: mocks.billingCountry ? { country_code: mocks.billingCountry } : null,
    isLoading: false,
  }),
}));

vi.mock("../../hooks/payments/useListingRequestPayments", () => ({
  useListingRequestPayment: () => ({ data: mocks.payment, isLoading: false, isError: false }),
}));

vi.mock("../../hooks/payments/useCreateListingRequestPaymentCheckout", () => ({
  useCreateListingRequestPaymentCheckout: () => ({ mutateAsync: mocks.createCheckout }),
}));

vi.mock("../../hooks/payments/useSetListingRequestPaymentTipAndSupport", () => ({
  useSetListingRequestPaymentTipAndSupport: () => ({
    mutateAsync: mocks.setTipAndSupport,
    isPending: false,
  }),
}));

vi.mock("../../lib/stripeClient", () => ({
  getStripeForConnectedAccount: () => Promise.resolve(null),
}));

vi.mock("@stripe/react-stripe-js", () => ({
  EmbeddedCheckoutProvider: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  EmbeddedCheckout: () => <div>Stripe embedded checkout</div>,
}));

// The acceptance component is tested on its own; here it only needs to
// report acceptance to the page.
vi.mock("../../components/legal/CheckoutPolicyAcceptance", () => ({
  default: ({ listingRequestId, onAccepted }: { listingRequestId: string; onAccepted: () => void }) => (
    <button type="button" onClick={onAccepted}>
      Accept for {listingRequestId}
    </button>
  ),
}));

const renderCheckout = () =>
  render(
    <MemoryRouter initialEntries={["/payments/checkout/payment-1"]}>
      <Routes>
        <Route path="/payments/checkout/:paymentId" element={<ListingRequestPaymentCheckout />} />
      </Routes>
    </MemoryRouter>,
  );

describe("ListingRequestPaymentCheckout", () => {
  beforeEach(() => {
    mocks.payment = {
      id: "payment-1",
      listing_request_id: "request-1",
      payment_type: "starting_payment",
      status: "requires_checkout",
      currency: "cad",
      base_amount_cents: 10000,
      creator_tip_cents: 0,
      buyer_service_fee_cents: 500,
      platform_support_cents: 0,
      tax_cents: 0,
      tax_treatment: null,
      tax_jurisdiction_country: null,
      tax_jurisdiction_region: null,
      total_checkout_cents: 10500,
      metadata: {},
    };
    mocks.createCheckout.mockReset().mockResolvedValue({
      payment: { stripe_connected_account_id: "acct_123" },
      checkout: { clientSecret: "cs_secret" },
    });
    mocks.setTipAndSupport.mockReset().mockResolvedValue({});
    mocks.billingCountry = "CA";
  });

  it("shows what the buyer is paying before checkout", () => {
    renderCheckout();

    expect(screen.getByText("Starting payment")).toBeInTheDocument();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$5.00")).toBeInTheDocument();
    expect(screen.getByText("$105.00")).toBeInTheDocument();
    // Sprint 7: tax is always its own line, even before it is known.
    expect(screen.getByText("Calculated before payment")).toBeInTheDocument();
  });

  it("shows calculated tax as a separate line with its jurisdiction", () => {
    mocks.payment = {
      ...mocks.payment,
      tax_cents: 2100,
      tax_treatment: "calculated",
      tax_jurisdiction_country: "GB",
      total_checkout_cents: 12600,
    };

    renderCheckout();

    expect(screen.getByText("Tax (GB)")).toBeInTheDocument();
    expect(screen.getByText("$21.00")).toBeInTheDocument();
    expect(screen.getByText("$126.00")).toBeInTheDocument();
  });

  it("does not move on to payment for an account with no details", async () => {
    mocks.billingCountry = null;

    renderCheckout();

    expect(screen.getByRole("link", { name: "Add your account details" })).toHaveAttribute(
      "href",
      "/settings/personal",
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));

    expect(
      await screen.findByText("Add your account details in Settings before paying."),
    ).toBeInTheDocument();
    expect(mocks.setTipAndSupport).not.toHaveBeenCalled();
  });

  it("does not create a Stripe checkout session until the tip/contribution step and the policies are accepted", async () => {
    renderCheckout();

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mocks.createCheckout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
    await waitFor(() => expect(mocks.setTipAndSupport).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole("button", { name: "Accept for request-1" }));

    await waitFor(() =>
      expect(mocks.createCheckout).toHaveBeenCalledWith({
        paymentId: "payment-1",
        billingCountry: "CA",
      }),
    );
    expect(await screen.findByText("Stripe embedded checkout")).toBeInTheDocument();
  });

  it("shows the country from the account details and does not let it be changed here", () => {
    renderCheckout();

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Postal or ZIP code/)).not.toBeInTheDocument();
    expect(screen.getByText(/Canada/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change in Settings" })).toHaveAttribute(
      "href",
      "/settings/personal",
    );
  });

  it("shows a tip and contribution saved on an earlier visit, so they can be removed", async () => {
    mocks.payment = { ...mocks.payment, creator_tip_cents: 2415, platform_support_cents: 100 };

    renderCheckout();

    expect(screen.getByLabelText(/^Tip for the creator/)).toHaveValue(24.15);
    expect(screen.getByLabelText(/^Support Made for Stream/)).toHaveValue(1);

    fireEvent.change(screen.getByLabelText(/^Tip for the creator/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));

    await waitFor(() =>
      expect(mocks.setTipAndSupport).toHaveBeenCalledWith({
        paymentId: "payment-1",
        creatorTipCents: 0,
        platformSupportCents: 100,
      }),
    );
  });

  it("creates only one session when acceptance is reported more than once", async () => {
    renderCheckout();

    fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));

    const accept = await screen.findByRole("button", { name: "Accept for request-1" });
    fireEvent.click(accept);
    fireEvent.click(accept);

    await waitFor(() => expect(mocks.createCheckout).toHaveBeenCalledTimes(1));
  });
});
