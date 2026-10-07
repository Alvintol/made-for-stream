import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saved: null as { country_code: string | null; display_currency: string | null } | null,
  save: vi.fn(),
}));

vi.mock("../../hooks/money/useDisplayCurrency", () => ({
  useDisplayPreferences: () => ({ data: mocks.saved, isLoading: false }),
  useSaveDisplayPreferences: () => ({ mutateAsync: mocks.save, isPending: false, error: null }),
}));

import DisplayCurrencySettings from "../settings/DisplayCurrencySettings";

const country = () => screen.getByLabelText(/^Country/) as HTMLSelectElement;
const currency = () => screen.getByLabelText(/^Show prices in/) as HTMLSelectElement;

describe("<DisplayCurrencySettings />", () => {
  beforeEach(() => {
    mocks.saved = null;
    mocks.save.mockReset().mockResolvedValue(undefined);
  });

  it("says what the country is used for, and that it is not shown publicly", () => {
    render(<DisplayCurrencySettings />);

    expect(screen.getByText(/We use this only to choose the currency you see/)).toBeInTheDocument();
    expect(screen.getByText(/It is\s+not shown on your profile/)).toBeInTheDocument();
    expect(screen.getByText(/you always pay in the creator's currency/)).toBeInTheDocument();
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
});
