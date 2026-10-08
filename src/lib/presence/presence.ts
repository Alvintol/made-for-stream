import { supabase } from "../supabaseClient";

// Who is online (public.user_presence, 20261007_149).
//
// The database treats someone as online for five minutes after they were
// last seen, and only emails about a chat message when the recipient is not
// online. This file is how the website says "this person is here".
//
// It reports on real activity (a click, a key, a scroll, coming back to the
// tab) at most once a minute. There is no timer: a tab left open in the
// background reports nothing, so it stops by itself (OPS-005).
//
// For live chat over websockets: when the chat opens its Supabase Realtime
// channel, call reportPresence() on join and on each presence sync. The
// database side and the email rule do not change.
const REPORT_EVERY_MS = 60_000;

let lastReportedAt = 0;

export const reportPresence = (): void => {
  const now = Date.now();

  if (document.visibilityState !== "visible" || now - lastReportedAt < REPORT_EVERY_MS) {
    return;
  }

  lastReportedAt = now;

  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        await supabase.rpc("touch_user_presence");
      }
    } catch {
      // Best-effort: at worst the person gets an email they did not need.
    }
  })();
};

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "focus"] as const;

// Starts reporting; returns the function that stops it.
export const startPresenceReporting = (): (() => void) => {
  reportPresence();

  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, reportPresence, { passive: true });
  }

  document.addEventListener("visibilitychange", reportPresence);

  return () => {
    for (const event of ACTIVITY_EVENTS) {
      window.removeEventListener(event, reportPresence);
    }

    document.removeEventListener("visibilitychange", reportPresence);
  };
};
