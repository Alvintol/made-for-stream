import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import KeptPlaceholder from "../ui/KeptPlaceholder";

const example = "e.g.\nCharacter reference sheet before work starts";

const Field = () => {
  const [value, setValue] = useState("");

  return (
    <label>
      What the buyer provides
      <KeptPlaceholder>
        <textarea
          placeholder={example}
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
      </KeptPlaceholder>
    </label>
  );
};

describe("<KeptPlaceholder />", () => {
  it("keeps the example under the field once something is typed", () => {
    const { container } = render(<Field />);
    const field = screen.getByLabelText("What the buyer provides");

    expect(field).toHaveAttribute("placeholder", example);
    expect(container.querySelector(".keptPlaceholder")).toBeNull();

    fireEvent.change(field, { target: { value: "Ref sheet" } });

    const kept = container.querySelector(".keptPlaceholder");
    expect(kept).toHaveTextContent("e.g. Character reference sheet before work starts");
    expect(kept).toHaveAttribute("aria-hidden", "true");
    // Straight after the field, so the CSS fallback can find it.
    expect(field.nextElementSibling).toBe(kept);
  });

  it("does not change the field's name for screen readers", () => {
    render(<Field />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Ref sheet" } });

    expect(screen.getByRole("textbox", { name: "What the buyer provides" })).toBeInTheDocument();
  });

  it("removes the example again when the field is emptied", () => {
    const { container } = render(<Field />);
    const field = screen.getByRole("textbox");

    fireEvent.change(field, { target: { value: "Ref sheet" } });
    fireEvent.change(field, { target: { value: "" } });

    expect(container.querySelector(".keptPlaceholder")).toBeNull();
  });
});
