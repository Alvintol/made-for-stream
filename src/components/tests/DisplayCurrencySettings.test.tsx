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

const country = () => screen.getByLabelText(/^Country/) as HTMLSelectElement;
const currency = () => screen.getByLabelText(/^Show prices in/) as HTMLSelectElement;

describe("<DisplayCurrencySettings />", () => {
  beforeEach(() => {
    mocks.saved = null;
    mocks.savedAt = 1;
    mocks.save.mockReset().mockResolvedValue(undefined);
  });

  it("says what the country is used for, and that it is not shown publicly", () => {
    render(<DisplayCurrencySettings />);

    expect(screen.getByText(/Your country is your billing country when you pay/)).toBeInTheDocument();
    expect(screen.getByText(/It is not shown on your profile/)).toBeInTheDocument();
    expect(screen.getByText(/you always pay in the creator's currency/)).toBeInTheDocument();
  });

  it("offers every country, because the country is the billing country", () => {
    render(<DisplayCurrencySettings />);

    // Brazil has no supported currency here, but a buyer can still live there.
    expect(screen.getByRole("option", { name: "Brazil" })).toBeInTheDocument();
  });

  it("leaves the country out of the top bar's version, and keeps the saved one on save", async () => {
    mocks.saved = { country_code: "CA", display_currency: null };

    render(<DisplayCurrencySettings showCountry={false} />);

    expect(screen.queryByLabelText(/^Country/)).not.toBeInTheDocument();
    expect(screen.queryByText(/billing country/)).not.toBeInTheDocument();

    fireEvent.change(currency(), { target: { value: "usd" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith({ country_code: "CA", display_currency: "usd" }),
    );
  });

  it("offers every currency the site supports", () => {
    render(<DisplayCurrencySettings />);

    // 15 currencies plus the "follow my country" choice.
    expect(currency().options).toHaveLength(16);
    expect(screen.getByRole("option", { name: /CAD · Canadian Dollar/ })).toBeInTheDocument();
  });

  it("saves a country and lets its currency be the default", async () => {
    render(<DisplayCurrencySettings />);

    fireEvent.change(country(), { target: { value: "IE" } });

    expect(screen.getByRole("option", { name: "My country's currency (EUR)" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith({ country_code: "IE", display_currency: null }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Saved");
  });

  it("saves an explicit currency choice", async () => {
    mocks.saved = { country_code: "CA", display_currency: null };

    render(<DisplayCurrencySettings />);

    expect(country().value).toBe("CA");

    fireEvent.change(currency(), { target: { value: "usd" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith({ country_code: "CA", display_currency: "usd" }),
    );
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

    expect(country().value).toBe("IE");
    expect(currency().value).toBe("eur");
  });
});
