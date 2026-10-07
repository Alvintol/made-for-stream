import { formatMoney as formatCurrencyAmount } from "../../../lib/formatMoney";
import {
  canStartWorkForAcceptedRequest,
  getListingRequestPaymentStructureLabel,
} from "../../../domain/listings/listingRequestAgreements";
import type { ListingRequestAgreementRow } from "../../../hooks/creatorRequests/useListingRequestAgreement";

type ListingRequestAgreementWorkReadinessCardProps = {
  requestStatus: string;
  agreement: Pick<
    ListingRequestAgreementRow,
    | "status"
    | "starting_payment_status"
    | "payment_structure"
    | "deposit_amount"
    | "total_amount"
    | "currency"
    | "estimated_start_at"
  > | null;
};

const classes = {
  card: "rounded-xl border px-3 py-3",
  readyCard: "border-[var(--hairline)] bg-[rgb(var(--surface))] text-zinc-900",
  blockedCard: "border-amber-200 bg-amber-50 text-amber-950",
  mutedCard: "border-zinc-200 bg-zinc-50 text-zinc-800",
  title: "flex items-center gap-2 text-sm font-semibold",
  dot: "h-2 w-2 shrink-0 rounded-full",
  dotReady: "bg-emerald-500",
  dotBlocked: "bg-amber-500",
  text: "mt-1 text-xs opacity-80",
  metaGrid: "mt-3 grid grid-cols-3 gap-2 border-t border-current/10 pt-2",
  metaBlock: "min-w-0 space-y-0.5",
  metaLabel: "text-[10px] font-semibold uppercase tracking-wide opacity-70",
  metaValue: "truncate text-xs font-semibold",
} as const;

const formatMoney = (amount: number | null, currency: string): string => {
  if (amount === null) {
    return "Not set";
  }

  return formatCurrencyAmount(amount, currency);
};

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
  }).format(new Date(value));

const getStartingPaymentAmount = (
  agreement: Pick<
    ListingRequestAgreementRow,
    "deposit_amount" | "total_amount"
  >
): number | null => agreement.deposit_amount ?? agreement.total_amount ?? null;

const ListingRequestAgreementWorkReadinessCard = ({
  requestStatus,
  agreement,
}: ListingRequestAgreementWorkReadinessCardProps) => {
  if (!agreement || agreement.status !== "buyer_accepted") {
    return null;
  }

  const canStartWork = canStartWorkForAcceptedRequest({
    requestStatus,
    agreementStatus: agreement.status,
    startingPaymentStatus: agreement.starting_payment_status,
  });

  const cardClass = canStartWork
    ? `${classes.card} ${classes.readyCard}`
    : requestStatus === "accepted"
      ? `${classes.card} ${classes.blockedCard}`
      : `${classes.card} ${classes.mutedCard}`;

  const startingPaymentAmount = getStartingPaymentAmount(agreement);

  const workStartText = agreement.estimated_start_at
    ? formatDate(agreement.estimated_start_at)
    : canStartWork
      ? "Available immediately"
      : "Pending payment";

  return (
    <div className={cardClass}>
      <div className={classes.title}>
        <span
          className={`${classes.dot} ${canStartWork ? classes.dotReady : classes.dotBlocked}`}
          aria-hidden="true"
        />
        {canStartWork
          ? "Work may begin"
          : "Payment required before work starts"}
      </div>

      <p className={classes.text}>
        {canStartWork
          ? "The buyer accepted the project agreement and the starting payment requirement is cleared."
          : requestStatus === "accepted"
            ? "The buyer accepted the project agreement, but work should not begin until the required starting payment or deposit is marked paid."
            : "This agreement was accepted, but the commission is no longer in an active accepted state."}
      </p>

      <div className={classes.metaGrid}>
        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>Payment structure</div>
          <div className={classes.metaValue}>
            {getListingRequestPaymentStructureLabel(agreement.payment_structure)}
          </div>
        </div>

        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>Starting payment</div>
          <div className={classes.metaValue}>
            {agreement.starting_payment_status === "not_required"
              ? "Not required"
              : agreement.starting_payment_status === "paid"
                ? "Paid"
                : formatMoney(startingPaymentAmount, agreement.currency)}
          </div>
        </div>

        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>Work start</div>

          <div className={classes.metaValue}>
            {workStartText}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestAgreementWorkReadinessCard;