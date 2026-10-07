import { Link, useSearchParams } from "react-router-dom";
import { useListingRequestPaymentCheckoutStatus } from "../../hooks/payments/useListingRequestPaymentCheckoutStatus";

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
}) => {
  if (paymentStatus === "paid" || appStatus === "paid") {
    return {
      className: classes.success,
      title: "Payment received",
      text:
        "Stripe confirmed the payment. Made for Stream will unlock the next workflow step shortly.",
    };
  }

  if (paymentStatus === "unpaid" || appStatus === "checkout_opened") {
    return {
      className: classes.info,
      title: "Payment not completed",
      text:
        "The checkout session is still open or was not completed. You can return to the commission and try again.",
    };
  }

  return {
    className: classes.info,
    title: "Checking payment",
    text:
      "Made for Stream is checking the latest payment status from Stripe. Webhooks remain the source of truth for paid status.",
  };
};

const PaymentReturn = () => {
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
  });

  return (
    <main className={classes.shell}>
      <section className={classes.card}>
        <h1 className={classes.title}>Payment status</h1>
        <p className={classes.text}>
          Thanks for returning to Made for Stream. Stripe confirms payment status
          through webhooks, so this page may update slightly before the commission
          page does.
        </p>
      </section>

      {(!paymentId || !sessionId) && (
        <div className={classes.error}>
          This return link is missing payment details.
        </div>
      )}

      {isLoading && <div className={classes.info}>Checking Stripe status…</div>}

      {error && (
        <div className={classes.error}>
          {error instanceof Error ? error.message : "Unable to check payment."}
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
          Back to commissions
        </Link>
        <Link className={classes.btn} to="/messages">
          Open inbox
        </Link>
      </div>
    </main>
  );
};

export default PaymentReturn;