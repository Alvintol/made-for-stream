import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  getMissingPolicyTypes,
  getPolicyChangeSummaries,
  signupPolicyTypes,
  toCurrentPolicyAcceptances,
} from "../../domain/legal/policyAcceptance";
import {
  logPolicyAcceptanceFailure,
  usePolicyAcceptances,
  useRecordPolicyAcceptances,
} from "../../hooks/legal/usePolicyAcceptances";
import {
  clearPendingPolicyAcceptance,
  readPendingPolicyAcceptance,
} from "../../lib/legal/pendingPolicyAcceptance";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../providers/AuthProvider";
import PolicyAcceptanceCheckbox from "./PolicyAcceptanceCheckbox";

type FlushState = "idle" | "running" | "done";

type PolicyAcceptanceGateProps = {
  children: ReactNode;
};

const classes = {
  card: "card mx-auto max-w-xl space-y-4 p-6",
  title: "pageTitle",
  text: "text-sm leading-6 text-zinc-600",
  link: "font-semibold underline underline-offset-2",
  row: "flex flex-wrap items-center gap-3",
  button: "btnPrimary",
  secondary: "btnOutline",
  error: "notice noticeError",
  changes: "space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4",
  changesTitle: "text-sm font-bold text-zinc-900",
  changesList: "list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-700",
  loading: "py-16 text-center text-sm text-zinc-500",
} as const;

// Pages a signed-in user can still reach before accepting: the documents
// they are being asked to accept, and sign-in (to sign out).
const isExemptPath = (pathname: string): boolean =>
  pathname === "/signin" ||
  pathname === "/legal" ||
  pathname === "/privacy" ||
  pathname === "/terms" ||
  pathname.startsWith("/terms/") ||
  pathname.startsWith("/policies/");

// Signed-in users must accept the current Terms of Service and Privacy
// Policy before using Made for Stream.
//
// Acceptance given on the sign-in page is recorded here once the user is
// authenticated (sign-in redirects away, so it is parked in the browser).
// If that record is missing, failed, or covers an older version, the user
// is asked again and nothing else is shown until they accept.
const PolicyAcceptanceGate = (props: PolicyAcceptanceGateProps) => {
  const { children } = props;
  const { pathname } = useLocation();
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const recordAcceptances = useRecordPolicyAcceptances();
  const { mutateAsync } = recordAcceptances;

  const [flushState, setFlushState] = useState<FlushState>("idle");
  const [agreed, setAgreed] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const attemptedForUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) {
      attemptedForUserRef.current = null;
      setFlushState("idle");
      return;
    }

    if (attemptedForUserRef.current === userId) return;

    attemptedForUserRef.current = userId;

    const pending = readPendingPolicyAcceptance();

    if (!pending) {
      setFlushState("done");
      return;
    }

    const flush = async () => {
      setFlushState("running");

      try {
        // Records the versions the user saw when they ticked the box.
        await mutateAsync({ policies: pending.policies });
        clearPendingPolicyAcceptance();
      } catch (error) {
        // Kept for a later attempt; the gate below asks in the meantime.
        logPolicyAcceptanceFailure("signup acceptance", error);
      } finally {
        setFlushState("done");
      }
    };

    void flush();
  }, [userId, mutateAsync]);

  const statusQuery = usePolicyAcceptances({
    policyTypes: signupPolicyTypes,
    enabled: Boolean(userId) && flushState === "done",
  });

  useEffect(() => {
    if (statusQuery.isError) {
      logPolicyAcceptanceFailure("acceptance status check", statusQuery.error);
    }
  }, [statusQuery.isError, statusQuery.error]);

  if (isExemptPath(pathname)) return <>{children}</>;

  if (authLoading) {
    return <p className={classes.loading}>Loading…</p>;
  }

  if (!userId) return <>{children}</>;

  const onSignOut = async () => {
    setSigningOut(true);

    try {
      await supabase.auth.signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const signOutButton = (
    <button
      className={classes.secondary}
      type="button"
      disabled={signingOut}
      onClick={() => void onSignOut()}
    >
      Sign out
    </button>
  );

  if (statusQuery.isError) {
    return (
      <section className={classes.card} aria-label="Terms check failed">
        <h1 className={classes.title}>We couldn&rsquo;t check your account</h1>
        <p className={classes.text}>
          We need to confirm you&rsquo;ve accepted our Terms of Service and
          Privacy Policy before you continue. Please try again.
        </p>
        <div className={classes.row}>
          <button
            className={classes.button}
            type="button"
            onClick={() => void statusQuery.refetch()}
          >
            Try again
          </button>
          {signOutButton}
        </div>
      </section>
    );
  }

  if (flushState !== "done" || !statusQuery.data) {
    return <p className={classes.loading}>Loading…</p>;
  }

  const missingPolicyTypes = getMissingPolicyTypes(signupPolicyTypes, statusQuery.data);

  if (missingPolicyTypes.length === 0) return <>{children}</>;

  // What is different since this person last accepted, so they do not have
  // to open each document and hunt for it.
  const changeSummaries = getPolicyChangeSummaries(
    missingPolicyTypes,
    statusQuery.data,
  );

  const onAccept = async () => {
    setErrMsg(null);

    try {
      await mutateAsync({
        policies: toCurrentPolicyAcceptances(missingPolicyTypes),
      });
      clearPendingPolicyAcceptance();
      setAgreed(false);
    } catch (error) {
      logPolicyAcceptanceFailure("gate acceptance", error);
      setErrMsg("We couldn't save your acceptance. Please try again.");
    }
  };

  return (
    <section className={classes.card} aria-label="Accept terms and privacy policy">
      <h1 className={classes.title}>Please review our terms</h1>
      <p className={classes.text}>
        To keep using Made for Stream, please review and accept the current Terms of
        Service and Privacy Policy.
      </p>

      {changeSummaries.map((summary) => (
        <div className={classes.changes} key={summary.policyType}>
          <h2 className={classes.changesTitle}>
            What changed in the {summary.title} ({summary.version})
          </h2>

          {summary.items.length > 0 ? (
            <ul className={classes.changesList}>
              {summary.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className={classes.text}>
              This document was updated. Open it below to read the current text.
            </p>
          )}
        </div>
      ))}

      {changeSummaries.length > 0 && (
        <p className={classes.text}>
          This is a summary to save you looking for the changes. What you are accepting
          is the full text of each document, linked below.
        </p>
      )}

      <PolicyAcceptanceCheckbox
        id="policy-gate-acceptance"
        checked={agreed}
        onChange={setAgreed}
        disabled={recordAcceptances.isPending}
      >
        I agree to the{" "}
        <Link className={classes.link} to="/terms" target="_blank" rel="noopener">
          Terms of Service
        </Link>{" "}
        and the{" "}
        <Link className={classes.link} to="/privacy" target="_blank" rel="noopener">
          Privacy Policy
        </Link>
        .
      </PolicyAcceptanceCheckbox>

      <div className={classes.row}>
        <button
          className={classes.button}
          type="button"
          disabled={!agreed || recordAcceptances.isPending}
          onClick={() => void onAccept()}
        >
          {recordAcceptances.isPending ? "Saving…" : "Accept and continue"}
        </button>
        {signOutButton}
      </div>

      {errMsg && <div className={classes.error}>{errMsg}</div>}
    </section>
  );
};

export default PolicyAcceptanceGate;
