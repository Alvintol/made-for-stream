import { useInstantPurchaseDownloads } from "../../hooks/listings/useInstantDownloads";

const classes = {
  card: "card space-y-2 p-6",
  title: "font-display text-lg font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  error: "notice noticeError",
} as const;

const formatWhen = (value: string) => new Date(value).toLocaleString("en-CA");

// For a refund request or a bank dispute on an instant download. Every
// download is a final sale; the only refund is one the law requires (Refund
// Policy section 12). Admin pages stay in English.
const InstantPurchaseDownloadsCard = ({ listingRequestId }: { listingRequestId: string }) => {
  const query = useInstantPurchaseDownloads(listingRequestId, true);
  const data = query.data;

  return (
    <section className={classes.card}>
      <h2 className={classes.title}>Instant download</h2>

      {query.isError && <div className={classes.error}>Downloads could not be loaded.</div>}

      {data && (
        <p className={classes.text}>
          {data.downloads === 0 || !data.first_downloaded_at
            ? "Not downloaded yet. "
            : `Downloaded ${data.downloads} time${data.downloads === 1 ? "" : "s"}, first on ${formatWhen(data.first_downloaded_at)}, last on ${formatWhen(data.last_downloaded_at ?? data.first_downloaded_at)}. `}
          Final sale: refund only where the law requires it, such as a faulty file the creator can't fix.
          If the buyer disputes the payment, send this record and their final-sale confirmation as evidence.
        </p>
      )}

      {data && (
        <p className={classes.text}>
          {data.final_sale
            ? `The buyer agreed it's a final sale on ${formatWhen(data.final_sale.accepted_at)} (Refund Policy version ${data.final_sale.version}).`
            : "No final-sale confirmation is recorded for this purchase."}
        </p>
      )}
    </section>
  );
};

export default InstantPurchaseDownloadsCard;
