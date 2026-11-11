import { useEffect, useRef } from "react";

// Cloudflare Turnstile: the "are you a person?" check Supabase Auth asks for
// before it sends an email sign-in link. Only on a site built with
// VITE_TURNSTILE_SITE_KEY (prod); without it nothing loads and no check is
// asked for, which is how dev and the tests run. The matching secret is set in
// Supabase Auth -> Attack Protection. See docs/support/auth/sign-in.md.
type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<Turnstile> | null = null;

const loadTurnstile = (): Promise<Turnstile> => {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  scriptPromise ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile missing")));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
};

type TurnstileCheckProps = {
  siteKey: string;
  // A fresh token, or null when it expires or the check fails. Each token
  // works once: remount the component (change its key) after using one.
  // Pass a stable function (a state setter), or the check renders again.
  onToken: (token: string | null) => void;
};

const TurnstileCheck = ({ siteKey, onToken }: TurnstileCheckProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !ref.current) return;
        widgetId = turnstile.render(ref.current, {
          sitekey: siteKey,
          size: "flexible",
          callback: (token: string) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch((error: unknown) => {
        console.warn("AUTH-008: the sign-in check could not load.", error);
      });

    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [siteKey, onToken]);

  return <div ref={ref} className="min-h-[65px]" />;
};

export default TurnstileCheck;
