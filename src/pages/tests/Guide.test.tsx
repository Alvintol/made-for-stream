import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GuideFacts } from "../../domain/guide/guide";

const mocks = vi.hoisted(() => ({
  facts: null as unknown as GuideFacts,
}));

vi.mock("../../hooks/guide/useGuide", () => ({
  useGuideFacts: () => ({ facts: mocks.facts, isLoading: false }),
}));

import Guide from "../Guide";

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/guide" element={<Guide />} />
        <Route path="/guide/:track" element={<Guide />} />
      </Routes>
    </MemoryRouter>,
  );

const step = (key: string) => within(document.getElementById(`step-${key}`) as HTMLElement);

describe("<Guide />", () => {
  beforeEach(() => {
    mocks.facts = {
      signedIn: true,
      isCreator: false,
      profileReady: true,
      applicationStatus: "submitted",
      payoutsReady: false,
      progress: null,
    };
  });

  it("offers both guides", () => {
    renderAt("/guide");

    expect(screen.getByRole("link", { name: /Creator guide/ })).toHaveAttribute("href", "/guide/creators");
    expect(screen.getByRole("link", { name: /Buyer guide/ })).toHaveAttribute("href", "/guide/buyers");
  });

  it("ticks what the account has done and shows what it's waiting on", () => {
    renderAt("/guide/creators");

    expect(step("profile").getByText("Done")).toBeInTheDocument();
    expect(step("apply").getByText("Waiting for review")).toBeInTheDocument();
    expect(step("payouts").getByText("To do")).toBeInTheDocument();
  });

  it("offers a tour only of pages this person can open", () => {
    renderAt("/guide/creators");

    expect(step("profile").getByRole("link", { name: "Show me" })).toHaveAttribute(
      "href",
      "/settings/profile?tour=profile",
    );
    // Not a creator yet: the dashboard would turn them away.
    expect(step("dashboard").queryByRole("link", { name: "Show me" })).not.toBeInTheDocument();
  });

  it("still reads for someone signed out, without ticks or tours", () => {
    mocks.facts = { ...mocks.facts, signedIn: false, profileReady: false };

    renderAt("/guide/buyers");

    expect(screen.getByText(/Sign in to see which steps/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Show me" })).not.toBeInTheDocument();
    expect(screen.queryByText("To do")).not.toBeInTheDocument();
  });
});
