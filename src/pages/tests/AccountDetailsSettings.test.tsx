import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  details: null as Record<string, unknown> | null,
  profileSetupSeen: true,
  save: vi.fn(),
}));

vi.mock("../../hooks/settings/useAccountDetails", () => ({
  useAccountDetails: () => ({ data: mocks.details, isLoading: false, isError: false }),
  useSaveAccountDetails: () => ({ mutateAsync: mocks.save, isPending: false, error: null }),
}));

vi.mock("../../hooks/profile/useMyProfile", () => ({
  useMyProfile: () => ({ data: { profile_setup_seen: mocks.profileSetupSeen } }),
}));

import AccountDetailsSettings from "../AccountDetailsSettings";

const saved = {
  account_type: "individual",
  legal_first_name: "Ada",
  legal_last_name: "Buyer",
  date_of_birth: "1990-01-01",
  address_line1: "1 Main St",
  address_line2: null,
  city: "Calgary",
  region: "AB",
  postal_code: "T2T 2T2",
  country_code: "CA",
  business_legal_name: null,
  business_registration_number: null,
  tax_number: "123456789 RT0001",
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/settings/personal"]}>
      <Routes>
        <Route path="/settings/personal" element={<AccountDetailsSettings />} />
        <Route path="/settings/profile" element={<div>Profile page</div>} />
      </Routes>
    </MemoryRouter>,
  );

const fill = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("<AccountDetailsSettings />", () => {
  beforeEach(() => {
    mocks.details = null;
    mocks.profileSetupSeen = true;
    mocks.save.mockReset().mockResolvedValue(undefined);
  });

  it("asks a new account for its details and says they stay private", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Finish setting up your account" })).toBeInTheDocument();
    expect(screen.getByText(/never\s+shown on your profile, your listings or to other members/)).toBeInTheDocument();
    expect(screen.getByText(/legal, tax and business records/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    // Nothing to cancel back to yet.
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("points at what is missing and saves nothing", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    expect(screen.getByText("Enter your legal first name.")).toBeInTheDocument();
    expect(screen.getByText("Choose your country.")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("saves a complete form and sends a first-time account on to its profile", async () => {
    mocks.profileSetupSeen = false;

    renderPage();

    fill(/^Legal first name/, "Ada");
    fill(/^Legal last name/, "Buyer");
    fill(/^Date of birth/, "1990-01-01");
    fill(/^Country/, "CA");
    fill(/^Street address/, "1 Main St");
    fill(/^City or town/, "Calgary");
    fill(/^Province or state/, "AB");
    fill(/^Postal or ZIP code/, "T2T 2T2");

    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          account_type: "individual",
          legal_first_name: "Ada",
          region: "AB",
          country_code: "CA",
          tax_number: null,
        }),
      ),
    );
    expect(await screen.findByText("Profile page")).toBeInTheDocument();
  });

  it("requires the business name only for a business account", () => {
    renderPage();

    expect(screen.getByLabelText(/^Legal name of the business or entity/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("A business or other legal entity"));
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    expect(screen.getByText("Enter the legal name of the business.")).toBeInTheDocument();
  });

  it("hides saved details behind asterisks until the eye button is pressed", () => {
    mocks.details = saved;

    renderPage();

    expect(screen.queryByText(/Ada Buyer/)).not.toBeInTheDocument();
    expect(screen.queryByText(/123456789/)).not.toBeInTheDocument();
    expect(screen.getAllByText("********")).toHaveLength(4);

    fireEvent.click(screen.getByRole("button", { name: "Show details" }));

    expect(screen.getByText("Ada Buyer")).toBeInTheDocument();
    expect(screen.getByText(/1 Main St/)).toHaveTextContent("Canada");
    expect(screen.getByText("123456789 RT0001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide details" }));

    expect(screen.queryByText("Ada Buyer")).not.toBeInTheDocument();
  });

  it("lets saved details be edited, and hides them again after saving", async () => {
    mocks.details = saved;

    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText(/^Legal first name/)).toHaveValue("Ada");

    fill(/^City or town/, "Edmonton");
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ city: "Edmonton" })),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Your details are saved.");
    expect(screen.queryByText("Ada Buyer")).not.toBeInTheDocument();
  });
});
