import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CookieConsent from "../legal/CookieConsent";
import Footer from "../layout/Footer";
import CookiePreferencesProvider from "../../providers/CookiePreferencesProvider";
import ThemeProvider from "../../providers/ThemeProvider";
import { THEME_STORAGE_KEY } from "../../lib/theme/theme";
import { afterEach, describe, expect, it } from 'vitest';

describe("<Footer />", () => {
  afterEach(() => window.localStorage.removeItem(THEME_STORAGE_KEY));

  it("shows the logo in the colours for the theme", () => {
    const { unmount } = render(
      <MemoryRouter>
        <ThemeProvider>
          <CookiePreferencesProvider>
            <Footer />
          </CookiePreferencesProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("img", { name: "Made for Stream" })).toHaveAttribute("src", "/brand/logo-light.svg");

    unmount();
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(
      <MemoryRouter>
        <ThemeProvider>
          <CookiePreferencesProvider>
            <Footer />
          </CookiePreferencesProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole("img", { name: "Made for Stream" })).toHaveAttribute("src", "/brand/logo-dark.svg");
  });

  it("opens Cookie settings from the footer", () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <CookiePreferencesProvider>
            <Footer />
            <CookieConsent />
          </CookiePreferencesProvider>
        </ThemeProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Cookie settings" }));

    expect(screen.getByRole("dialog", { name: "Cookie settings" })).toBeInTheDocument();
  });
});