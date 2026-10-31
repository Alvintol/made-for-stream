import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LanguageSync from "../app/LanguageSync";

const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  user: null as { id: string } | null,
  preferences: undefined as { language?: string | null; browser_language?: string | null } | null | undefined,
}));

vi.mock("../../hooks/money/useDisplayCurrency", () => ({
  useDisplayPreferences: () => ({ data: mocks.preferences }),
}));
vi.mock("../../providers/AuthProvider", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("../../lib/supabaseClient", () => ({ supabase: { from: () => ({ upsert: mocks.upsert }) } }));

const browserAsks = (languages: string[]) =>
  vi.spyOn(navigator, "languages", "get").mockReturnValue(languages);

describe("saving the language a browser shows the site in", () => {
  beforeEach(() => {
    mocks.upsert.mockClear();
    mocks.user = { id: "user-1" };
    mocks.preferences = null;
  });

  afterEach(() => vi.restoreAllMocks());

  it("saves it for someone who never chose a language", () => {
    browserAsks(["es-US"]);
    render(<LanguageSync />);

    expect(mocks.upsert).toHaveBeenCalledWith(
      { user_id: "user-1", browser_language: "es" },
      { onConflict: "user_id" },
    );
  });

  it("saves a change of browser language", () => {
    browserAsks(["fr-CA"]);
    mocks.preferences = { browser_language: "es" };
    render(<LanguageSync />);

    expect(mocks.upsert).toHaveBeenCalledWith(
      { user_id: "user-1", browser_language: "fr" },
      { onConflict: "user_id" },
    );
  });

  it("does not write when it is already saved", () => {
    browserAsks(["es-US"]);
    mocks.preferences = { browser_language: "es" };
    render(<LanguageSync />);

    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("never writes for an English reader", () => {
    browserAsks(["en-US"]);
    render(<LanguageSync />);

    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("leaves someone's own choice alone", () => {
    browserAsks(["es-US"]);
    mocks.preferences = { language: "fr" };
    render(<LanguageSync />);

    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("waits until the saved preferences have loaded, and skips visitors", () => {
    browserAsks(["es-US"]);
    mocks.preferences = undefined;
    render(<LanguageSync />);

    mocks.preferences = null;
    mocks.user = null;
    render(<LanguageSync />);

    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
