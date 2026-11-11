import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Privacy from "../legal/Privacy";
import ServiceProviderRegister from "../legal/ServiceProviderRegister";

describe("Service Provider Register page", () => {
  it("renders each provider as a table with its processing location", () => {
    render(
      <MemoryRouter>
        <ServiceProviderRegister />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Service Provider Register" })).toBeInTheDocument();
    expect(screen.getByText("Supabase, Inc.")).toBeInTheDocument();
    expect(screen.getByText("United States (Ohio)")).toBeInTheDocument();
    expect(screen.getByText("Cloudflare, Inc.")).toBeInTheDocument();
    expect(screen.queryByText(/Review draft/)).not.toBeInTheDocument();
  });

  it("is reachable from the Privacy Policy", () => {
    render(
      <MemoryRouter initialEntries={["/privacy"]}>
        <Routes>
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/policies/service-providers" element={<ServiceProviderRegister />} />
        </Routes>
      </MemoryRouter>,
    );

    const links = screen.getAllByRole("link", { name: "/policies/service-providers" });
    expect(links.length).toBeGreaterThanOrEqual(2);
    links.forEach((link) => expect(link).toHaveAttribute("href", "/policies/service-providers"));
    expect(screen.queryByText(/Review draft/)).not.toBeInTheDocument();
  });
});
