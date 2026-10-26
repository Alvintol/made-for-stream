import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { privacyVersion } from "../../domain/legal/privacyPolicy";
import { termsVersion } from "../../domain/legal/termsOfService";
import {
  clearPendingPolicyAcceptance,
  readPendingPolicyAcceptance,
} from "../../lib/legal/pendingPolicyAcceptance";
import SignIn from "../SignIn";

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../../providers/AuthProvider", () => ({
  useAuth: () => ({ user: null, session: null, loading: false }),
}));

vi.mock("../../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signInWithOAuth: mocks.signInWithOAuth,
      signInWithOtp: mocks.signInWithOtp,
      signOut: mocks.signOut,
    },
  },
}));

const renderSignIn = () =>
  render(
    <MemoryRouter>
      <SignIn />
    </MemoryRouter>,
  );

const getPolicyCheckbox = () =>
  screen.getByRole("checkbox", { name: /I agree to the Terms of Service and the Privacy Policy/i });

const expectedPending = [
  { policyType: "terms", policyVersion: termsVersion },
  { policyType: "privacy", policyVersion: privacyVersion },
];

describe("SignIn policy acceptance", () => {
  beforeEach(() => {
    mocks.signInWithOAuth.mockReset().mockResolvedValue({ error: null });
    mocks.signInWithOtp.mockReset().mockResolvedValue({ error: null });
    clearPendingPolicyAcceptance();
  });

  afterEach(() => {
    clearPendingPolicyAcceptance();
  });

  it("links to the Terms and Privacy Policy with the box unchecked", () => {
    renderSignIn();

    expect(getPolicyCheckbox()).not.toBeChecked();
    expect(screen.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  });

  it("starts nothing without the box, and makes the box ask for attention instead", () => {
    renderSignIn();

    const twitch = screen.getByRole("button", { name: /Sign in with Twitch/i });

    expect(twitch).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(twitch);

    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Please accept the Terms of Service and Privacy Policy to continue.",
    );
    expect(getPolicyCheckbox().closest(".needsAttention")).not.toBeNull();

    fireEvent.click(getPolicyCheckbox());

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.querySelector(".needsAttention")).toBeNull();
  });

  it("puts the agreement box after the ways to sign in", () => {
    renderSignIn();

    const google = screen.getByRole("button", { name: /Sign in with Google/i });
    const email = screen.getByRole("button", { name: /Send sign-in link/i });

    expect(google.compareDocumentPosition(getPolicyCheckbox()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(email.compareDocumentPosition(getPolicyCheckbox()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does not start a magic link when the form is submitted without acceptance", async () => {
    renderSignIn();

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "buyer@example.com" },
    });
    fireEvent.submit(screen.getByPlaceholderText("you@example.com").closest("form") as HTMLFormElement);

    expect(await screen.findByText(/Please accept the Terms of Service and Privacy Policy/i)).toBeInTheDocument();
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    expect(readPendingPolicyAcceptance()).toBeNull();
  });

  it("parks the accepted versions before starting OAuth", async () => {
    renderSignIn();

    fireEvent.click(getPolicyCheckbox());
    fireEvent.click(screen.getByRole("button", { name: /Sign in with Google/i }));

    await waitFor(() => expect(mocks.signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(mocks.signInWithOAuth.mock.calls[0][0]).toMatchObject({ provider: "google" });
    expect(readPendingPolicyAcceptance()?.policies).toEqual(expectedPending);
  });

  it("parks the accepted versions before sending a magic link", async () => {
    renderSignIn();

    fireEvent.click(getPolicyCheckbox());
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "buyer@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send sign-in link/i }));

    await waitFor(() => expect(mocks.signInWithOtp).toHaveBeenCalledTimes(1));
    expect(readPendingPolicyAcceptance()?.policies).toEqual(expectedPending);
    expect(await screen.findByText(/Link sent/i)).toBeInTheDocument();
  });
});
