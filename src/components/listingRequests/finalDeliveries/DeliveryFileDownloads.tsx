import { useState } from "react";

import {
  deliveryFileName,
  getDeliveryFileDownloadUrl,
} from "../../../lib/listings/deliveryFiles";

type DeliveryFileDownloadsProps = {
  paths: string[];
};

const classes = {
  wrap: "mt-4 space-y-2",
  title: "text-xs font-bold uppercase tracking-wide text-zinc-500",
  list: "divide-y divide-zinc-200 rounded-2xl border border-zinc-200",
  item: "flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm",
  name: "min-w-0 break-all font-medium text-zinc-900",
  btn: "btnOutline btnSm",
  error: "formError",
} as const;

// The files of a final delivery, each with a Download button. The link is
// made when the button is pressed and lasts an hour. The database refuses
// it to a buyer while a balance is still owed for the final release.
const DeliveryFileDownloads = ({ paths }: DeliveryFileDownloadsProps) => {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (path: string) => {
    setPending(path);
    setError(null);

    try {
      window.location.assign(await getDeliveryFileDownloadUrl(path));
    } catch {
      setError(
        "This file cannot be downloaded yet. The buyer can download the files once nothing is owed for the final release.",
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <div className={classes.wrap}>
      <div className={classes.title}>Files</div>

      <ul className={classes.list}>
        {paths.map((path) => (
          <li className={classes.item} key={path}>
            <span className={classes.name}>{deliveryFileName(path)}</span>

            <button
              className={classes.btn}
              disabled={pending !== null}
              type="button"
              onClick={() => void download(path)}
            >
              {pending === path ? "Preparing…" : `Download ${deliveryFileName(path)}`}
            </button>
          </li>
        ))}
      </ul>

      {error && (
        <p className={classes.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default DeliveryFileDownloads;
