import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PolicyAcceptanceCheckbox from "../components/legal/PolicyAcceptanceCheckbox";
import {
  signupPolicyTypes,
  toCurrentPolicyAcceptances,
} from "../domain/legal/policyAcceptance";
import { savePendingPolicyAcceptance } from "../lib/legal/pendingPolicyAcceptance";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";

const classes = {
  page: "space-y-6",
  card: "card mx-auto w-full max-w-md space-y-6 p-6 sm:p-8",

  header: "space-y-2 text-center",
  h1: "pageTitle",
  p: "text-sm leading-6 text-zinc-600",
  signedInEmail: "font-semibold",

  providerStack: "grid gap-3",

  // Two buttons of the same size and shape; only the colours differ.
  socialBtnBase:
    "relative flex h-12 w-full items-center justify-center rounded-xl border px-12 text-sm font-semibold transition duration-200 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
  socialBtnGoogle:
    "border-[var(--hairline-strong)] bg-[rgb(var(--surface))] text-[rgb(var(--ink))] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]",
  socialBtnTwitch:
    "border-[#9146FF] bg-[#9146FF] text-white shadow-[var(--shadow-sm)] hover:bg-[#8037f2] hover:shadow-[var(--shadow-md)]",
  socialBtnIcon: "absolute left-4 inline-flex h-6 w-6 items-center justify-center",
  socialImg: "h-6 w-6 object-contain",

  dividerRow: "flex items-center gap-3",
  dividerLine: "h-px flex-1 bg-[var(--hairline-strong)]",
  dividerText: "text-xs font-semibold uppercase tracking-wide text-zinc-500",

  form: "space-y-3",
  label: "formLabel",
  input: "searchInput w-full",
  btnEmail: "btnOutline w-full",

  // The agreement sits after the ways in, and draws attention to itself
  // when someone tries to continue without it.
  policy: "space-y-2 scroll-mt-32",
  policyBox: "rounded-2xl",
  policyAttention: "needsAttention",

  footer: "flex justify-center",
  homeLink: "text-sm font-semibold text-zinc-600 underline-offset-2 hover:underline",

  row: "flex flex-wrap items-center gap-3",
  btnAlt: "btnOutline",

  msgOk: "text-center text-sm font-semibold text-emerald-700",
  msgErr: "text-center text-sm font-semibold text-rose-700",
  policyError: "formError",

  policyLink: "font-semibold underline underline-offset-2",
} as const;

// Pulls a readable message from an unknown thrown value
const getErrorMessage = (error: unknown, fallback: string): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : fallback;

// Asked before every sign-in method; there is no separate sign-up step.
const POLICY_REQUIRED_MESSAGE =
  "Please accept the Terms of Service and Privacy Policy to continue.";

// Standard post-auth redirect back into the app
const getRedirectTo = (): string => `${window.location.origin}/`;

// Google logo drawn as inline SVG so there is no external asset dependency
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 10.2v4.1h5.9c-.3 1.4-1.9 4.1-5.9 4.1-3.5 0-6.4-2.9-6.4-6.4s2.9-6.4 6.4-6.4c2 0 3.3.8 4.1 1.6l2.8-2.7C17.1 2.9 14.8 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4 9.6-9.7 0-.7-.1-1.3-.2-1.8H12Z"
    />
    <path
      fill="#34A853"
      d="M2 12c0 1.6.4 3.2 1.3 4.5l3.4-2.6c-.2-.5-.3-1.2-.3-1.9s.1-1.3.3-1.9L3.3 7.5C2.4 8.8 2 10.4 2 12Z"
    />
    <path
      fill="#FBBC05"
      d="M12 22c2.7 0 5-.9 6.7-2.5l-3.2-2.5c-.9.6-2 1-3.5 1-2.7 0-5-1.8-5.8-4.3l-3.5 2.7C4.6 19.8 8 22 12 22Z"
    />
    <path
      fill="#4285F4"
      d="M21.6 10.2H12v4.1h5.9c-.3 1.2-1.1 2.2-2.3 2.9l3.2 2.5c1.9-1.8 2.8-4.3 2.8-7.5 0-.7-.1-1.3-.2-2Z"
    />
  </svg>
);

const TwitchIcon = () => (
  <img
    src="/twitch-logo.png"
    alt=""
    className={classes.socialImg}
    aria-hidden="true"
    draggable={false}
  />
);

type SocialButtonProps = {
  label: string;
  provider: "google" | "twitch";
  onClick: () => void;
  disabled?: boolean;
};

// Shared social button used by Google and Twitch
const SocialButton = (props: SocialButtonProps) => {
  const { label, provider, onClick, disabled = false } = props;

  const isGoogle = provider === "google";

  const buttonClassName = [
    classes.socialBtnBase,
    isGoogle ? classes.socialBtnGoogle : classes.socialBtnTwitch,
  ].join(" ");

  return (
    <button
      className={buttonClassName}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <span className={classes.socialBtnIcon}>
        {isGoogle ? <GoogleIcon /> : <TwitchIcon />}
      </span>

      {label}
    </button>
  );
};

const SignIn = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  // Counts attempts to continue without the box; each one replays the shake.
  const [policyAttempts, setPolicyAttempts] = useState(0);
  const policyRef = useRef<HTMLDivElement>(null);

  // Every way in starts here: without the box ticked, the box shakes, turns
  // red, says why and takes the focus; nothing is sent.
  const requireAgreement = (): boolean => {
    if (agreed) return true;

    setPolicyAttempts((count) => count + 1);

    requestAnimationFrame(() => {
      policyRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      document.getElementById("signin-policy-acceptance")?.focus({ preventScroll: true });
    });

    return false;
  };

  const onAgreedChange = (checked: boolean) => {
    setAgreed(checked);
    if (checked) setPolicyAttempts(0);
  };

  // Sign-in redirects away, so the acceptance is parked and recorded by
  // PolicyAcceptanceGate once the user is authenticated.
  const parkPolicyAcceptance = () => {
    savePendingPolicyAcceptance(toCurrentPolicyAcceptances(signupPolicyTypes));
  };

  // Starts OAuth sign-in with the selected provider
  const onOAuthSignIn = async (provider: "twitch" | "google") => {
    setErr(null);
    setSent(false);

    if (!requireAgreement()) return;

    try {
      setBusy(true);
      parkPolicyAcceptance();

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getRedirectTo(),
        },
      });

      if (error) throw error;
    } catch (error) {
      setErr(
        getErrorMessage(
          error,
          `Could not start ${provider} sign-in.`
        )
      );
      setBusy(false);
    }
  };

  // Sends an email magic-link sign-in
  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErr(null);
    setSent(false);

    const value = email.trim();

    if (!requireAgreement()) return;

    if (!value) {
      setErr("Please enter your email.");
      return;
    }

    try {
      setBusy(true);
      parkPolicyAcceptance();

      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: {
          emailRedirectTo: getRedirectTo(),
        },
      });

      if (error) throw error;

      setSent(true);
    } catch (error) {
      setErr(getErrorMessage(error, "Could not send sign-in link."));
    } finally {
      setBusy(false);
    }
  };

  // Signs the current user out
  const onSignOut = async () => {
    setErr(null);

    try {
      setBusy(true);

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      navigate("/");
    } catch (error) {
      setErr(getErrorMessage(error, "Could not sign out."));
    } finally {
      setBusy(false);
    }
  };

  if (!loading && user) {
    return (
      <div className={classes.page}>
        <div className={classes.card}>
          <h1 className={classes.h1}>You’re signed in</h1>

          <p className={classes.p}>
            Signed in as{" "}
            <span className={classes.signedInEmail}>
              {user.email ?? "your account"}
            </span>.
          </p>

          <div className={classes.row}>
            <button
              className={classes.btnAlt}
              onClick={onSignOut}
              type="button"
              disabled={busy}
            >
              Sign out
            </button>

            <Link className={classes.btnAlt} to="/creators">
              Browse creators
            </Link>
          </div>

          {err && <div className={classes.msgErr}>{err}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={classes.page}>
      <div className={classes.card}>
        <div className={classes.header}>
          <h1 className={classes.h1}>Sign in</h1>
          <p className={classes.p}>
            Use Twitch or Google, or get a sign-in link by email.
          </p>
        </div>

        <div className={classes.providerStack}>
          <SocialButton
            provider="twitch"
            label="Sign in with Twitch"
            onClick={() => void onOAuthSignIn("twitch")}
            disabled={busy}
          />

          <SocialButton
            provider="google"
            label="Sign in with Google"
            onClick={() => void onOAuthSignIn("google")}
            disabled={busy}
          />
        </div>

        <div className={classes.dividerRow}>
          <div className={classes.dividerLine} />
          <div className={classes.dividerText}>or by email</div>
          <div className={classes.dividerLine} />
        </div>

        <form className={classes.form} onSubmit={onSubmit} noValidate>
          <label className={classes.label} htmlFor="signin-email">
            Email
          </label>

          <input
            id="signin-email"
            className={classes.input}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />

          <button className={classes.btnEmail} type="submit" disabled={busy}>
            {busy ? "Working…" : "Send sign-in link"}
          </button>
        </form>

        <div
          key={policyAttempts}
          ref={policyRef}
          className={classes.policy}
        >
          <div className={`${classes.policyBox} ${policyAttempts > 0 ? classes.policyAttention : ""}`}>
          <PolicyAcceptanceCheckbox
            id="signin-policy-acceptance"
            checked={agreed}
            onChange={onAgreedChange}
            disabled={busy}
          >
            I agree to the{" "}
            <Link className={classes.policyLink} to="/terms" target="_blank" rel="noopener">
              Terms of Service
            </Link>{" "}
            and the{" "}
            <Link className={classes.policyLink} to="/privacy" target="_blank" rel="noopener">
              Privacy Policy
            </Link>
            .
          </PolicyAcceptanceCheckbox>
          </div>

          {policyAttempts > 0 && (
            <p className={classes.policyError} role="alert">
              {POLICY_REQUIRED_MESSAGE}
            </p>
          )}
        </div>

        {sent && !err && (
          <div className={classes.msgOk}>Link sent. Check your inbox and spam folder.</div>
        )}

        {err && <div className={classes.msgErr}>{err}</div>}

        <div className={classes.footer}>
          <Link className={classes.homeLink} to="/">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignIn;