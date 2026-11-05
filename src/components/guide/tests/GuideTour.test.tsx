import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import GuideTour from "../GuideTour";

const Address = () => <div data-testid="address">{useLocation().search}</div>;

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <button type="button" data-tour="downloads-list">
        A purchase
      </button>
      <a href="/guide" data-tour="footer-guide">
        Guide
      </a>
      <GuideTour />
      <Address />
    </MemoryRouter>,
  );

describe("<GuideTour />", () => {
  it("does nothing without a known tour in the address", () => {
    renderAt("/downloads?tour=nope");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("walks through the steps and back", async () => {
    renderAt("/downloads?tour=downloads");

    expect(screen.getByRole("dialog", { name: "Your downloads" })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "Purchases" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
  });

  it("keeps one spotlight across steps, so it slides instead of popping", () => {
    renderAt("/downloads?tour=downloads");
    const spotlight = document.querySelector("[data-spotlight]");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(spotlight).not.toBeNull();
    expect(document.querySelector("[data-spotlight]")).toBe(spotlight);
  });

  it("lights up and pulses once the spotlight lands on its part", async () => {
    // jsdom draws nothing, so give the target a box to be found by.
    const button = () => screen.getByRole("button", { name: "A purchase" });
    renderAt("/downloads?tour=downloads");
    button().getClientRects = () => [new DOMRect(10, 10, 100, 40)] as unknown as DOMRectList;

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(document.querySelector("[data-spotlight]")).toHaveClass("isLit"));
    await waitFor(() => expect(document.querySelector("[data-spotlight-pulse]")).not.toBeNull(), {
      timeout: 2000,
    });
  });

  it("ends on Done by pointing out the footer's Guide link, then takes the tour out of the address", async () => {
    renderAt("/downloads?folder=all&tour=downloads");
    // jsdom draws nothing, so give the link a box to be found by.
    screen.getByRole("link", { name: "Guide" }).getClientRects = () =>
      [new DOMRect(10, 500, 60, 20)] as unknown as DOMRectList;

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(screen.getByRole("dialog", { name: "The guide is always here" })).toBeInTheDocument();
    expect(screen.queryByText(/Step \d of/)).not.toBeInTheDocument();
    await waitFor(() => expect(document.querySelector("[data-spotlight]")).toHaveClass("isLit"));
    expect(screen.getByTestId("address")).toHaveTextContent("tour=downloads");

    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("address")).toHaveTextContent("?folder=all");
  });

  it("ends the same way from End tour, partway through", () => {
    renderAt("/downloads?tour=downloads");

    fireEvent.click(screen.getByRole("button", { name: "End tour" }));

    expect(screen.getByRole("dialog", { name: "The guide is always here" })).toBeInTheDocument();
  });

  it("ends on Escape, and a second Escape skips the footer step", async () => {
    renderAt("/downloads?tour=downloads");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "The guide is always here" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the page from being clicked while it runs", () => {
    renderAt("/downloads?tour=downloads");

    // The blocker covers the page; the tour card is the only thing to use.
    expect(document.body.querySelector(".fixed.inset-0")).not.toBeNull();
  });
});
