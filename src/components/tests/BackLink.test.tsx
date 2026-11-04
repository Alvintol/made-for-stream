import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import BackLink from "../layout/BackLink";

const routes = [
  { path: "/legal", element: <p>Legal hub</p> },
  { path: "/listing/1", element: <p>A listing</p> },
  { path: "/terms", element: <BackLink fallback="/legal" /> },
];

describe("<BackLink />", () => {
  it("returns to the page the person came from", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/listing/1"] });
    render(<RouterProvider router={router} />);

    await act(() => router.navigate("/terms"));
    fireEvent.click(await screen.findByRole("link", { name: "← Back" }));

    expect(await screen.findByText("A listing")).toBeInTheDocument();
  });

  it("goes to the fallback when the page was opened directly", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/terms"] });
    render(<RouterProvider router={router} />);

    const link = await screen.findByRole("link", { name: "← Back" });

    expect(link).toHaveAttribute("href", "/legal");
    fireEvent.click(link);
    expect(await screen.findByText("Legal hub")).toBeInTheDocument();
  });
});
