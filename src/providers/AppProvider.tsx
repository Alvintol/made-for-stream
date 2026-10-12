import { useEffect, useState, type ReactNode } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ActionFailedNotice from "../components/app/ActionFailedNotice";
import { reportFailure } from "../lib/failures/reportFailure";
import { nudgeNotificationEmails } from "../lib/notifications/nudgeNotificationEmails";
import { startPresenceReporting } from "../lib/presence/presence";
import AuthProvider from "./AuthProvider";
import CookiePreferencesProvider from "./CookiePreferencesProvider";
import ThemeProvider from "./ThemeProvider";
import HubProvider from "./hub/HubProvider";

type AppProvidersProps = { children: ReactNode };

const AppProviders = (props: AppProvidersProps) => {
  const { children } = props;

  // True after something a person tried did not go through, until they
  // dismiss the notice, reload, or their next action succeeds.
  const [actionFailed, setActionFailed] = useState(false);

  const [client] = useState(
    () =>
      new QueryClient({
        // Every failed page load is logged for the ops digest (OPS-006).
        queryCache: new QueryCache({
          onError: (error, query) => reportFailure("load", error, query.queryKey[0]),
        }),
        mutationCache: new MutationCache({
          // After anything a person does, ask the API to send the emails the
          // database queued for it (the other person's "your turn" email).
          onSuccess: () => {
            setActionFailed(false);
            nudgeNotificationEmails();
          },
          // Every failed action is logged too, and the person is offered a
          // reload instead of being left with a page that may be out of date.
          onError: (error, _variables, _context, mutation) => {
            reportFailure("action", error, mutation.options.mutationKey?.[0]);
            setActionFailed(true);
          },
        }),
        defaultOptions: {
          queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: true },
        },
      })
  );

  // Tells the database this person is here, so chat emails are only sent
  // to people who are away (lib/presence/presence.ts).
  useEffect(() => startPresenceReporting(), []);

  return (
    <ThemeProvider>
      <CookiePreferencesProvider>
        <QueryClientProvider client={client}>
          <AuthProvider>
            <HubProvider>{children}</HubProvider>
            {actionFailed && <ActionFailedNotice onDismiss={() => setActionFailed(false)} />}
          </AuthProvider>
        </QueryClientProvider>
      </CookiePreferencesProvider>
    </ThemeProvider>
  );
};

export default AppProviders;