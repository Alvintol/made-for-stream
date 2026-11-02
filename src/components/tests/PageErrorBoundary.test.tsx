import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PageErrorBoundary from "../app/PageErrorBoundary";

vi.mock("../../lib/failures/reportFailure", () => ({
  reportFailure: vi.fn(),
}));

const Broken = (): never => {
  throw new Error("Failed to fetch dynamically imported module");
};

describe("PageErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it("shows the page when nothing is wrong", () => {
    render(
      <PageErrorBoundary resetKey="/market">
        <p>The market</p>
      </PageErrorBoundary>,
    );

    expect(screen.getByText("The market")).toBeInTheDocument();
  });

  it("offers a reload instead of a blank screen", () => {
    render(
      <PageErrorBoundary resetKey="/market">
        <Broken />
      </PageErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("This page didn't load");
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
  });

  it("clears the failure on moving to another page", () => {
    const { rerender } = render(
      <PageErrorBoundary resetKey="/market">
        <Broken />
      </PageErrorBoundary>,
    );

    rerender(
      <PageErrorBoundary resetKey="/creators">
        <p>The creators</p>
      </PageErrorBoundary>,
    );

    expect(screen.getByText("The creators")).toBeInTheDocument();
  });
});
