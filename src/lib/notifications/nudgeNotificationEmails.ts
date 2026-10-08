import { supabase } from "../supabaseClient";

// Commission emails are queued by the database when something happens
// (20261007_148) and sent by the API. This asks the API to send what is
// waiting, shortly after any action on the site, so the other person hears
// within seconds. Best-effort: the API also sends hourly on its own, so a
// failure here only delays an email.
//
// Calls made close together share one request. The timer fires once and is
// gone; nothing here repeats or polls.
let pending: ReturnType<typeof setTimeout> | null = null;

const getApiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

export const nudgeNotificationEmails = (): void => {
  if (pending) return;

  pending = setTimeout(() => {
    pending = null;

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;

        if (!accessToken) return;

        await fetch(`${getApiBase()}/api/notifications/drain`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch {
        // Best-effort: see above.
      }
    })();
  }, 1500);
};
