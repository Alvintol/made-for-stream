import { hasErrorMessage } from "../../lib/errorMessage";
import { Link, useSearchParams } from "react-router-dom";
import { useListingRequestPaymentCheckoutStatus } from "../../hooks/payments/useListingRequestPaymentCheckoutStatus";
import { useT, type Translate } from "../../lib/i18n/i18n";
const classes = {
  shell: "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8",
  card: "card p-6",
  title: "text-2xl font-black tracking-tight text-zinc-950",
  text: "mt-2 text-sm leading-6 text-zinc-600",
  success: "rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900",
  info: "rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-900",
  error: "rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900",
  actions: "flex flex-wrap items-center gap-3",
  btn:
    "btnOutline",
} as const;

const getPaymentMessage = ({
  paymentStatus,
  appStatus,
}: {
  paymentStatus?: string;
  appStatus?: string;
}, t: Translate) => {
  if (paymentStatus === "paid" || appStatus === "paid") {
    return {
      className: classes.success,
      title: t("paymentReturn.paidTitle"),
      text: t("paymentReturn.paidText"),
    };
  }

  if (paymentStatus === "unpaid" || appStatus === "checkout_opened") {
    return {
      className: classes.info,
      title: t("paymentReturn.unpaidTitle"),
      text: t("paymentReturn.unpaidText"),
    };
  }

  return {
    className: classes.info,
    title: t("paymentReturn.pendingTitle"),
    text: t("paymentReturn.pendingText"),
  };
};

const PaymentReturn = () => {
  const t = useT();
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("payment_id");
  const sessionId = searchParams.get("session_id");

  const { data, isLoading, error } = useListingRequestPaymentCheckoutStatus({
    paymentId,
    sessionId,
  });

  const message = getPaymentMessage({
    paymentStatus: data?.checkout.paymentStatus,
    appStatus: data?.payment.status,
  }, t);

  return (
    <main className={classes.shell}>
      <section className={classes.card}>
        <h1 className={classes.title}>{t("paymentReturn.title")}</h1>
        <p className={classes.text}>{t("paymentReturn.intro")}</p>
      </section>

      {(!paymentId || !sessionId) && (
        <div className={classes.error}>
          {t("paymentReturn.missing")}
        </div>
      )}

      {isLoading && <div className={classes.info}>{t("paymentReturn.checking")}</div>}

      {error && (
        <div className={classes.error}>
          {hasErrorMessage(error) ? error.message : t("paymentReturn.failed")}
        </div>
      )}

      {data && (
        <div className={message.className}>
          <strong>{message.title}</strong>
          <p className={classes.text}>{message.text}</p>
        </div>
      )}

      <div className={classes.actions}>
        <Link className={classes.btn} to="/requests">
          {t("checkout.back")}
        </Link>
        <Link className={classes.btn} to="/messages">
          {t("paymentReturn.inbox")}
        </Link>
      </div>
    </main>
  );
};

export default PaymentReturn;