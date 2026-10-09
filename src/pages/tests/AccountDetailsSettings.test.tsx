import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  details: null as Record<string, unknown> | null,
  profileSetupSeen: true,
  nameChosen: true,
  saveName: vi.fn(),
  save: vi.fn(),
  saveMarketing: vi.fn(),
}));

vi.mock("../../hooks/settings/useAccountDetails", () => ({
  useAccountDetails: () => ({ data: mocks.details, isLoading: false, isError: false }),
  useSaveAccountDetails: () => ({ mutateAsync: mocks.save, isPending: false, error: null }),
  useSaveMarketingEmails: () => ({ mutateAsync: mocks.saveMarketing }),
  useSaveDisplayName: () => ({ mutateAsync: mocks.saveName, isPending: false, error: null }),
}));

vi.mock("../../hooks/profile/useMyProfile", () => ({
  useMyProfile: () => ({
    data: {
      profile_setup_seen: mocks.profileSetupSeen,
      display_name: mocks.nameChosen ? "Pastel Fox" : "New member",
      display_name_auto: !mocks.nameChosen,
    },
  }),
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
    mocks.nameChosen = true;
    mocks.saveName.mockReset().mockResolvedValue(undefined);
    mocks.save.mockReset().mockResolvedValue(undefined);
    mocks.saveMarketing.mockReset().mockResolvedValue(undefined);
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

    // Promotional email is asked here, and is never ticked for the person.
    const optIn = screen.getByRole("checkbox", { name: /news, offers and monthly updates/ });
    expect(optIn).not.toBeChecked();
    fireEvent.click(optIn);

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
    expect(mocks.saveMarketing).toHaveBeenCalledWith(true);
  });

  it("makes a new account choose a public display name before anything is saved", async () => {
    mocks.nameChosen = false;

    renderPage();

    const name = screen.getByLabelText("Display name");

    // Never pre-filled, least of all from the email address.
    expect(name).toHaveValue("");
    expect(screen.getByText(/Unlike the details below, this is public/)).toBeInTheDocument();

    fill(/^Legal first name/, "Ada");
    fill(/^Legal last name/, "Buyer");
    fill(/^Date of birth/, "1990-01-01");
    fill(/^Country/, "IE");
    fill(/^Street address/, "1 Main St");
    fill(/^City or town/, "Dublin");

    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    expect(name).toHaveAccessibleDescription("Enter a display name of 2 to 50 characters.");
    expect(name).toHaveFocus();
    expect(mocks.saveName).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();

    fireEvent.change(name, { target: { value: " Pastel Fox " } });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.saveName).toHaveBeenCalledWith(" Pastel Fox ");
    // The name is saved first: details are useless without it.
    expect(mocks.saveName.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.save.mock.invocationCallOrder[0],
    );
  });

  it("asks an account that has details but no chosen name for the name, and cannot be cancelled", () => {
    mocks.details = saved;
    mocks.nameChosen = false;

    renderPage();

    expect(screen.getByRole("heading", { name: "Finish setting up your account" })).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Legal first name/)).toHaveValue("Ada");
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("does not ask for a display name once one has been chosen", () => {
    renderPage();

    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();
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

    // The email question belongs to the first save only.
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    fill(/^City or town/, "Edmonton");
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ city: "Edmonton" })),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Your details are saved.");
    expect(screen.queryByText("Ada Buyer")).not.toBeInTheDocument();
  });
});
