import { hasErrorMessage } from "../../lib/errorMessage";
import { useT } from "../../lib/i18n/i18n";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  convertAmount,
  formatCurrencyAmountRange,
  formatListingPrice,
} from "../../lib/money/displayCurrency";
import CommissionEstimateCard from "../../components/listingRequests/core/CommissionEstimateCard";
import { formatFeeRateBps } from "../../domain/payments/listingRequestPaymentDisplay";
import { useDisplayCurrency } from "../../hooks/money/useDisplayCurrency";
import { useBuyerServiceFeeRate } from "../../hooks/payments/useBuyerServiceFeeRate";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useCreateListingRequest } from "../../hooks/listings/useCreateListingRequest";
import {
  usePublicListing,
  type PublicListingRow,
} from "../../hooks/listings/usePublicListing";
import { buildListingRequestSnapshot } from "../../lib/listings/listingRequestSnapshot";
import { useAuth } from "../../providers/AuthProvider";
import {
  parseListingRequestBudget,
  parseListingRequestReferenceLinks,
  validateListingRequestForm,
  type ListingRequestFormErrors,
} from "../../domain/listings/listingRequestForm";
import { useActiveListingRequestForListing } from "../../hooks/listings/useActiveListingRequestForListing";
import { useCreatorHasOutstandingRecoveryBalance } from "../../hooks/listings/useCreatorHasOutstandingRecoveryBalance";
import KeptPlaceholder from "../../components/ui/KeptPlaceholder";

const TITLE_MAX = 120;
const DETAILS_MAX = 2000;
const TIMELINE_MAX = 160;
const REFERENCES_MAX = 5;

const classes = {
  page: "space-y-4",
  header: "card flex items-center gap-3 px-4 py-3 hover:shadow-[var(--shadow-md)] sm:px-5",
  backLink: "backLink shrink-0",
  backText: "sr-only sm:not-sr-only",
  headerText: "min-w-0 flex-1 text-center sm:text-left",
  eyebrow: "text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500",
  h1: "font-display text-lg font-bold leading-tight tracking-tight text-zinc-900 sm:text-xl",
  headerSpacer: "w-6 shrink-0 sm:hidden",

  layout: "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]",

  // Form
  form: "card min-w-0 overflow-hidden hover:shadow-[var(--shadow-md)]",
  group: "space-y-3 px-4 py-4 sm:px-5",
  groupDivider: "border-t border-[var(--hairline)]",
  groupHead: "flex items-baseline justify-between gap-3",
  groupTitle: "font-display text-sm font-bold tracking-tight text-zinc-900",
  groupHint: "text-xs text-zinc-500",
  row2: "grid gap-3 sm:grid-cols-2",
  field: "space-y-1.5",
  labelRow: "flex items-baseline justify-between gap-3",
  label: "formLabel",
  optional: "ml-1 text-xs font-normal text-zinc-500",
  counter: "shrink-0 text-[11px] tabular-nums text-zinc-500",
  counterOver: "shrink-0 text-[11px] font-semibold tabular-nums text-red-600",
  input: "formControl",
  textarea: "formControl min-h-[150px]",
  smallTextarea: "formControl min-h-[84px]",
  money: "relative",
  moneySign: "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-500",
  // Room for a three-letter currency code, not a single "$".
  moneyInput: "formControl pl-14",
  hint: "formHint",
  error: "formError",
  footer:
    "flex flex-col-reverse gap-3 border-t border-[var(--hairline)] bg-[rgb(var(--ink)/0.02)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5",
  footerNote: "text-xs text-zinc-500",
  footerActions: "flex items-center justify-end gap-2",
  submitError: "notice noticeError",
  btnPrimary: "btnPrimary",
  btnOutline: "btnOutline",
  btnPrimarySm: "btnPrimary btnSm",
  btnOutlineSm: "btnOutline btnSm",

  // Listing summary
  aside: "space-y-4 lg:order-last lg:sticky lg:top-24",
  listingCard: "card overflow-hidden hover:shadow-[var(--shadow-md)]",
  preview: "aspect-[16/9] w-full bg-zinc-100 object-cover",
  summary: "space-y-3 p-4",
  summaryTop: "flex items-start justify-between gap-3",
  listingTitle: "font-display text-base font-bold leading-snug tracking-tight text-zinc-900",
  creator: "text-xs text-zinc-500 hover:text-zinc-800",
  price: "shrink-0 rounded-full bg-[rgb(var(--accent-soft))] px-2.5 py-0.5 text-xs font-bold text-[rgb(var(--accent-text))]",
  chips: "flex flex-wrap gap-1.5",
  chip: "rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700",
  muted: "text-xs text-zinc-500",
  steps: "space-y-2 border-t border-[var(--hairline)] pt-3",
  stepsTitle: "text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500",
  step: "flex items-start gap-2 text-xs text-zinc-600",
  stepNumber:
    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent-soft))] text-[10px] font-bold text-[rgb(var(--accent-text))]",

  // Blocked states
  state: "card mx-auto max-w-xl space-y-3 p-5 text-center hover:shadow-[var(--shadow-md)] sm:p-6",
  stateTitle: "font-display text-lg font-bold tracking-tight text-zinc-900",
  stateText: "text-sm text-zinc-600",
  stateActions: "flex flex-wrap justify-center gap-2 pt-1",
  loadingText: "text-sm text-zinc-600",
} as const;

// The creator's real price: a request is made, and later paid, in it.
const priceText = (listing: PublicListingRow): string => formatListingPrice(listing);

const fieldIds: Record<keyof ListingRequestFormErrors, string> = {
  requestTitle: "request-title",
  requestDetails: "request-details",
  requestedTimeline: "requested-timeline",
  budgetAmount: "budget-amount",
  referenceLinks: "reference-links",
};

// Matches the order the fields appear in the form.
const fieldOrder = Object.keys(fieldIds) as Array<keyof ListingRequestFormErrors>;

const nextSteps = ["request.step1", "request.step2", "request.step3"] as const;

type StateCardProps = {
  backTo: string;
  backLabel: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
};

const StateCard = ({ backTo, backLabel, title, children, actions }: StateCardProps) => (
  <div className={classes.page}>
    <Link className="backLink" to={backTo}>
      ← {backLabel}
    </Link>

    <section className={classes.state}>
      <h1 className={classes.stateTitle}>{title}</h1>
      <p className={classes.stateText}>{children}</p>
      {actions && <div className={classes.stateActions}>{actions}</div>}
    </section>
  </div>
);

const Counter = ({ value, max }: { value: string; max: number }) => {
  const length = value.trim().length;

  return (
    <span className={length > max ? classes.counterOver : classes.counter} aria-hidden="true">
      {length}/{max}
    </span>
  );
};

const RequestListing = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const t = useT();
  const { data, isLoading, error } = usePublicListing(id ?? null);
  const createRequestMutation = useCreateListingRequest();
  const activeRequestQuery = useActiveListingRequestForListing(id ?? null);
  const recoveryBalanceQuery = useCreatorHasOutstandingRecoveryBalance(
    data?.listing?.user_id ?? null,
  );

  const [requestTitle, setRequestTitle] = useState("");
  const [requestDetails, setRequestDetails] = useState("");
  const [requestedTimeline, setRequestedTimeline] = useState("");
  const [budgetText, setBudgetText] = useState("");
  const [referenceLinksText, setReferenceLinksText] = useState("");
  const [formErrors, setFormErrors] = useState<ListingRequestFormErrors>({});

  const listing = data?.listing ?? null;
  const creator = data?.creator ?? null;

  const creatorName = creator?.handle
    ? `@${creator.handle}`
    : creator?.display_name ?? t("request.thisCreator");

  const referenceCount = parseListingRequestReferenceLinks(referenceLinksText).length;

  // The estimate follows the budget as it is typed, and starts from the
  // listing's price. Always in the creator's currency, which is what the
  // buyer will pay in; the buyer's own currency is shown as an estimate.
  const { displayCurrency, rates } = useDisplayCurrency();
  const feeRate = useBuyerServiceFeeRate();
  const listingCurrency = listing?.currency || "cad";
  const typedBudget = parseListingRequestBudget(budgetText);
  const budget = typedBudget && typedBudget !== "invalid" && typedBudget.min > 0 ? typedBudget : null;
  const hasBudget = budget !== null;
  const estimateAmount = budget ? budget.min : (listing?.price_min ?? 0);
  const inDisplayCurrency = (amount: number | null | undefined) =>
    amount && displayCurrency ? convertAmount(amount, listingCurrency, displayCurrency, rates) : null;
  const budgetLowInDisplayCurrency = inDisplayCurrency(budget?.min);
  const budgetHighInDisplayCurrency = inDisplayCurrency(budget?.max);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!listing) return;

    const result = validateListingRequestForm({
      requestTitle,
      requestDetails,
      requestedTimeline,
      budgetText,
      referenceLinksText,
    });

    setFormErrors(result.errors);

    if (!result.values) {
      // Move the reader to the first problem instead of leaving them at the submit button.
      const firstInvalid = fieldOrder.find((key) => result.errors[key]);
      if (firstInvalid) document.getElementById(fieldIds[firstInvalid])?.focus();
      return;
    }

    try {
      const requestId = await createRequestMutation.mutateAsync({
        listingId: listing.id,
        creatorUserId: listing.user_id,
        requestTitle: result.values.requestTitle,
        requestDetails: result.values.requestDetails,
        requestedTimeline: result.values.requestedTimeline,
        budgetAmount: result.values.budgetAmount,
        budgetAmountMax: result.values.budgetAmountMax,
        referenceLinks: result.values.referenceLinks,
        listingSnapshot: buildListingRequestSnapshot(listing),
      });

      navigate(`/requests/${requestId}`);
    } catch {
      // Error is surfaced below.
    }
  };

  if (isLoading) {
    return <div className={classes.loadingText}>{t("common.loading")}</div>;
  }

  if (error || !listing) {
    return (
      <StateCard backTo="/market" backLabel={t("listing.backToMarket")} title={t("listing.notFound")}>
        {t("request.notFoundText")}
      </StateCard>
    );
  }

  const listingPath = `/listing/${listing.id}`;

  if (!user) {
    return (
      <StateCard
        backTo={listingPath}
        backLabel={t("request.backToListing")}
        title={t("request.signInTitle")}
        actions={
          <>
            <Link className={classes.btnPrimarySm} to="/signin">
              {t("nav.signIn")}
            </Link>
            <Link className={classes.btnOutlineSm} to={listingPath}>
              {t("request.backToListing")}
            </Link>
          </>
        }
      >
        {t("request.signInText", { name: creatorName })}
      </StateCard>
    );
  }

  if (listing.fulfilment_mode !== "request") {
    return (
      <StateCard
        backTo={listingPath}
        backLabel={t("request.backToListing")}
        title={t("request.unavailableTitle")}
      >
        {t("request.unavailableText")}
      </StateCard>
    );
  }

  if (user.id === listing.user_id) {
    return (
      <StateCard backTo={listingPath} backLabel={t("request.backToListing")} title={t("request.ownTitle")}>
        {t("request.ownText")}
      </StateCard>
    );
  }

  if (activeRequestQuery.isLoading) {
    return <div className={classes.loadingText}>{t("request.checkingStatus")}</div>;
  }

  if (activeRequestQuery.data) {
    return (
      <StateCard
        backTo={listingPath}
        backLabel={t("request.backToListing")}
        title={t("request.alreadySentTitle")}
        actions={
          <>
            <Link className={classes.btnPrimarySm} to={`/requests/${activeRequestQuery.data.id}`}>
              {t("listing.viewCommission")}
            </Link>
            <Link className={classes.btnOutlineSm} to={listingPath}>
              {t("request.backToListing")}
            </Link>
          </>
        }
      >
        {t("request.alreadySentText")}
      </StateCard>
    );
  }

  if (recoveryBalanceQuery.data) {
    return (
      <StateCard
        backTo={listingPath}
        backLabel={t("request.backToListing")}
        title={t("request.pausedTitle")}
      >
        {t("request.pausedText")}
      </StateCard>
    );
  }

  const fieldProps = (key: keyof ListingRequestFormErrors, errorId: string) =>
    formErrors[key]
      ? { "aria-invalid": true, "aria-describedby": errorId }
      : { "aria-invalid": false };

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <Link className={classes.backLink} to={listingPath}>
          ← <span className={classes.backText}>{t("request.backToListing")}</span>
        </Link>
        <div className={classes.headerText}>
          <div className={classes.eyebrow}>{t("request.eyebrow")}</div>
          <h1 className={classes.h1}>{t("request.heading")}</h1>
        </div>
        <span className={classes.headerSpacer} aria-hidden="true" />
      </header>

      <div className={classes.layout}>
        <aside className={classes.aside} aria-label={t("request.summaryLabel")}>
          <CommissionEstimateCard
            amount={estimateAmount}
            amountMax={budget?.max ?? null}
            currency={listingCurrency}
            amountLabel={hasBudget ? t("request.yourBudget") : t("request.creatorsPrice")}
            feeRate={feeRate}
          />

          <div className={classes.listingCard}>
          {listing.preview_url && (
            <img className={`${classes.preview} hidden lg:block`} src={listing.preview_url} alt="" />
          )}

          <div className={classes.summary}>
            <div className={classes.summaryTop}>
              <div className="min-w-0">
                <div className={classes.listingTitle}>{listing.title}</div>
                {creator?.handle ? (
                  <Link className={classes.creator} to={`/creator/${creator.handle}`}>
                    {creatorName}
                  </Link>
                ) : (
                  <span className={classes.creator}>{creatorName}</span>
                )}
              </div>
              <span className={classes.price}>{priceText(listing)}</span>
            </div>

            {listing.deliverables.length > 0 ? (
              <ul className={classes.chips} aria-label={t("request.deliverables")}>
                {listing.deliverables.map((deliverable) => (
                  <li key={deliverable} className={classes.chip}>
                    {deliverable}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={classes.muted}>{t("request.noDeliverables")}</p>
            )}

            <p className={classes.muted}>{t("request.snapshotNote")}</p>

            <div className={`${classes.steps} hidden lg:block`}>
              <div className={classes.stepsTitle}>{t("request.nextTitle")}</div>
              <ol className="space-y-2">
                {nextSteps.map((key, index) => (
                  <li key={key} className={classes.step}>
                    <span className={classes.stepNumber}>{index + 1}</span>
                    {t(key)}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          </div>
        </aside>

        <form className={classes.form} noValidate onSubmit={(event) => void handleSubmit(event)}>
          <div className={classes.group}>
            <div className={classes.groupHead}>
              <h2 className={classes.groupTitle}>{t("request.yourCommission")}</h2>
              <span className={classes.groupHint}>{t("request.required")}</span>
            </div>

            <div className={classes.field}>
              <div className={classes.labelRow}>
                <label className={classes.label} htmlFor="request-title">
                  {t("request.titleLabel")}
                </label>
                <Counter value={requestTitle} max={TITLE_MAX} />
              </div>
              <KeptPlaceholder>
              <input
                id="request-title"
                className={classes.input}
                value={requestTitle}
                onChange={(event) => setRequestTitle(event.target.value)}
                placeholder={t("request.titlePlaceholder")}
                maxLength={TITLE_MAX}
                {...fieldProps("requestTitle", "request-title-error")}
              />
              </KeptPlaceholder>
              {formErrors.requestTitle && (
                <div id="request-title-error" className={classes.error}>
                  {t(formErrors.requestTitle)}
                </div>
              )}
            </div>

            <div className={classes.field}>
              <div className={classes.labelRow}>
                <label className={classes.label} htmlFor="request-details">
                  {t("request.details")}
                </label>
                <Counter value={requestDetails} max={DETAILS_MAX} />
              </div>
              <KeptPlaceholder>
              <textarea
                id="request-details"
                className={classes.textarea}
                value={requestDetails}
                onChange={(event) => setRequestDetails(event.target.value)}
                placeholder={t("request.detailsPlaceholder")}
                maxLength={DETAILS_MAX}
                {...fieldProps("requestDetails", "request-details-error")}
              />
              </KeptPlaceholder>
              {formErrors.requestDetails ? (
                <div id="request-details-error" className={classes.error}>
                  {t(formErrors.requestDetails)}
                </div>
              ) : (
                <div className={classes.hint}>{t("request.detailsHint")}</div>
              )}
            </div>
          </div>

          <div className={`${classes.group} ${classes.groupDivider}`}>
            <div className={classes.groupHead}>
              <h2 className={classes.groupTitle}>{t("request.extras")}</h2>
              <span className={classes.groupHint}>{t("request.optionalGroup")}</span>
            </div>

            <div className={classes.row2}>
              <div className={classes.field}>
                <label className={classes.label} htmlFor="requested-timeline">
                  {t("request.timeline")} <span className={classes.optional}>{t("common.optional")}</span>
                </label>
                <KeptPlaceholder>
                <input
                  id="requested-timeline"
                  className={classes.input}
                  value={requestedTimeline}
                  onChange={(event) => setRequestedTimeline(event.target.value)}
                  placeholder={t("request.timelinePlaceholder")}
                  maxLength={TIMELINE_MAX}
                  {...fieldProps("requestedTimeline", "requested-timeline-error")}
                />
                </KeptPlaceholder>
                {formErrors.requestedTimeline && (
                  <div id="requested-timeline-error" className={classes.error}>
                    {t(formErrors.requestedTimeline)}
                  </div>
                )}
              </div>

              <div className={classes.field}>
                <label className={classes.label} htmlFor="budget-amount">
                  {t("request.budget")} <span className={classes.optional}>{t("common.optional")}</span>
                </label>
                <div className={classes.money}>
                  <span className={classes.moneySign} aria-hidden="true">
                    {(listing.currency || "cad").toUpperCase()}
                  </span>
                  <input
                    id="budget-amount"
                    className={classes.moneyInput}
                    value={budgetText}
                    onChange={(event) => setBudgetText(event.target.value)}
                    placeholder={t("request.budgetPlaceholder", {
                      min: listing.price_min,
                      max: Math.round(listing.price_min * 1.5),
                    })}
                    maxLength={40}
                    {...fieldProps("budgetAmount", "budget-amount-error")}
                  />
                </div>
                {formErrors.budgetAmount && (
                  <div id="budget-amount-error" className={classes.error}>
                    {t(formErrors.budgetAmount)}
                  </div>
                )}
                <div className={classes.hint}>
                  {t("request.budgetHint")}{" "}
                  {budgetLowInDisplayCurrency !== null && displayCurrency && (
                    <>
                      {t("request.inYourCurrency", {
                        amount: formatCurrencyAmountRange(
                          Math.round(budgetLowInDisplayCurrency),
                          budgetHighInDisplayCurrency === null
                            ? null
                            : Math.round(budgetHighInDisplayCurrency),
                          displayCurrency,
                        ),
                      })}{" "}
                    </>
                  )}
                  {feeRate.feeBps > 0
                    ? t("request.feeAdded", { rate: formatFeeRateBps(feeRate.feeBps) })
                    : t("request.noFee")}
                </div>
              </div>
            </div>

            <div className={classes.field}>
              <div className={classes.labelRow}>
                <label className={classes.label} htmlFor="reference-links">
                  {t("request.references")} <span className={classes.optional}>{t("common.optional")}</span>
                </label>
                <span
                  className={referenceCount > REFERENCES_MAX ? classes.counterOver : classes.counter}
                  aria-hidden="true"
                >
                  {t("request.referencesCount", { count: referenceCount, max: REFERENCES_MAX })}
                </span>
              </div>
              <KeptPlaceholder>
              <textarea
                id="reference-links"
                className={classes.smallTextarea}
                value={referenceLinksText}
                onChange={(event) => setReferenceLinksText(event.target.value)}
                placeholder={t("request.referencesPlaceholder")}
                {...fieldProps("referenceLinks", "reference-links-error")}
              />
              </KeptPlaceholder>
              {formErrors.referenceLinks && (
                <div id="reference-links-error" className={classes.error}>
                  {t(formErrors.referenceLinks)}
                </div>
              )}
            </div>

            {createRequestMutation.error && (
              <div className={classes.submitError}>
                {hasErrorMessage(createRequestMutation.error)
                  ? createRequestMutation.error.message
                  : t("request.sendFailed")}
              </div>
            )}
          </div>

          <div className={classes.footer}>
            <p className={classes.footerNote}>{t("request.chargeNote")}</p>
            <div className={classes.footerActions}>
              <Link className={classes.btnOutline} to={listingPath}>
                {t("common.cancel")}
              </Link>
              <button
                className={classes.btnPrimary}
                type="submit"
                disabled={createRequestMutation.isPending}
              >
                {createRequestMutation.isPending ? t("common.submitting") : t("listing.requestButton")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequestListing;
