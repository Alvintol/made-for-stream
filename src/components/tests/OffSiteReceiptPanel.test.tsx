import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as unknown[],
  rpc: vi.fn(),
}));

vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: async () => ({ data: mocks.rows, error: null }),
      };
      return chain;
    },
    rpc: mocks.rpc,
  },
}));

import OffSiteReceiptPanel from "../listingRequests/conversations/OffSiteReceiptPanel";

const receipt = (status: string) => ({
  id: "receipt-1",
  listing_request_id: "request-1",
  subject: "the final delivery (Final files)",
  methods: ["discord", "other"],
  other: "a USB stick",
  status,
  sent_at: "2026-10-16T23:57:53Z",
  answered_at: null,
  admin_note: null,
});

const renderPanel = (viewer: "buyer" | "creator" | "admin") =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <OffSiteReceiptPanel
        buyerName="@ImAllBeans"
        creatorName="@meowington"
        requestId="request-1"
        viewer={viewer}
      />
    </QueryClientProvider>,
  );

describe("<OffSiteReceiptPanel />", () => {
  beforeEach(() => {
    mocks.rpc.mockReset().mockResolvedValue({ error: null });
  });

  it("asks the buyer whether the work arrived, and records the answer", async () => {
    mocks.rows = [receipt("awaiting")];
    renderPanel("buyer");

    expect(
      await screen.findByText(
        "@meowington says the work for the final delivery (Final files) was sent outside Made for Stream, by: Discord, Another way (a USB stick).",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "It hasn’t arrived" }));

    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("respond_off_site_delivery_receipt", {
        p_receipt_id: "receipt-1",
        p_received: false,
      }),
    );
  });

  it("lets a buyer who said it had not arrived confirm it later, but not repeat the refusal", async () => {
    mocks.rows = [receipt("not_received")];
    renderPanel("buyer");

    fireEvent.click(await screen.findByRole("button", { name: "I received it" }));

    expect(screen.queryByRole("button", { name: "It hasn’t arrived" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("respond_off_site_delivery_receipt", {
        p_receipt_id: "receipt-1",
        p_received: true,
      }),
    );
  });

  it("tells the creator what the buyer said, with no buttons", async () => {
    mocks.rows = [receipt("not_received")];
    renderPanel("creator");

    expect(await screen.findByText(/@ImAllBeans says it has not arrived\. Send it again/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lets an administrator record it as received only with a note", async () => {
    mocks.rows = [receipt("awaiting")];
    renderPanel("admin");

    const button = await screen.findByRole("button", { name: "Record as received" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText("How was the receipt confirmed?"), {
      target: { value: "The buyer confirmed by email to support." },
    });
    fireEvent.click(button);

    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith("admin_record_off_site_receipt", {
        p_receipt_id: "receipt-1",
        p_note: "The buyer confirmed by email to support.",
      }),
    );
  });

  it("shows nothing once everything is confirmed", async () => {
    mocks.rows = [receipt("received")];
    const { container } = renderPanel("buyer");

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
