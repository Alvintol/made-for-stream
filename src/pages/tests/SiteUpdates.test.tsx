import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// 23 versions, newest first: V0.23.00 down to V0.1.00.
vi.mock("../../domain/site/siteUpdates", () => ({
  siteVersion: "V0.23.00",
  siteUpdatesPageSize: 10,
  siteUpdates: Array.from({ length: 23 }, (_, index) => ({
    version: `V0.${23 - index}.00`,
    date: "2026-10-13",
    title: `Title ${23 - index}`,
    changes: [`Change in ${23 - index}`],
  })),
}));

import SiteUpdates from "../SiteUpdates";

const versionsShown = () =>
  screen.getAllByRole("group").map((row) => row.querySelector("summary span")?.textContent);

describe("<SiteUpdates />", () => {
  it("lists the ten latest versions with their dates, the latest one open", () => {
    render(<SiteUpdates />);

    const rows = screen.getAllByRole("group");

    expect(rows).toHaveLength(10);
    expect(versionsShown()[0]).toBe("V0.23.00");
    expect(versionsShown()[9]).toBe("V0.14.00");
    expect(rows[0]).toHaveTextContent("October 13, 2026");
    expect(rows[0]).toHaveAttribute("open");
    expect(rows[1]).not.toHaveAttribute("open");
    expect(screen.getByRole("button", { name: "Newer versions" })).toBeDisabled();
  });

  it("moves to the next ten, then the rest, with the arrow, and back again", () => {
    render(<SiteUpdates />);

    const older = screen.getByRole("button", { name: "Older versions" });

    fireEvent.click(older);
    expect(versionsShown()).toHaveLength(10);
    expect(versionsShown()[0]).toBe("V0.13.00");
    expect(screen.getByText("Versions 11 to 20 of 23")).toBeInTheDocument();

    fireEvent.click(older);
    expect(versionsShown()).toEqual(["V0.3.00", "V0.2.00", "V0.1.00"]);
    expect(older).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Newer versions" }));
    expect(versionsShown()[0]).toBe("V0.13.00");
  });
});
