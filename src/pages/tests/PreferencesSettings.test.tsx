import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  optedIn: false,
  save: vi.fn(),
}));

vi.mock("../../hooks/settings/useAccountDetails", () => ({
  useMarketingEmails: () => ({ data: mocks.optedIn, isLoading: false }),
  useSaveMarketingEmails: () => ({
    mutate: mocks.save,
    isPending: false,
    isSuccess: false,
    error: null,
  }),
}));

vi.mock("../../components/settings/DisplayCurrencySettings", () => ({
  default: () => <div>Currency form</div>,
}));

import PreferencesSettings from "../PreferencesSettings";

const optIn = () => screen.getByRole("checkbox", { name: /news, offers and monthly updates/ });

describe("<PreferencesSettings />", () => {
  beforeEach(() => {
    mocks.optedIn = false;
    mocks.save.mockReset();
  });

  it("leaves promotional email off until the person turns it on", () => {
    render(<PreferencesSettings />);

    expect(optIn()).not.toBeChecked();
    expect(screen.getByText(/You can turn this off here at any time/)).toBeInTheDocument();
    expect(screen.getByText("Currency form")).toBeInTheDocument();

    fireEvent.click(optIn());

    expect(mocks.save).toHaveBeenCalledWith(true);
  });

  it("lets someone who opted in opt out again", () => {
    mocks.optedIn = true;

    render(<PreferencesSettings />);

    expect(optIn()).toBeChecked();

    fireEvent.click(optIn());

    expect(mocks.save).toHaveBeenCalledWith(false);
  });
});
