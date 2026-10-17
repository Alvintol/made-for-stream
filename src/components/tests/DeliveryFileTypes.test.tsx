import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listZipEntryNames: vi.fn(),
}));

vi.mock("../../lib/zip", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/zip")>()),
  listZipEntryNames: mocks.listZipEntryNames,
}));

import DeliveryFilesField from "../listingRequests/finalDeliveries/DeliveryFilesField";

const file = (name: string, relativePath = "") => {
  const created = new File(["x"], name);
  Object.defineProperty(created, "webkitRelativePath", { value: relativePath });
  return created;
};

describe("only safe file types can be delivered", () => {
  it("refuses a program file and says which types are allowed", () => {
    const onChange = vi.fn();
    render(<DeliveryFilesField files={[]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Add files"), {
      target: { files: [file("emote.png"), file("setup.exe")] },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      /^For safety, only these file types can be uploaded: .+ Not allowed: setup\.exe\.$/,
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("looks inside a zip and refuses one that holds a program file", async () => {
    mocks.listZipEntryNames.mockResolvedValue({
      names: ["Pack/", "Pack/emote.png", "Pack/run.bat", "__MACOSX/Pack/._emote.png"],
      encrypted: false,
    });
    const onChange = vi.fn();
    render(<DeliveryFilesField files={[]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Add files"), { target: { files: [file("pack.zip")] } });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Not allowed: pack.zip: Pack/run.bat."),
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("accepts a zip of allowed files, ignoring what the operating system added", async () => {
    mocks.listZipEntryNames.mockResolvedValue({
      names: ["Pack/emote.png", "Pack/.DS_Store", "__MACOSX/Pack/._emote.png"],
      encrypted: false,
    });
    const onChange = vi.fn();
    const zip = file("pack.zip");
    render(<DeliveryFilesField files={[]} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Add files"), { target: { files: [zip] } });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([zip]));
  });

  it("refuses a zip it cannot look inside", async () => {
    mocks.listZipEntryNames.mockResolvedValue({ names: ["secret.png"], encrypted: true });
    render(<DeliveryFilesField files={[]} onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Add files"), { target: { files: [file("locked.zip")] } });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "For safety, we look inside every zip before it is uploaded, and locked.zip could not be opened.",
      ),
    );
  });

  it("refuses a folder that holds a program file, before zipping it", () => {
    render(<DeliveryFilesField files={[]} onChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Upload a folder (zipped for you)"), {
      target: {
        files: [file("emote.png", "Pack/emote.png"), file("tool.exe", "Pack/bin/tool.exe"), file(".DS_Store", "Pack/.DS_Store")],
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Not allowed: Pack/bin/tool.exe.");
  });

  it("offers only the allowed types in the file picker", () => {
    render(<DeliveryFilesField files={[]} onChange={vi.fn()} />);

    const accept = screen.getByLabelText("Add files").getAttribute("accept") ?? "";
    expect(accept).toContain(".zip");
    expect(accept).toContain(".vrm");
    expect(accept).not.toContain(".exe");
  });
});
