import { useInstantPurchaseDownloads } from "../../hooks/listings/useInstantDownloads";

const classes = {
  card: "card space-y-2 p-6",
  title: "font-display text-lg font-extrabold tracking-tight",
  text: "text-sm text-zinc-600",
  error: "notice noticeError",
} as const;

const formatWhen = (value: string) => new Date(value).toLocaleString("en-CA");

// For a refund on an instant download. A sale is final once a file is
// downloaded, unless a file is faulty or not as described (Refund Policy).
// Admin pages stay in English.
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
            ? "The buyer hasn't downloaded any file. A refund on request is allowed."
            : `Downloaded ${data.downloads} time${data.downloads === 1 ? "" : "s"}, first on ${formatWhen(data.first_downloaded_at)}. The sale is final unless a file is faulty or not as described.`}
        </p>
      )}
    </section>
  );
};

export default InstantPurchaseDownloadsCard;
