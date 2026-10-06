import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";
import {
  loadConnectAndInitialize,
  type StripeConnectInstance,
} from "@stripe/connect-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  creatorActivationPolicyTypes,
  currentPolicyVersions,
  getLatestAcceptedAt,
  getMissingPolicyTypes,
  stripeConnectedAccountAgreementUrl,
  stripeServicesAgreementUrl,
  toCurrentPolicyAcceptances,
} from "../../domain/legal/policyAcceptance";
import {
  logPolicyAcceptanceFailure,
  usePolicyAcceptances,
  useRecordPolicyAcceptances,
} from "../../hooks/legal/usePolicyAcceptances";
import PolicyAcceptanceCheckbox from "../legal/PolicyAcceptanceCheckbox";
import {
  isSupportedCurrency,
  SUPPORTED_CURRENCY_CODES,
} from "../../domain/payments/supportedCurrencies";
import {
  getPayoutCountryCurrency,
  getPayoutCountryOptions,
  isSupportedPayoutCountry,
} from "../../domain/payments/supportedCountries";
import {
  createStripeConnectAccountSession,
} from "../../hooks/payments/useStripeConnectAccountSession";
import {
  getCreatorPaymentAccountIsReady,
  getCreatorPayoutSetupState,
  useCreatorPaymentAccount,
} from "../../hooks/payments/useCreatorPaymentAccount";
import { useSyncStripeConnectAccount } from "../../hooks/payments/useStripeConnectOnboarding";
import { getStripePublishableKey } from "../../lib/stripeClient";
import { useAuth } from "../../providers/AuthProvider";
import CreatorRecoveryBalanceSection from "./CreatorRecoveryBalanceSection";

type CreatorPayoutSettingsProps = {
  isCreatorApproved: boolean;
};

const classes = {
  text: "text-sm text-zinc-600",
  form: "grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_8rem_auto] sm:items-end",
  field: "flex flex-col gap-1.5",
  label: "formLabel",
  input: "formControl uppercase",
  actions: "flex flex-wrap items-center gap-2 sm:justify-end",
  button: "btnPrimary",
  secondaryButton: "btnOutline",
  warning: "notice noticeWarning",
  error: "notice noticeError",
  countryWarning: "notice noticeError space-y-3 text-base",
  countryWarningTitle: "text-lg font-bold",
  success: "notice noticeSuccess",
  embeddedShell: "overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white p-3",
  loadingShell: "space-y-3 rounded-2xl border border-dashed border-zinc-300 p-4",
  loadingText: "text-sm text-zinc-600",
  pulseRow: "h-9 animate-pulse rounded-xl bg-zinc-200",
  acceptedText: "text-sm text-zinc-600",
  policyLink: "font-semibold underline underline-offset-2",
} as const;

const VERIFYING_POLL_MS = 10_000;
const VERIFYING_POLL_TRIES = 30;

const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

const formatAcceptedDate = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

// Stripe Connect onboarding, rendered inside the settings Payouts section.
const CreatorPayoutSettings = ({ isCreatorApproved }: CreatorPayoutSettingsProps) => {
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  const paymentAccountQuery = useCreatorPaymentAccount();
  const syncAccount = useSyncStripeConnectAccount();

  const paymentAccount = paymentAccountQuery.data ?? null;
  const isReady = getCreatorPaymentAccountIsReady(paymentAccount);
  const setupState = getCreatorPayoutSetupState(paymentAccount);

  // Once a Stripe account exists its country and currency are fixed (the API
  // ignores new values for an existing account), so show the account's own
  // and only let the creator choose before one is created.
  // Nothing is preselected: Stripe never lets the country change, so the
  // creator picks it, reads the warning and confirms before the Stripe
  // button is offered at all.
  const [chosenCountry, setCountry] = useState("");
  const payoutCountryOptions = useMemo(() => getPayoutCountryOptions(), []);
  const [chosenCurrency, setDefaultCurrency] = useState("");
  const [isCountryConfirmed, setIsCountryConfirmed] = useState(false);
  const country = paymentAccount?.country || chosenCountry;
  const defaultCurrency = paymentAccount?.default_currency || chosenCurrency;
  const hasPaymentAccount = Boolean(paymentAccount);
  const isCountryLocked = hasPaymentAccount || isCountryConfirmed;
  const countryName =
    payoutCountryOptions.find((option) => option.code === country)?.name ?? country;
  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [creatorTermsAgreed, setCreatorTermsAgreed] = useState(false);

  // Creator Terms and the Stripe agreements must be accepted, at the current
  // version, before Stripe onboarding can start or be resumed.
  const creatorTermsQuery = usePolicyAcceptances({
    policyTypes: creatorActivationPolicyTypes,
    enabled: isCreatorApproved,
  });
  const recordAcceptances = useRecordPolicyAcceptances();

  const currentCreatorTermsAcceptances = (creatorTermsQuery.data ?? []).filter(
    (acceptance) =>
      acceptance.policy_version === currentPolicyVersions.creator_terms,
  );
  const hasAcceptedCreatorTerms =
    Boolean(creatorTermsQuery.data) &&
    getMissingPolicyTypes(creatorActivationPolicyTypes, creatorTermsQuery.data ?? [])
      .length === 0;
  const creatorTermsAcceptedAt = getLatestAcceptedAt(currentCreatorTermsAcceptances);
  const canStartOnboarding = hasAcceptedCreatorTerms || creatorTermsAgreed;

  const startEmbeddedOnboarding = useCallback(async () => {
    if (!token) {
      setErrMsg("You must be signed in to start Stripe setup.");
      return;
    }

    if (!hasAcceptedCreatorTerms && !creatorTermsAgreed) {
      setErrMsg("Accept the Creator Terms and Stripe agreements to start Stripe setup.");
      return;
    }

    if (!country || !defaultCurrency) {
      setErrMsg("Choose and confirm your country before starting Stripe setup.");
      return;
    }

    setIsStarting(true);
    setErrMsg(null);
    setSuccessMsg(null);
    setConnectInstance(null);

    // Stripe requires a record of this acceptance, so onboarding does not
    // start unless it was saved.
    if (!hasAcceptedCreatorTerms) {
      try {
        await recordAcceptances.mutateAsync({
          policies: toCurrentPolicyAcceptances(creatorActivationPolicyTypes),
        });
      } catch (error) {
        logPolicyAcceptanceFailure("creator terms acceptance", error);
        setErrMsg(
          "We couldn’t record your acceptance of the Creator Terms, so Stripe setup hasn’t started. Please try again.",
        );
        setIsStarting(false);
        return;
      }
    }

    try {
      const publishableKey = getStripePublishableKey();
      const response = await createStripeConnectAccountSession({
        token,
        country,
        defaultCurrency,
      });

      setConnectInstance(
        loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret: async () => response.accountSession.clientSecret,
        }),
      );
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    } finally {
      setIsStarting(false);
    }
  }, [
    country,
    creatorTermsAgreed,
    defaultCurrency,
    hasAcceptedCreatorTerms,
    recordAcceptances,
    token,
  ]);

  const refreshStatus = useCallback(async () => {
    setErrMsg(null);

    try {
      await syncAccount.mutateAsync();
      await paymentAccountQuery.refetch();
      setSuccessMsg("Payout status refreshed.");
    } catch (error) {
      setSuccessMsg(null);
      setErrMsg(getErrorMessage(error));
    }
  }, [paymentAccountQuery, syncAccount]);

  const handleOnboardingExit = useCallback(async () => {
    // Stripe's form is finished and renders nothing more, so take it away
    // and let the status notice say what happens next.
    setConnectInstance(null);
    setSuccessMsg("Stripe setup was saved. Refreshing payout status…");
    await refreshStatus();
  }, [refreshStatus]);

  // While Stripe is checking the details, its account events update the row
  // in the background, so re-read it for a few minutes. It must stop by
  // itself: an unbounded version of this ran all night in a forgotten tab
  // and was the only steady load on the database when it went down
  // (2026-10-06, OPS-005). Hidden tabs do not poll at all.
  // ponytail: 10 s poll, 30 tries; use a realtime subscription if a creator
  // ever needs the page to stay live for longer.
  const refetchPaymentAccount = paymentAccountQuery.refetch;
  const isVerifying = setupState === "verifying" && !connectInstance;

  useEffect(() => {
    if (!isVerifying) {
      return;
    }

    let triesLeft = VERIFYING_POLL_TRIES;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }

      triesLeft -= 1;

      if (triesLeft < 0) {
        window.clearInterval(timer);
        return;
      }

      void refetchPaymentAccount();
    }, VERIFYING_POLL_MS);

    return () => window.clearInterval(timer);
  }, [isVerifying, refetchPaymentAccount]);

  if (!isCreatorApproved) {
    return (
      <p className={classes.text}>
        Payout setup opens once your creator application is approved.
      </p>
    );
  }

  return (
    <>
      {setupState === "not_started" && (
        <div className={classes.warning}>
          Finish Stripe setup before publishing active listings or receiving buyer payments.
        </div>
      )}

      {setupState === "needs_information" && !connectInstance && (
        <div className={classes.warning}>
          Stripe needs more information from you before you can publish active listings or
          receive buyer payments. Choose Continue Stripe setup to pick up where you left off.
        </div>
      )}

      {setupState === "verifying" && !connectInstance && (
        <div className={classes.warning} role="status">
          Stripe is checking your details. There is nothing more for you to do right now. This
          usually takes a few minutes. This page checks for the next five minutes; after that,
          press Refresh status. If Stripe needs anything else, it will ask for it here.
        </div>
      )}

      {setupState === "ready" && (
        <div className={classes.success}>
          Your payout account is ready. You can publish listings and receive buyer payments.
        </div>
      )}

      {hasAcceptedCreatorTerms && creatorTermsAcceptedAt ? (
        <p className={classes.acceptedText}>
          You accepted the{" "}
          <Link className={classes.policyLink} to="/terms/creator" target="_blank" rel="noopener">
            Creator Terms
          </Link>{" "}
          and Stripe agreements on {formatAcceptedDate(creatorTermsAcceptedAt)}.
        </p>
      ) : (
        <PolicyAcceptanceCheckbox
          id="creator-terms-acceptance"
          checked={creatorTermsAgreed}
          onChange={setCreatorTermsAgreed}
          disabled={isStarting || creatorTermsQuery.isLoading}
        >
          I accept the Made for Stream{" "}
          <Link className={classes.policyLink} to="/terms/creator" target="_blank" rel="noopener">
            Creator Terms
          </Link>{" "}
          and the{" "}
          <a
            className={classes.policyLink}
            href={stripeConnectedAccountAgreementUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Stripe Connected Account Agreement
          </a>
          , including its incorporated{" "}
          <a
            className={classes.policyLink}
            href={stripeServicesAgreementUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Stripe Services Agreement
          </a>
          .
        </PolicyAcceptanceCheckbox>
      )}

      <div className={classes.form}>
        <label className={classes.field}>
          <span className={classes.label}>Country</span>
          <select
            className={classes.input}
            value={country}
            disabled={isCountryLocked}
            onChange={(event) => {
              const nextCountry = event.target.value;

              setCountry(nextCountry);

              // A creator is paid in their country's own currency unless
              // they choose otherwise, so follow the country.
              const localCurrency = getPayoutCountryCurrency(nextCountry);

              if (localCurrency) {
                setDefaultCurrency(localCurrency);
              }
            }}
          >
            {!country && (
              <option value="" disabled>
                Choose your country
              </option>
            )}
            {country && !isSupportedPayoutCountry(country) && (
              <option value={country}>{country} (not supported)</option>
            )}
            {payoutCountryOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </label>

        <label className={classes.field}>
          <span className={classes.label}>Currency</span>
          <select
            className={classes.input}
            value={defaultCurrency}
            disabled={isCountryLocked || !country}
            onChange={(event) => setDefaultCurrency(event.target.value)}
          >
            {!defaultCurrency && <option value="">-</option>}
            {defaultCurrency && !isSupportedCurrency(defaultCurrency) && (
              <option value={defaultCurrency}>{defaultCurrency.toUpperCase()} (not supported)</option>
            )}
            {SUPPORTED_CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <div className={classes.actions}>
          {hasPaymentAccount && (
            <button
              className={classes.secondaryButton}
              type="button"
              disabled={syncAccount.isPending}
              onClick={() => void refreshStatus()}
            >
              {syncAccount.isPending ? "Refreshing…" : "Refresh status"}
            </button>
          )}

          {!hasPaymentAccount && isCountryConfirmed && !connectInstance && (
            <button
              className={classes.secondaryButton}
              type="button"
              disabled={isStarting}
              onClick={() => setIsCountryConfirmed(false)}
            >
              Change country
            </button>
          )}

          {isCountryLocked && (
            <button
              className={classes.button}
              type="button"
              disabled={isStarting || !canStartOnboarding || creatorTermsQuery.isLoading}
              onClick={() => void startEmbeddedOnboarding()}
            >
              {isStarting
                ? "Preparing…"
                : connectInstance
                  ? "Restart Stripe setup"
                  : isReady
                    ? "Review Stripe details"
                    : paymentAccount
                      ? "Continue Stripe setup"
                      : "Start Stripe setup"}
            </button>
          )}
        </div>
      </div>

      {!hasPaymentAccount && !isCountryConfirmed && (
        <div className={classes.countryWarning} role="alert">
          <p className={classes.countryWarningTitle}>
            You can't change your country after Stripe setup starts.
          </p>
          <p>
            Stripe ties your payout account to this country permanently. Choose the country where
            you live and where your bank account is. If it is wrong, you will not be able to get
            paid and support will have to close the account and start again.
          </p>
          {country && defaultCurrency && (
            <button
              className={classes.button}
              type="button"
              onClick={() => setIsCountryConfirmed(true)}
            >
              Confirm {countryName} ({defaultCurrency.toUpperCase()})
            </button>
          )}
        </div>
      )}

      {!hasPaymentAccount && isCountryConfirmed && (
        <p className={classes.text}>
          Locked in: <strong>{countryName}</strong>, paid in{" "}
          <strong>{defaultCurrency.toUpperCase()}</strong>. This becomes permanent when you start
          Stripe setup.
        </p>
      )}

      {hasPaymentAccount && (
        <p className={classes.text}>
          Country and currency were set when your Stripe account was created and can't be
          changed here. Contact support if they are wrong.
        </p>
      )}

      {successMsg && <div className={classes.success}>{successMsg}</div>}
      {errMsg && <div className={classes.error}>{errMsg}</div>}

      {isStarting && !connectInstance && (
        <div className={classes.loadingShell}>
          <p className={classes.loadingText}>Opening secure Stripe onboarding…</p>
          <div className={classes.pulseRow} />
        </div>
      )}

      {connectInstance && (
        <div className={classes.embeddedShell}>
          <ConnectComponentsProvider connectInstance={connectInstance}>
            <ConnectAccountOnboarding
              onExit={() => void handleOnboardingExit()}
              // Ask for everything in one pass, so the creator is not sent
              // back in for each later requirement.
              collectionOptions={{
                fields: "eventually_due",
                futureRequirements: "include",
              }}
              onLoadError={() => {
                setConnectInstance(null);
                setErrMsg(
                  "Stripe's setup form couldn't load. Please try again. If it keeps happening, contact support.",
                );
              }}
            />
          </ConnectComponentsProvider>
        </div>
      )}

      <CreatorRecoveryBalanceSection />
    </>
  );
};

export default CreatorPayoutSettings;
