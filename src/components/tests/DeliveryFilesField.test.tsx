import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DeliveryFilesField from "../listingRequests/finalDeliveries/DeliveryFilesField";
import {
  toStorageFileName,
  toUniqueStorageFileName,
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

  it("refuses a file over 2 GB and keeps the list as it was", () => {
    const onChange = vi.fn();
    render(<DeliveryFilesField files={[]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Add files"), {
      target: { files: [file("huge.mov", 2 * 1024 ** 3 + 1)] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("huge.mov is larger than 2 GB");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("delivery file rules", () => {
  it("allows 50 files and 10 GB in all, within what the commission has left", () => {
    expect(validateDeliveryFiles(Array.from({ length: 50 }, (_, i) => file(`${i}.png`)))).toBeNull();
    expect(validateDeliveryFiles(Array.from({ length: 51 }, (_, i) => file(`${i}.png`)))).toMatch(
      /no more than 50 files/,
    );
    expect(
      validateDeliveryFiles(Array.from({ length: 6 }, (_, i) => file(`${i}.mov`, 2 * 1024 ** 3))),
    ).toBe("The files in one final delivery can add up to 10 GB at most.");
    expect(validateDeliveryFiles([file("a.zip", 1.5 * 1024 ** 3), file("b.zip", 1.5 * 1024 ** 3)], 2 * 1024 ** 3)).toBe(
      "This commission has 2.0 GB of storage left. Remove a file, or send the largest as a link.",
    );
  });

  it("shows the commission storage bar with what is about to be added", () => {
    render(
      <DeliveryFilesField
        files={[file("pack.zip", 1024 ** 3)]}
        usage={{ usedBytes: 3 * 1024 ** 3, limitBytes: 20 * 1024 ** 3, planLabel: "Standard" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("meter", { name: "Commission storage: 20% used" })).toBeInTheDocument();
    expect(screen.getByText("4.0 GB of 20.0 GB (20%)")).toBeInTheDocument();
    expect(screen.getByText(/Standard plan/)).toBeInTheDocument();
  });

  it("refuses to zip a folder over 2 GB in the browser", () => {
    render(<DeliveryFilesField files={[]} onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Upload a folder (zipped for you)"), {
      target: { files: [file("big.mov", 1024 ** 3), file("bigger.mov", 1024 ** 3 + 1)] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Zip it on your computer");
  });

  it("keeps file names readable and safe to store", () => {
    expect(toStorageFileName("Emote Pack (final) v2.zip")).toBe("Emote_Pack_final_v2.zip");
    expect(toStorageFileName("Café ☕.psd")).toBe("Cafe_.psd");
    expect(toStorageFileName("meowington 222222222 updated deliverables.zip")).toBe(
      "meowington_222222222_updated_deliverables.zip",
    );
    expect(toStorageFileName("???")).toBe("file");
  });

  it("gives every stored file a unique id before its extension", () => {
    expect(toUniqueStorageFileName("my pack.zip", "3f9a1c2b7d4e")).toBe("my_pack_3f9a1c2b7d4e.zip");
    expect(toUniqueStorageFileName("Hiyori.model3.json", "000000000001")).toBe("Hiyori.model3_000000000001.json");
    expect(toUniqueStorageFileName("README", "000000000002")).toBe("README_000000000002");

    const first = toUniqueStorageFileName("same.png");
    const second = toUniqueStorageFileName("same.png");
    expect(first).toMatch(/^same_[0-9a-f]{12}\.png$/);
    expect(first).not.toBe(second);
  });
});
