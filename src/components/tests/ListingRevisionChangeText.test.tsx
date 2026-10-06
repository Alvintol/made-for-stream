import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ListingRevisionChangeText from "../listings/ListingRevisionChangeText";

describe("<ListingRevisionChangeText />", () => {
  it("puts the old and new values on their own labelled lines", () => {
    render(
      <ListingRevisionChangeText
        change={{
          key: "preview_url",
          label: "Preview image changed",
          from: "https://example.com/old.jpg",
          to: "https://example.com/new.webp",
        }}
      />,
    );

    expect(screen.getByText("Preview image changed")).toBeInTheDocument();

    const fromLine = screen.getByText("From").parentElement;
    const toLine = screen.getByText("To").parentElement;

    expect(fromLine).toHaveTextContent("Fromhttps://example.com/old.jpg");
    expect(toLine).toHaveTextContent("Tohttps://example.com/new.webp");
    expect(fromLine).not.toBe(toLine);
  });

  it("shows a plain sentence when there is no old and new value", () => {
    render(
      <ListingRevisionChangeText change={{ key: "short", label: "Short description changed" }} />,
    );

    expect(screen.getByText("Short description changed")).toBeInTheDocument();
    expect(screen.queryByText("From")).not.toBeInTheDocument();
  });
});
