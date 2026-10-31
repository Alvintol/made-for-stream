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
import { dateLocale, useLanguage, useT, type Translate } from "../../lib/i18n/i18n";
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

const getErrorMessage = (error: unknown, t: Translate): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : t("apply.failed");

const formatAcceptedDate = (value: string, locale: string | undefined): string =>
  new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

// Stripe Connect onboarding, rendered inside the settings Payouts section.
const CreatorPayoutSettings = ({ isCreatorApproved }: CreatorPayoutSettingsProps) => {
  const t = useT();
  const language = useLanguage();
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
  const payoutCountryOptions = useMemo(() => getPayoutCountryOptions(language), [language]);
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
      setErrMsg(t("payout.signIn"));
      return;
    }

    if (!hasAcceptedCreatorTerms && !creatorTermsAgreed) {
      setErrMsg(t("payout.acceptFirst"));
      return;
    }

    if (!country || !defaultCurrency) {
      setErrMsg(t("payout.chooseCountryFirst"));
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
        setErrMsg(t("payout.recordFailed"));
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
      setErrMsg(getErrorMessage(error, t));
    } finally {
      setIsStarting(false);
    }
  }, [
    country,
    creatorTermsAgreed,
    defaultCurrency,
    hasAcceptedCreatorTerms,
    recordAcceptances,
    t,
    token,
  ]);

  const refreshStatus = useCallback(async () => {
    setErrMsg(null);

    try {
      await syncAccount.mutateAsync();
      await paymentAccountQuery.refetch();
      setSuccessMsg(t("payout.refreshed"));
    } catch (error) {
      setSuccessMsg(null);
      setErrMsg(getErrorMessage(error, t));
    }
  }, [paymentAccountQuery, syncAccount, t]);

  const handleOnboardingExit = useCallback(async () => {
    // Stripe's form is finished and renders nothing more, so take it away
    // and let the status notice say what happens next.
    setConnectInstance(null);
    setSuccessMsg(t("payout.savedRefreshing"));
    await refreshStatus();
  }, [refreshStatus, t]);

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
        {t("payout.notApproved")}
      </p>
    );
  }

  return (
    <>
      {setupState === "not_started" && (
        <div className={classes.warning}>
          {t("payout.notStarted")}
        </div>
      )}

      {setupState === "needs_information" && !connectInstance && (
        <div className={classes.warning}>
          {t("payout.needsInfo")}
        </div>
      )}

      {setupState === "verifying" && !connectInstance && (
        <div className={classes.warning} role="status">
          {t("payout.verifying")}
        </div>
      )}

      {setupState === "ready" && (
        <div className={classes.success}>
          {t("payout.ready")}
        </div>
      )}

      {hasAcceptedCreatorTerms && creatorTermsAcceptedAt ? (
        <p className={classes.acceptedText}>
          {t("payout.acceptedStart")}{" "}
          <Link className={classes.policyLink} to="/terms/creator" target="_blank" rel="noopener">
            {t("apply.agreeTermsLink")}
          </Link>{" "}
          {t("payout.acceptedEnd", { date: formatAcceptedDate(creatorTermsAcceptedAt, dateLocale(language)) })}
        </p>
      ) : (
        <PolicyAcceptanceCheckbox
          id="creator-terms-acceptance"
          checked={creatorTermsAgreed}
          onChange={setCreatorTermsAgreed}
          disabled={isStarting || creatorTermsQuery.isLoading}
        >
          {t("payout.acceptStart")}{" "}
          <Link className={classes.policyLink} to="/terms/creator" target="_blank" rel="noopener">
            {t("apply.agreeTermsLink")}
          </Link>{" "}
          {t("payout.acceptAnd")}{" "}
          <a
            className={classes.policyLink}
            href={stripeConnectedAccountAgreementUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("payout.connectedAgreement")}
          </a>
          {t("payout.acceptIncluding")}{" "}
          <a
            className={classes.policyLink}
            href={stripeServicesAgreementUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("payout.servicesAgreement")}
          </a>
          {t("payout.acceptEnd")}
        </PolicyAcceptanceCheckbox>
      )}

      <div className={classes.form}>
        <label className={classes.field}>
          <span className={classes.label}>{t("payout.country")}</span>
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
                {t("payout.chooseYourCountry")}
              </option>
            )}
            {country && !payoutCountryOptions.some((option) => option.code === country) && (
              <option value={country}>{t("payout.notSupported", { value: country })}</option>
            )}
            {payoutCountryOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </label>

        <label className={classes.field}>
          <span className={classes.label}>{t("payout.currency")}</span>
          <select
            className={classes.input}
            value={defaultCurrency}
            disabled={isCountryLocked || !country}
            onChange={(event) => setDefaultCurrency(event.target.value)}
          >
            {!defaultCurrency && <option value="">-</option>}
            {defaultCurrency && !isSupportedCurrency(defaultCurrency) && (
              <option value={defaultCurrency}>{t("payout.notSupported", { value: defaultCurrency.toUpperCase() })}</option>
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
              {t(syncAccount.isPending ? "payout.refreshing" : "payout.refresh")}
            </button>
          )}

          {!hasPaymentAccount && isCountryConfirmed && !connectInstance && (
            <button
              className={classes.secondaryButton}
              type="button"
              disabled={isStarting}
              onClick={() => setIsCountryConfirmed(false)}
            >
              {t("payout.changeCountry")}
            </button>
          )}

          {isCountryLocked && (
            <button
              className={classes.button}
              type="button"
              disabled={isStarting || !canStartOnboarding || creatorTermsQuery.isLoading}
              onClick={() => void startEmbeddedOnboarding()}
            >
              {t(
                isStarting
                  ? "payout.preparing"
                  : connectInstance
                    ? "payout.restart"
                    : isReady
                      ? "payout.review"
                      : paymentAccount
                        ? "payout.continue"
                        : "payout.start"
              )}
            </button>
          )}
        </div>
      </div>

      {!hasPaymentAccount && !isCountryConfirmed && (
        <div className={classes.countryWarning} role="alert">
          <p className={classes.countryWarningTitle}>
            {t("payout.countryWarningTitle")}
          </p>
          <p>{t("payout.countryWarning")}</p>
          {country && defaultCurrency && (
            <button
              className={classes.button}
              type="button"
              onClick={() => setIsCountryConfirmed(true)}
            >
              {t("payout.confirmCountry", { country: countryName, currency: defaultCurrency.toUpperCase() })}
            </button>
          )}
        </div>
      )}

      {!hasPaymentAccount && isCountryConfirmed && (
        <p className={classes.text}>
          {t("payout.lockedIn")} <strong>{countryName}</strong>{t("payout.paidIn")}{" "}
          <strong>{defaultCurrency.toUpperCase()}</strong>{t("payout.lockedEnd")}
        </p>
      )}

      {hasPaymentAccount && (
        <p className={classes.text}>
          {t("payout.fixedCountry")}
        </p>
      )}

      {successMsg && <div className={classes.success}>{successMsg}</div>}
      {errMsg && <div className={classes.error}>{errMsg}</div>}

      {isStarting && !connectInstance && (
        <div className={classes.loadingShell}>
          <p className={classes.loadingText}>{t("payout.opening")}</p>
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
                setErrMsg(t("payout.loadError"));
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
