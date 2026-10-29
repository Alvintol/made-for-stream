import { formatMoney as formatCurrencyAmount } from "../../../lib/formatMoney";
import {
  canStartWorkForAcceptedRequest,
  getListingRequestPaymentStructureLabel,
} from "../../../domain/listings/listingRequestAgreements";
import type { ListingRequestAgreementRow } from "../../../hooks/creatorRequests/useListingRequestAgreement";
import { useLanguage, useT } from "../../../lib/i18n/i18n";
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

const formatDate = (value: string, language: string): string =>
  new Intl.DateTimeFormat(language, {
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
  const t = useT();
  const language = useLanguage();

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
    ? formatDate(agreement.estimated_start_at, language)
    : canStartWork
      ? t("readiness.immediately")
      : t("readiness.pendingPayment");

  return (
    <div className={cardClass}>
      <div className={classes.title}>
        <span
          className={`${classes.dot} ${canStartWork ? classes.dotReady : classes.dotBlocked}`}
          aria-hidden="true"
        />
        {t(canStartWork ? "readiness.canStart" : "readiness.paymentFirst")}
      </div>

      <p className={classes.text}>
        {canStartWork
          ? t("readiness.canStartText")
          : requestStatus === "accepted"
            ? t("readiness.blockedText")
            : t("readiness.inactiveText")}
      </p>

      <div className={classes.metaGrid}>
        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>{t("agreement.paymentStructure")}</div>
          <div className={classes.metaValue}>
            {getListingRequestPaymentStructureLabel(agreement.payment_structure, t)}
          </div>
        </div>

        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>{t("readiness.startingPayment")}</div>
          <div className={classes.metaValue}>
            {agreement.starting_payment_status === "not_required"
              ? t("readiness.notRequired")
              : agreement.starting_payment_status === "paid"
                ? t("agreement.paid")
                : startingPaymentAmount === null
                  ? t("agreement.notSet")
                  : formatCurrencyAmount(startingPaymentAmount, agreement.currency)}
          </div>
        </div>

        <div className={classes.metaBlock}>
          <div className={classes.metaLabel}>{t("readiness.workStart")}</div>

          <div className={classes.metaValue}>
            {workStartText}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingRequestAgreementWorkReadinessCard;