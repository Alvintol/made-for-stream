import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import CheckoutPolicyAcceptance from "../../components/legal/CheckoutPolicyAcceptance";
import { getBillingCountryOptions } from "../../domain/payments/billingCountries";
import {
  describeBuyerServiceFee,
  formatPaymentCents,
  getListingRequestPaymentTitle,
} from "../../domain/payments/listingRequestPaymentDisplay";
import { describePaymentTaxLine } from "../../domain/payments/listingRequestPaymentTax";
import { useAccountDetails } from "../../hooks/settings/useAccountDetails";
import { useCreateListingRequestPaymentCheckout } from "../../hooks/payments/useCreateListingRequestPaymentCheckout";
import { useListingRequestPayment } from "../../hooks/payments/useListingRequestPayments";
import { useSetListingRequestPaymentTipAndSupport } from "../../hooks/payments/useSetListingRequestPaymentTipAndSupport";
import { getStripeForConnectedAccount } from "../../lib/stripeClient";
import { useLanguage, useT, type Translate } from "../../lib/i18n/i18n";
const classes = {
  shell:
    "mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8",
  card: "card p-6",
  title: "text-2xl font-black tracking-tight text-zinc-950",
  text: "mt-2 text-sm leading-6 text-zinc-600",
  error:
    "rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900",
  checkoutWrap: "overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2",
  actions: "flex flex-wrap items-center gap-3",
  btn:
    "btnOutline",
  summaryTitle: "font-display text-base font-extrabold tracking-tight",
  amounts: "mt-3 space-y-1 text-sm text-zinc-700",
  amountRow: "flex justify-between gap-4",
  totalRow: "flex justify-between gap-4 border-t border-zinc-200 pt-2 font-bold text-zinc-950",
  feeNote: "mt-4 border-t border-zinc-200 pt-3 text-xs leading-5 text-zinc-500",
  feeLink: "font-semibold text-zinc-700 underline underline-offset-2 hover:text-zinc-950",
  fieldRow: "flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
  fieldLabel: "text-sm font-semibold text-zinc-800",
  fieldHint: "text-xs text-zinc-500",
  // The tip card: one boxed row per extra. On wide screens the words sit in
  // a left column and the controls in a fixed right column behind a divider,
  // so both rows line up; on a phone the controls drop underneath.
  extras: "mt-4 overflow-hidden rounded-2xl border border-zinc-300",
  extraRow:
    "grid gap-4 border-t border-zinc-300 p-4 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_19rem]",
  extraControls:
    "space-y-2 border-t border-zinc-300 pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0",
  quickAmounts: "grid grid-cols-[repeat(4,minmax(0,1fr))_auto] gap-1.5",
  quickAmount: "btnOutline btnSm px-2",
  amountBox: "flex items-center gap-2",
  aboutSupport: "mt-1 text-xs leading-5 text-zinc-500",
  fieldInput:
    "min-w-0 flex-1 rounded-lg border border-zinc-300 px-2 py-1 text-right text-sm focus:border-zinc-500 focus:outline-none",
  pendingAmount: "text-zinc-500",
} as const;

const getErrorMessage = (error: unknown, t: Translate): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : t("checkout.failed");

// Shortcuts beside an amount box: a share of the project payment, worked out
// to the cent and put in the box, where it can still be typed over. Nothing
// is chosen until the buyer presses one.
const TIP_PERCENTAGES = [5, 10, 15, 20];
const SUPPORT_PERCENTAGES = [1, 3, 5];

const percentOfCents = (cents: number, percent: number): string =>
  (Math.round((cents * percent) / 100) / 100).toFixed(2);

type ExtraAmountRowProps = {
  inputId: string;
  label: string;
  hint: string;
  description: string;
  currency: string;
  value: string;
  onChange: (value: string) => void;
  // The shortcut buttons: four amounts, then Round up.
  children: ReactNode;
};

// One row of the tip card. The tip and the contribution both use it, which
// is what keeps their words, buttons and amount boxes in the same places.
const ExtraAmountRow = ({
  inputId,
  label,
  hint,
  description,
  currency,
  value,
  onChange,
  children,
}: ExtraAmountRowProps) => (
  <div className={classes.extraRow}>
    <div>
      <label className={classes.fieldLabel} htmlFor={inputId}>
        {label}
        <span className={classes.fieldHint}> — {hint}</span>
      </label>
      <p className={classes.aboutSupport}>{description}</p>
    </div>

    <div className={classes.extraControls}>
      <div className={classes.quickAmounts}>{children}</div>

      <div className={classes.amountBox}>
        <span className={classes.fieldHint}>{currency}</span>
        <input
          id={inputId}
          className={classes.fieldInput}
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </div>
  </div>
);

const ListingRequestPaymentCheckout = () => {
  const { paymentId = "" } = useParams<{ paymentId: string }>();
  const t = useT();
  const language = useLanguage();
  const { mutateAsync: createCheckout } = useCreateListingRequestPaymentCheckout();
  const setTipAndSupport = useSetListingRequestPaymentTipAndSupport();
  const paymentQuery = useListingRequestPayment(paymentId);
  const payment = paymentQuery.data ?? null;

  // launch-scope.md section 4: both default to zero and require an
  // affirmative choice before checkout opens -- entered as whole-currency-unit
  // strings so the buyer never sees "0" pre-filled as if it were a suggestion.
  // Null means "not edited on this visit": the box then shows what an earlier
  // visit saved on the payment, so a buyer who comes back can change or remove it.
  const [tipEdit, setTipEdit] = useState<string | null>(null);
  const [supportEdit, setSupportEdit] = useState<string | null>(null);
  const savedAmount = (cents: number | undefined): string =>
    cents ? (cents / 100).toFixed(2) : "";
  const tipInput = tipEdit ?? savedAmount(payment?.creator_tip_cents);
  const supportInput = supportEdit ?? savedAmount(payment?.platform_support_cents);
  const [extrasConfirmed, setExtrasConfirmed] = useState(false);
  const [extrasErrMsg, setExtrasErrMsg] = useState<string | null>(null);

  // Sprint 7 (launch-scope.md section 12): the buyer's billing location is
  // location evidence for tax and decides which jurisdiction's tax (if any)
  // applies. It is the address in the buyer's private account details and
  // cannot be changed here: the API reads it from the database itself, so
  // this page only shows the country.
  const accountDetails = useAccountDetails();
  const billingCountry = accountDetails.data?.country_code ?? "";
  const billingCountryName = useMemo(
    () =>
      getBillingCountryOptions(language).find((option) => option.code === billingCountry)?.name ??
      billingCountry,
    [billingCountry, language],
  );

  const parseAmountToCents = (value: string): number => {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(t("checkout.amountInvalid"));
    }
    return Math.round(parsed * 100);
  };

  // "Round up" adds the cents that bring what the buyer pays to a whole
  // number, to whichever of the two they press it on, and is greyed out
  // while the total is already whole (decided 2026-10-27, after trying a
  // version that added 1.00 on every press). Tax, where it is collected, is
  // worked out after this step and can move the total again.
  const centsOrZero = (value: string): number => {
    try {
      return parseAmountToCents(value);
    } catch {
      return 0;
    }
  };
  const tipCentsNow = centsOrZero(tipInput);
  const supportCentsNow = centsOrZero(supportInput);
  const totalCentsNow = payment
    ? payment.base_amount_cents + payment.buyer_service_fee_cents + tipCentsNow + supportCentsNow
    : 0;
  const roundUpCents = (100 - (totalCentsNow % 100)) % 100;
  const centsText = (cents: number): string => (cents / 100).toFixed(2);

  const onConfirmExtras = useCallback(async () => {
    if (!paymentId) return;

    setExtrasErrMsg(null);

    if (!billingCountry) {
      setExtrasErrMsg(t("checkout.needDetails"));
      return;
    }

    try {
      const creatorTipCents = parseAmountToCents(tipInput);
      const platformSupportCents = parseAmountToCents(supportInput);

      await setTipAndSupport.mutateAsync({
        paymentId,
        creatorTipCents,
        platformSupportCents,
      });

      setExtrasConfirmed(true);
    } catch (error) {
      setExtrasErrMsg(getErrorMessage(error, t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId, tipInput, supportInput, billingCountry, setTipAndSupport.mutateAsync, t]);

  // Stripe checkout opens only after the buyer has confirmed their tip and
  // contribution choice, then accepted the project terms and policies for
  // this request.
  const [policiesAccepted, setPoliciesAccepted] = useState(false);
  const onPoliciesAccepted = useCallback(() => setPoliciesAccepted(true), []);

  const startedPaymentIdRef = useRef<string | null>(null);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] =
    useState<Promise<Stripe | null> | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const startCheckout = useCallback(async () => {
    if (!paymentId) {
      setErrMsg(t("checkout.missingId"));
      return;
    }

    if (startedPaymentIdRef.current === paymentId) {
      return;
    }

    startedPaymentIdRef.current = paymentId;

    setErrMsg(null);
    setClientSecret(null);
    setStripePromise(null);

    try {
      // The API reads the billing location from the account details itself;
      // the country is still sent so an API from before that change accepts it.
      const response = await createCheckout({ paymentId, billingCountry });

      setClientSecret(response.checkout.clientSecret);
      setStripePromise(
        getStripeForConnectedAccount(
          response.payment.stripe_connected_account_id,
        ),
      );
    } catch (error) {
      startedPaymentIdRef.current = null;
      setErrMsg(getErrorMessage(error, t));
    }
  }, [createCheckout, paymentId, billingCountry, t]);

  useEffect(() => {
    if (!policiesAccepted) return;

    void startCheckout();
  }, [policiesAccepted, startCheckout]);

  const taxLine = payment ? describePaymentTaxLine(payment, t) : null;

  // Until the tip and contribution are confirmed, the summary follows what
  // is in the boxes, so the buyer sees the total they are about to pay. Tax
  // is on the project payment and the fee only, so a known tax still holds.
  const shownTipCents = extrasConfirmed ? (payment?.creator_tip_cents ?? 0) : tipCentsNow;
  const shownSupportCents = extrasConfirmed
    ? (payment?.platform_support_cents ?? 0)
    : supportCentsNow;
  const shownTotalCents = !payment
    ? 0
    : extrasConfirmed
      ? payment.total_checkout_cents
      : totalCentsNow + (taxLine && !taxLine.pending ? payment.tax_cents : 0);

  const checkoutOptions = useMemo(
    () => (clientSecret ? { clientSecret } : undefined),
    [clientSecret],
  );

  return (
    <main className={classes.shell}>
      <section className={classes.card}>
        <h1 className={classes.title}>{t("checkout.title")}</h1>
        <p className={classes.text}>{t("checkout.intro")}</p>
      </section>

      {paymentQuery.isLoading && (
        <section className={classes.card}>
          <p className={classes.text}>{t("checkout.loading")}</p>
        </section>
      )}

      {paymentQuery.isError && (
        <div className={classes.error}>{t("checkout.loadFailed")}</div>
      )}

      {!paymentQuery.isLoading && !paymentQuery.isError && !payment && (
        <div className={classes.error}>{t("checkout.notFound")}</div>
      )}

      {payment && (
        <section className={classes.card}>
          <h2 className={classes.summaryTitle}>{getListingRequestPaymentTitle(payment, t)}</h2>
          <dl className={classes.amounts}>
            <div className={classes.amountRow}>
              <dt>{t("checkout.projectPayment")}</dt>
              <dd>{formatPaymentCents(payment.base_amount_cents, payment.currency)}</dd>
            </div>
            <div className={classes.amountRow}>
              <dt>{t("checkout.fee")}</dt>
              <dd>{formatPaymentCents(payment.buyer_service_fee_cents, payment.currency)}</dd>
            </div>
            {shownTipCents > 0 && (
              <div className={classes.amountRow}>
                <dt>{t("checkout.tip")}</dt>
                <dd>{formatPaymentCents(shownTipCents, payment.currency)}</dd>
              </div>
            )}
            {shownSupportCents > 0 && (
              <div className={classes.amountRow}>
                <dt>{t("checkout.support")}</dt>
                <dd>{formatPaymentCents(shownSupportCents, payment.currency)}</dd>
              </div>
            )}
            {taxLine && (
              <div className={classes.amountRow}>
                <dt>{taxLine.label}</dt>
                <dd className={taxLine.pending ? classes.pendingAmount : undefined}>
                  {taxLine.pending
                    ? t("checkout.taxPending")
                    : formatPaymentCents(payment.tax_cents, payment.currency)}
                </dd>
              </div>
            )}
            <div className={classes.totalRow}>
              <dt>{t("checkout.total")}</dt>
              <dd>{formatPaymentCents(shownTotalCents, payment.currency)}</dd>
            </div>
          </dl>

          <p className={classes.feeNote}>
            {t("checkout.feeIs", { description: describeBuyerServiceFee(payment, t) })}{" "}
            {payment.buyer_service_fee_cents > 0
              ? t("checkout.onlyFee")
              : t("checkout.nothingAdded")}{" "}
            {t("checkout.creatorFee")}{" "}
            <Link className={classes.feeLink} to="/policies/fees">
              {t("checkout.feeLink")}
            </Link>
          </p>
        </section>
      )}

      {payment && !extrasConfirmed && (
        <section className={classes.card}>
          <h2 className={classes.summaryTitle}>{t("checkout.extrasTitle")}</h2>
          <p className={classes.text}>{t("checkout.extrasIntro")}</p>

          <div className={classes.extras}>
            <ExtraAmountRow
              inputId="tip-amount"
              label={t("checkout.tipLabel")}
              hint={t("checkout.tipHint")}
              description={t("checkout.tipText")}
              currency={payment.currency.toUpperCase()}
              value={tipInput}
              onChange={setTipEdit}
            >
              {TIP_PERCENTAGES.map((percent) => (
                <button
                  key={percent}
                  type="button"
                  className={classes.quickAmount}
                  aria-label={t("checkout.tipPercent", { percent })}
                  onClick={() => setTipEdit(percentOfCents(payment.base_amount_cents, percent))}
                >
                  {percent}%
                </button>
              ))}
              <button
                type="button"
                className={classes.quickAmount}
                aria-label={t("checkout.tipRoundUp")}
                disabled={roundUpCents === 0}
                onClick={() => setTipEdit(centsText(tipCentsNow + roundUpCents))}
              >
                {t("checkout.roundUp")}
              </button>
            </ExtraAmountRow>

            <ExtraAmountRow
              inputId="support-amount"
              label={t("checkout.supportLabel")}
              hint={t("checkout.supportHint")}
              description={t("checkout.supportText")}
              currency={payment.currency.toUpperCase()}
              value={supportInput}
              onChange={setSupportEdit}
            >
              {SUPPORT_PERCENTAGES.map((percent) => (
                <button
                  key={percent}
                  type="button"
                  className={classes.quickAmount}
                  aria-label={t("checkout.supportPercent", { percent })}
                  onClick={() => setSupportEdit(percentOfCents(payment.base_amount_cents, percent))}
                >
                  {percent}%
                </button>
              ))}
              <button
                type="button"
                className={classes.quickAmount}
                aria-label={t("checkout.supportOne", { amount: "1.00" })}
                onClick={() => setSupportEdit("1.00")}
              >
                1.00
              </button>
              <button
                type="button"
                className={classes.quickAmount}
                aria-label={t("checkout.supportRoundUp")}
                disabled={roundUpCents === 0}
                onClick={() => setSupportEdit(centsText(supportCentsNow + roundUpCents))}
              >
                {t("checkout.roundUp")}
              </button>
            </ExtraAmountRow>
          </div>

          <h2 className={`mt-6 ${classes.summaryTitle}`}>{t("checkout.billingTitle")}</h2>
          <p className={classes.text}>{t("checkout.billingText")}</p>

          <div className="mt-4 space-y-3">
            <div className={classes.fieldRow}>
              <span className={classes.fieldLabel}>
                {t("checkout.billingCountry")}
                <span className={classes.fieldHint}> — {t("checkout.billingFrom")}</span>
              </span>
              <span className="text-sm">
                {billingCountry ? billingCountryName : t("checkout.notSet")}{" "}
                <Link className={classes.feeLink} to="/settings/personal">
                  {billingCountry ? t("checkout.changeInSettings") : t("checkout.addDetails")}
                </Link>
              </span>
            </div>
          </div>

          {extrasErrMsg && <div className={`mt-3 ${classes.error}`}>{extrasErrMsg}</div>}

          <div className={`mt-4 ${classes.actions}`}>
            <button
              type="button"
              className="btnPrimary"
              disabled={setTipAndSupport.isPending || accountDetails.isLoading}
              onClick={() => void onConfirmExtras()}
            >
              {setTipAndSupport.isPending ? t("common.saving") : t("checkout.continue")}
            </button>
          </div>
        </section>
      )}

      {payment && extrasConfirmed && (
        <CheckoutPolicyAcceptance
          listingRequestId={payment.listing_request_id}
          onAccepted={onPoliciesAccepted}
        />
      )}

      {errMsg && <div className={classes.error}>{errMsg}</div>}

      {policiesAccepted && !errMsg && (!stripePromise || !checkoutOptions) && (
        <section className={classes.card}>
          <p className={classes.text}>{t("checkout.preparing")}</p>
        </section>
      )}

      {stripePromise && checkoutOptions && (
        <section className={classes.checkoutWrap}>
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={checkoutOptions}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </section>
      )}

      <div className={classes.actions}>
        <Link className={classes.btn} to="/requests">
          {t("checkout.back")}
        </Link>
      </div>
    </main>
  );
};

export default ListingRequestPaymentCheckout;