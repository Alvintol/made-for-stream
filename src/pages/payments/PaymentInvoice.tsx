import { useParams } from "react-router-dom";
import {
  formatFeeRateBps,
  formatPaymentCents,
} from "../../domain/payments/listingRequestPaymentDisplay";
import { usePaymentInvoice } from "../../hooks/payments/useSales";
import { useT } from "../../lib/i18n/i18n";

const classes = {
  page: "mx-auto max-w-2xl space-y-4",
  card: "card space-y-5 p-6",
  header: "flex flex-wrap items-start justify-between gap-3",
  h1: "pageTitle",
  meta: "text-sm text-zinc-600",
  heading: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  party: "mt-1 text-sm font-semibold text-zinc-900",
  lines: "mt-2 space-y-1 text-sm",
  line: "flex justify-between gap-4 text-zinc-800",
  sub: "flex justify-between gap-4 text-xs text-zinc-500",
  total: "flex justify-between gap-4 border-t border-zinc-200 pt-3 text-sm font-bold text-zinc-900",
  print: "btnOutline btnSm print:hidden",
  loading: "text-sm text-zinc-600",
  error: "notice noticeError",
} as const;

// Made for Stream's GST/HST number. Set in the site's settings, and left off the
// invoice until it is.
const PLATFORM_TAX_NUMBER = import.meta.env.VITE_PLATFORM_TAX_NUMBER as string | undefined;

// One paid payment's invoice. The creator sells the work and Made for Stream
// sells its fees, so each has its own block. Playbook:
// docs/support/payments/sales.md.
const PaymentInvoice = () => {
  const t = useT();
  const { paymentId } = useParams();
  const { data: invoice, error, isLoading } = usePaymentInvoice(paymentId);

  if (isLoading) return <p className={classes.loading}>{t("invoice.loading")}</p>;

  if (error || !invoice) return <div className={classes.error}>{t("invoice.notFound")}</div>;

  const money = (cents: number) => formatPaymentCents(cents, invoice.currency);
  const madeForStreamCents = invoice.buyer_fee_cents + invoice.support_cents;

  return (
    <div className={classes.page}>
      <article className={classes.card}>
        <div className={classes.header}>
          <div>
            <h1 className={classes.h1}>{t("invoice.title")}</h1>
            <p className={classes.meta}>
              {t("invoice.number", { number: invoice.number })} · {invoice.paid_at.slice(0, 10)}
            </p>
          </div>

          <button type="button" className={classes.print} onClick={() => window.print()}>
            {t("invoice.print")}
          </button>
        </div>

        <section>
          <h2 className={classes.heading}>{t("invoice.soldBy")}</h2>
          <p className={classes.party}>{invoice.seller_name}</p>
          {invoice.seller_tax_number && (
            <p className={classes.meta}>
              {t("invoice.taxNumber", { number: invoice.seller_tax_number })}
            </p>
          )}

          <div className={classes.lines}>
            <div className={classes.line}>
              <span>{invoice.title ?? t("sales.untitled")}</span>
              <span>{money(invoice.base_cents)}</span>
            </div>
            {invoice.tip_cents > 0 && (
              <div className={classes.line}>
                <span>{t("invoice.tip")}</span>
                <span>{money(invoice.tip_cents)}</span>
              </div>
            )}
          </div>
        </section>

        {madeForStreamCents > 0 && (
          <section>
            <h2 className={classes.heading}>{t("invoice.fromPlatform")}</h2>
            <p className={classes.party}>Made for Stream</p>
            {PLATFORM_TAX_NUMBER && (
              <p className={classes.meta}>{t("invoice.gstNumber", { number: PLATFORM_TAX_NUMBER })}</p>
            )}

            <div className={classes.lines}>
              {invoice.buyer_fee_cents > 0 && (
                <div className={classes.line}>
                  <span>{t("invoice.buyerFee")}</span>
                  <span>{money(invoice.buyer_fee_cents)}</span>
                </div>
              )}
              {invoice.support_cents > 0 && (
                <div className={classes.line}>
                  <span>{t("invoice.support")}</span>
                  <span>{money(invoice.support_cents)}</span>
                </div>
              )}
              {!invoice.instant && invoice.buyer_tax_bps !== null && invoice.buyer_fee_tax_cents !== null && (
                <div className={classes.sub}>
                  <span>{t("invoice.includesTax", { rate: formatFeeRateBps(invoice.buyer_tax_bps) })}</span>
                  <span>{money(invoice.buyer_fee_tax_cents)}</span>
                </div>
              )}
            </div>
          </section>
        )}

        <div>
          {invoice.added_tax_cents > 0 && (
            <div className={classes.line}>
              <span>{t("tax.label")}</span>
              <span>{money(invoice.added_tax_cents)}</span>
            </div>
          )}
          <div className={classes.total}>
            <span>{t("invoice.total")}</span>
            <span>{money(invoice.total_cents)}</span>
          </div>
          {/* A download's tax is on the whole price, which Made for Stream accounts for. */}
          {invoice.instant && invoice.buyer_tax_bps !== null && invoice.buyer_fee_tax_cents !== null && (
            <div className={classes.sub}>
              <span>{t("invoice.priceIncludesTax", { rate: formatFeeRateBps(invoice.buyer_tax_bps) })}</span>
              <span>{money(invoice.buyer_fee_tax_cents)}</span>
            </div>
          )}
          {invoice.refunded_cents > 0 && (
            <div className={classes.line}>
              <span>{t("invoice.refunded")}</span>
              <span>{money(-invoice.refunded_cents)}</span>
            </div>
          )}
        </div>

        {invoice.creator_fee_cents !== null && (
          <section>
            <h2 className={classes.heading}>{t("invoice.creatorFeeHeading")}</h2>
            <div className={classes.lines}>
              <div className={classes.line}>
                <span>{t("invoice.creatorFee")}</span>
                <span>{money(invoice.creator_fee_cents)}</span>
              </div>
              {invoice.creator_tax_bps !== null && invoice.creator_fee_tax_cents !== null && (
                <div className={classes.sub}>
                  <span>{t("invoice.includesTax", { rate: formatFeeRateBps(invoice.creator_tax_bps) })}</span>
                  <span>{money(invoice.creator_fee_tax_cents)}</span>
                </div>
              )}
            </div>
          </section>
        )}
      </article>
    </div>
  );
};

export default PaymentInvoice;
