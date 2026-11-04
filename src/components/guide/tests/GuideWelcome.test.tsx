import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  seen: false as boolean | undefined,
  marked: 0,
}));

vi.mock("../../../hooks/guide/useGuide", () => ({
  useGuideWelcomeSeen: () => ({ data: mocks.seen }),
  useMarkGuideWelcomeSeen: () => ({
    mutate: () => {
      mocks.marked += 1;
    },
  }),
}));

import GuideWelcome from "../GuideWelcome";

const renderAt = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/guide/creators" element={<p>Creator guide page</p>} />
        <Route path="*" element={<GuideWelcome />} />
      </Routes>
    </MemoryRouter>,
  );

describe("<GuideWelcome />", () => {
  beforeEach(() => {
    mocks.seen = false;
    mocks.marked = 0;
  });

  it("welcomes someone who hasn't seen it, and opens the guide they pick", () => {
    renderAt("/market");

    expect(screen.getByRole("heading", { name: "Welcome to Made for Stream" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Creator guide/ }));

    expect(mocks.marked).toBe(1);
    expect(screen.getByText("Creator guide page")).toBeInTheDocument();
  });

  it("records it as seen when put off", () => {
    renderAt("/market");

    fireEvent.click(screen.getAllByRole("button", { name: "Maybe later" }).at(-1) as HTMLElement);

    expect(mocks.marked).toBe(1);
  });

  it("stays away once seen, while it's loading, and during a tour", () => {
    mocks.seen = true;
    const { unmount } = renderAt("/market");
    expect(screen.queryByRole("heading", { name: "Welcome to Made for Stream" })).not.toBeInTheDocument();
    unmount();

    mocks.seen = undefined;
    const second = renderAt("/market");
    expect(screen.queryByRole("heading", { name: "Welcome to Made for Stream" })).not.toBeInTheDocument();
    second.unmount();

    mocks.seen = false;
    renderAt("/market?tour=market");
    expect(screen.queryByRole("heading", { name: "Welcome to Made for Stream" })).not.toBeInTheDocument();
  });
});
