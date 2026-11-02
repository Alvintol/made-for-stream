import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import { loadStartingLanguage } from "./lib/i18n/i18n";
import { reloadForNewRelease } from "./lib/reloadForNewRelease";
import AppProviders from "./providers/AppProvider";
// Fonts are bundled and served from our own origin rather than Google Fonts,
// so loading a page makes no third-party font requests.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";

import "./styles/index.css";
import "./styles/theme.css";
import "./styles/ui.css";

window.addEventListener("vite:preloadError", reloadForNewRelease);

void loadStartingLanguage().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BrowserRouter>
        <AppProviders>
          <App />
        </AppProviders>
      </BrowserRouter>
    </React.StrictMode>
  );
});