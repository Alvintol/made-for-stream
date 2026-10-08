import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saved: null as { country_code: string | null; display_currency: string | null } | null,
  save: vi.fn(),
  savedAt: 1,
}));

vi.mock("../../hooks/money/useDisplayCurrency", () => ({
  useDisplayPreferences: () => ({
    data: mocks.saved,
    isLoading: false,
    dataUpdatedAt: mocks.savedAt,
  }),
  useSaveDisplayPreferences: () => ({ mutateAsync: mocks.save, isPending: false, error: null }),
}));

import DisplayCurrencySettings from "../settings/DisplayCurrencySettings";

const currency = () => screen.getByLabelText(/^Show prices in/) as HTMLSelectElement;

describe("<DisplayCurrencySettings />", () => {
  beforeEach(() => {
    mocks.saved = null;
    mocks.savedAt = 1;
    mocks.save.mockReset().mockResolvedValue(undefined);
  });

  it("says the currency is for display only, and does not ask for a country", () => {
    render(<DisplayCurrencySettings />);

    expect(screen.getByText(/you always pay in the creator's currency/)).toBeInTheDocument();
    // The country is part of the private account details, not this form.
    expect(screen.queryByLabelText(/^Country/)).not.toBeInTheDocument();
  });

  it("offers every currency the site supports", () => {
    render(<DisplayCurrencySettings />);

    // 15 currencies plus the "follow my country" choice.
    expect(currency().options).toHaveLength(16);
    expect(screen.getByRole("option", { name: /CAD · Canadian Dollar/ })).toBeInTheDocument();
  });

  it("defaults to the currency of the country in the account details", () => {
    mocks.saved = { country_code: "IE", display_currency: null };

    render(<DisplayCurrencySettings />);

    expect(screen.getByRole("option", { name: "My country's currency (EUR)" })).toBeInTheDocument();
  });

  it("saves an explicit currency choice and leaves the country as it was", async () => {
    mocks.saved = { country_code: "CA", display_currency: null };

    render(<DisplayCurrencySettings />);

    fireEvent.change(currency(), { target: { value: "usd" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith({ country_code: "CA", display_currency: "usd" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });

  it("drops an unsaved edit when the saved values change elsewhere", () => {
    // The same form is also behind the top bar's globe button. A save there
    // must show here, even over an edit that was never saved.
    mocks.saved = { country_code: "CA", display_currency: null };

    const { rerender } = render(<DisplayCurrencySettings />);

    fireEvent.change(currency(), { target: { value: "usd" } });
    expect(currency().value).toBe("usd");

    mocks.saved = { country_code: "IE", display_currency: "eur" };
    mocks.savedAt = 2;
    rerender(<DisplayCurrencySettings />);

    expect(currency().value).toBe("eur");
  });
});
