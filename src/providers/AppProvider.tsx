import { useState, type ReactNode } from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { nudgeNotificationEmails } from "../lib/notifications/nudgeNotificationEmails";
import AuthProvider from "./AuthProvider";
import CookiePreferencesProvider from "./CookiePreferencesProvider";
import ThemeProvider from "./ThemeProvider";
import HubProvider from "./hub/HubProvider";

type AppProvidersProps = { children: ReactNode };

const AppProviders = (props: AppProvidersProps) => {
  const { children } = props;

  const [client] = useState(
    () =>
      new QueryClient({
        // After anything a person does, ask the API to send the emails the
        // database queued for it (the other person's "your turn" email).
        mutationCache: new MutationCache({ onSuccess: nudgeNotificationEmails }),
        defaultOptions: {
          queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: true },
        },
      })
  );

  return (
    <ThemeProvider>
      <CookiePreferencesProvider>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <HubProvider>{children}</HubProvider>
          </AuthProvider>
        </QueryClientProvider>
      </CookiePreferencesProvider>
    </ThemeProvider>
  );
};

export default AppProviders;