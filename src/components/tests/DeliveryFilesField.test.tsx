import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DeliveryFilesField from "../listingRequests/finalDeliveries/DeliveryFilesField";
import {
  toStorageFileName,
  validateDeliveryFiles,
} from "../../lib/listings/deliveryFiles";

const file = (name: string, size = 10) => {
  const created = new File(["x"], name);
  Object.defineProperty(created, "size", { value: size });
  return created;
};

describe("Files on the final delivery form", () => {
  it("recommends one zip and offers a folder upload", () => {
    render(<DeliveryFilesField files={[]} onChange={vi.fn()} />);

    expect(screen.getByText("Recommended: one .zip file.")).toBeInTheDocument();
    expect(screen.getByLabelText("Upload a folder (zipped for you)")).toHaveAttribute(
      "webkitdirectory",
    );
  });

  it("adds chosen files and offers to zip loose files into one", () => {
    const onChange = vi.fn();
    const { rerender } = render(<DeliveryFilesField files={[]} onChange={onChange} />);

    const chosen = [file("a.png"), file("b.psd")];
    fireEvent.change(screen.getByLabelText("Add files"), { target: { files: chosen } });
    expect(onChange).toHaveBeenCalledWith(chosen);

    rerender(<DeliveryFilesField files={chosen} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Zip these 2 files into one" })).toBeInTheDocument();
  });

  it("refuses a file over 1 GB and keeps the list as it was", () => {
    const onChange = vi.fn();
    render(<DeliveryFilesField files={[]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Add files"), {
      target: { files: [file("huge.mov", 1024 ** 3 + 1)] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("huge.mov is larger than 1 GB");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("delivery file rules", () => {
  it("allows 20 files and 5 GB in all", () => {
    expect(validateDeliveryFiles(Array.from({ length: 20 }, (_, i) => file(`${i}.png`)))).toBeNull();
    expect(validateDeliveryFiles(Array.from({ length: 21 }, (_, i) => file(`${i}.png`)))).toMatch(
      /no more than 20 files/,
    );
    expect(
      validateDeliveryFiles(Array.from({ length: 6 }, (_, i) => file(`${i}.mov`, 1024 ** 3))),
    ).toBe("The files in one final delivery can add up to 5 GB at most.");
  });

  it("keeps file names readable and safe to store", () => {
    expect(toStorageFileName("Emote Pack (final) v2.zip")).toBe("Emote_Pack_final_v2.zip");
    expect(toStorageFileName("Café ☕.psd")).toBe("Cafe_.psd");
    expect(toStorageFileName("???")).toBe("file");
  });
});
