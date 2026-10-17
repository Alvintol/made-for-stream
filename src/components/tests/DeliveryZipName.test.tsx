import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  zipFiles: vi.fn(async (_files: File[], name: string) => new File(["zip"], name)),
}));

vi.mock("../../lib/listings/deliveryFiles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/listings/deliveryFiles")>()),
  zipFiles: mocks.zipFiles,
}));

import DeliveryFilesField from "../listingRequests/finalDeliveries/DeliveryFilesField";

const file = (name: string, relativePath = "") => {
  const created = new File(["x"], name);
  Object.defineProperty(created, "webkitRelativePath", { value: relativePath });
  return created;
};

describe("a zip made on the form", () => {
  it("is named after the creator and the commission", async () => {
    const onChange = vi.fn();
    render(
      <DeliveryFilesField
        files={[]}
        zipBaseName="meowington 222222222 updated deliverables"
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Upload a folder (zipped for you)"), {
      target: { files: [file("emote.png", "My Folder/emote.png")] },
    });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(mocks.zipFiles.mock.calls[0][1]).toBe("meowington_222222222_updated_deliverables.zip");
    expect(onChange.mock.calls[0][0][0].name).toBe("meowington_222222222_updated_deliverables.zip");
  });

  it("uses the same name when loose files are zipped into one", async () => {
    const onChange = vi.fn();
    render(
      <DeliveryFilesField
        files={[file("a.png"), file("b.psd")]}
        zipBaseName="meowington 222222222 updated deliverables"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Zip these 2 files into one" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(mocks.zipFiles.mock.calls.at(-1)?.[1]).toBe("meowington_222222222_updated_deliverables.zip");
  });
});
