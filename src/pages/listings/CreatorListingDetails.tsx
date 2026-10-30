import { hasErrorMessage } from "../../lib/errorMessage";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { formatListingPrice } from "../../lib/money/displayCurrency";
import { useMyListing } from "../../hooks/listings/useMyListing";
import { useDeleteListingDraft } from "../../hooks/listings/useDeleteListingDraft";
import {
  getListingPublishReadiness,
  getMissingPublishCheckCount,
} from '../../lib/listings/listingPublishReadiness';
import { usePublishListing } from '../../hooks/listings/usePublishListing';
import { useSetListingActiveState } from '../../hooks/listings/useSetListingActiveState';
import { useMoveListingToDraft } from '../../hooks/listings/useMoveListingToDraft';
import { ListingRevisionRow, useListingRevisions } from '../../hooks/listings/useListingRevisions';
import { getListingRevisionChanges } from '../../lib/listings/listingRevisionDiff';
import ListingRevisionChangeText from "../../components/listings/ListingRevisionChangeText";
import {
  getListingStatusSummary,
  getListingVisibilityLabel,
  isAdminHiddenListing,
  type ListingStatusKey,
} from '../../domain/listings/listings';
import ListingPublishChecklist from '../../components/listings/ListingPublishChecklist';
import { dateLocale, useLanguage, useT, wordFor } from "../../lib/i18n/i18n";
// Stays under the site header on wide screens, so the answer to "is this
// live?" and the next action are always on screen.
const statusBannerBase =
  "flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4 lg:sticky lg:top-[84px] lg:z-20";

const statusBannerTone: Record<ListingStatusKey, string> = {
  draft: "border-amber-300 bg-amber-50 text-amber-900",
  live: "border-emerald-300 bg-emerald-50 text-emerald-900",
  inactive: "border-zinc-300 bg-zinc-100 text-zinc-800",
  admin_hidden: "border-red-300 bg-red-50 text-red-900",
};

const getErrorText = (error: unknown, fallback: string): string =>
  hasErrorMessage(error) && error.message ? error.message : fallback;

const classes = {
  page: "space-y-6",
  statusTitle: "text-lg font-bold",
  statusText: "text-sm",
  backLink: "backLink",

  header: "space-y-1",
  h1: "pageTitle",
  sub: "pageSub",

  grid: "grid gap-6 lg:grid-cols-[1.2fr_0.8fr]",
  card: "card p-6",
  section: "space-y-4",
  sectionTitle: "sectionHeading",
  text: "text-sm text-zinc-600",

  preview:
    "w-full rounded-3xl border border-zinc-200 bg-zinc-100 object-cover",
  previewEmpty:
    "flex min-h-[280px] items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 text-sm font-semibold text-zinc-500",

  metaGrid: "grid gap-4 sm:grid-cols-2",
  metaBlock: "space-y-1",
  metaLabel: "metaLabel",
  metaValue: "metaValue",

  pills: "flex flex-wrap gap-2",
  pill: "chip",
  draftPill:
    "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800",
  activePill:
    "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800",
  inactivePill:
    "rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700",
  adminHiddenPill:
    "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-800",
  warningCard:
    "notice noticeWarning",

  list: "space-y-2",
  listItem:
    "notice noticeNeutral",

  row: "flex flex-wrap items-center gap-3",
  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",
  btnDanger:
    "btnDangerOutline",

  loadingText: "text-sm text-zinc-600",
  errorCard:
    "notice noticeError",

  readinessCard: "card p-6",
  checkList: "space-y-2",
  checkRow:
    "flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3",
  checkPass:
    "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700",
  checkFail:
    "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700",
  checkText: "text-sm text-zinc-700",
  readyBox:
    "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800",
  notReadyBox:
    "rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800",
  btnDisabled:
    "inline-flex items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-500",

  revisionCard: "card p-6",
  revisionList: "space-y-3",
  revisionItem:
    "rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4",
  revisionTop: "flex flex-wrap items-center justify-between gap-3",
  revisionTitle: "text-sm font-bold text-zinc-900",
  revisionMeta: "text-xs text-zinc-500",
  revisionBody: "mt-3 space-y-2",
  revisionText: "text-sm text-zinc-700",

  changeList: "mt-3 space-y-2",
  changeItem:
    "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700",
} as const;

const dateText = (value: string, locale: string | undefined) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
};

const revisionEventKey = (eventType: ListingRevisionRow["event_type"]) =>
  eventType === "created"
    ? "revision.event.created"
    : eventType === "updated"
      ? "revision.event.updated"
      : eventType === "published"
        ? "revision.event.published"
        : eventType === "deactivated"
          ? "revision.event.deactivated"
          : eventType === "reactivated"
            ? "revision.event.reactivated"
            : "revision.event.moved";

const revisionDateText = (value: string, locale: string | undefined) => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
};

const CreatorListingDetails = () => {
  const t = useT();
  const locale = dateLocale(useLanguage());
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  // Set by the create page when "Publish now" saved the draft but the
  // publish step was refused (for example, payouts are not set up yet).
  const carriedPublishError =
    (location.state as { publishError?: string } | null)?.publishError ?? null;

  const { data: listing, isLoading, error } = useMyListing(id ?? null);
  const deleteDraftMutation = useDeleteListingDraft();
  const publishListingMutation = usePublishListing();
  const setListingActiveStateMutation = useSetListingActiveState();
  const moveListingToDraftMutation = useMoveListingToDraft();
  const {
    data: revisionsPage,
    isLoading: isLoadingRevisions,
    error: revisionsError,
  } = useListingRevisions({
    listingId: listing?.id ?? id ?? null,
    limit: 3,
    offset: 0,
  });

  const handleMoveToDraft = async () => {
    if (!listing) return;

    const confirmed = window.confirm(
      t("listingDetails.confirmMove", { title: listing.title })
    );

    if (!confirmed) return;

    try {
      const listingId = await moveListingToDraftMutation.mutateAsync(listing.id);
      navigate(`/creator/listings/${listingId}/edit`);
    } catch {
      // Error is surfaced below
    }
  };

  const handleDeactivateListing = async () => {
    if (!listing) return;

    const confirmed = window.confirm(
      t("listingDetails.confirmDeactivate", { title: listing.title })
    );

    if (!confirmed) return;

    try {
      await setListingActiveStateMutation.mutateAsync({
        listingId: listing.id,
        isActive: false,
      });
    } catch {
      // Error is surfaced below
    }
  };

  const handleReactivateListing = async () => {
    if (!listing) return;

    try {
      await setListingActiveStateMutation.mutateAsync({
        listingId: listing.id,
        isActive: true,
      });
    } catch {
      // Error is surfaced below
    }
  };

  const handleDeleteDraft = async () => {
    if (!listing) return;

    const confirmed = window.confirm(
      t("myListings.confirmDelete", { title: listing.title })
    );

    if (!confirmed) return;

    try {
      await deleteDraftMutation.mutateAsync(listing.id);
      navigate("/creator/listings");
    } catch {
      // Error is surfaced below
    }
  };

  const handlePublishListing = async () => {
    if (!listing || !publishReadiness.isReady) return;

    const confirmed = window.confirm(
      t("listingDetails.confirmPublish", { title: listing.title })
    );

    if (!confirmed) return;

    try {
      await publishListingMutation.mutateAsync(listing.id);
    } catch {
      // Error is surfaced below
    }
  };

  if (isLoading) {
    return <div className={classes.loadingText}>{t("common.loading")}</div>;
  }

  if (error || !listing) {
    return (
      <div className={classes.page}>
        <Link to="/creator/listings" className={classes.backLink}>
          ← {t("listingForm.back")}
        </Link>

        <div className={classes.card}>
          <h1 className={classes.h1}>{t("listingForm.notFound")}</h1>
          <p className={classes.sub}>{t("listingForm.notFoundText")}</p>
        </div>
      </div>
    );
  }

  const isAdminHidden = isAdminHiddenListing(listing);
  const isDraftInactive =
    listing.status === "draft" && !listing.is_active && !isAdminHidden;

  const publishReadiness = getListingPublishReadiness(listing, t);
  const statusSummary = getListingStatusSummary(listing, t);
  const missingChecks = getMissingPublishCheckCount(publishReadiness);

  return (
    <div className={classes.page}>
      <Link className={classes.btnOutline} to="/creator/listings">
        {t("listingDetails.back")}
      </Link>

      <div className={classes.header}>
        <h1 className={classes.h1}>{listing.title}</h1>

        <p className={classes.sub}>{t("listingDetails.sub")}</p>
      </div>

      <div
        className={`${statusBannerBase} ${statusBannerTone[statusSummary.key]}`}
        role="status"
      >
        <div>
          <div className={classes.statusTitle}>{statusSummary.title}</div>
          <div className={classes.statusText}>
            {statusSummary.description}
            {isDraftInactive && !publishReadiness.isReady && (
              <>
                {" "}
                {t("listingDetails.checklistLeft", { count: missingChecks })}
              </>
            )}
          </div>
        </div>

        {isDraftInactive &&
          (publishReadiness.isReady ? (
            <button
              className={classes.btnPrimary}
              type="button"
              onClick={handlePublishListing}
              disabled={publishListingMutation.isPending}
            >
              {t(publishListingMutation.isPending ? "listingDetails.publishing" : "listingForm.publishNow")}
            </button>
          ) : (
            <a className={classes.btnOutline} href="#publish-checklist">
              {t("listingDetails.seeMissing")}
            </a>
          ))}

        {statusSummary.key === "inactive" && (
          <button
            className={classes.btnPrimary}
            type="button"
            onClick={handleReactivateListing}
            disabled={setListingActiveStateMutation.isPending}
          >
            {t(setListingActiveStateMutation.isPending ? "creatorCommission.updating" : "listingDetails.reactivate")}
          </button>
        )}
      </div>

      {carriedPublishError && !publishListingMutation.error && isDraftInactive && (
        <div className={classes.errorCard}>
          {t("listingDetails.savedNotPublished", { reason: carriedPublishError })}
        </div>
      )}

      {moveListingToDraftMutation.error && (
        <div className={classes.errorCard}>
          {t("listingDetails.moveFailed")}
        </div>
      )}

      {publishListingMutation.error && (
        <div className={classes.errorCard}>
          {t("listingDetails.publishFailed", {
            reason: getErrorText(publishListingMutation.error, t("listingForm.tryAgain")),
          })}
        </div>
      )}

      {setListingActiveStateMutation.error && (
        <div className={classes.errorCard}>
          {t("listingDetails.visibilityFailed")}
        </div>
      )}

      {deleteDraftMutation.error && (
        <div className={classes.errorCard}>
          {t("myListings.deleteFailed")}
        </div>
      )}

      <div className={classes.grid}>
        <div className={classes.section}>
          {listing.preview_url ? (
            <img
              src={listing.preview_url}
              alt=""
              className={classes.preview}
              loading="lazy"
            />
          ) : (
            <div className={classes.previewEmpty}>{t("myListings.noPreview")}</div>
          )}

          <div className={classes.card}>
            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>{t("listingDetails.summary")}</h2>
              <p className={classes.text}>{listing.short}</p>
            </div>

            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>{t("snapshot.deliverables")}</h2>

              {listing.deliverables.length > 0 ? (
                <div className={classes.list}>
                  {listing.deliverables.map((deliverable) => (
                    <div key={deliverable} className={classes.listItem}>
                      {deliverable}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={classes.text}>{t("listingDetails.noDeliverables")}</p>
              )}
            </div>

            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>{t("snapshot.tags")}</h2>

              {listing.tags.length > 0 ? (
                <div className={classes.pills}>
                  {listing.tags.map((tag) => (
                    <span key={tag} className={classes.pill}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={classes.text}>{t("listingDetails.noTags")}</p>
              )}
            </div>
          </div>
        </div>

        <div className={classes.section}>
          <div className={classes.card}>
            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>{t("listingDetails.status")}</h2>

              <div className={classes.pills}>
                {listing.status === "draft" ? (
                  <span className={classes.draftPill}>{t("listingStatus.draft")}</span>
                ) : (
                  <span className={classes.pill}>{t("listingStatus.published")}</span>
                )}

                {isAdminHidden ? (
                  <span className={classes.adminHiddenPill}>
                    {getListingVisibilityLabel(listing, t)}
                  </span>
                ) : listing.is_active ? (
                  <span className={classes.activePill}>
                    {getListingVisibilityLabel(listing, t)}
                  </span>
                ) : (
                  <span className={classes.inactivePill}>
                    {getListingVisibilityLabel(listing, t)}
                  </span>
                )}
              </div>

              {isAdminHidden && (
                <div className={classes.warningCard}>
                  {t("listingDetails.hiddenWarning")}
                </div>
              )}
            </div>

            <div className={classes.metaGrid}>
              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>{t("snapshot.price")}</div>
                <div className={classes.metaValue}>
                  {formatListingPrice(listing, t("price.from"))}
                </div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>{t("listingForm.offeringLabel")}</div>
                <div className={classes.metaValue}>{wordFor("offering", listing.offering_type, t)}</div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>{t("buyerRequests.purchaseFlow")}</div>
                <div className={classes.metaValue}>{wordFor("fulfilment", listing.fulfilment_mode, t)}</div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>{t("snapshot.category")}</div>
                <div className={classes.metaValue}>{wordFor("category", listing.category, t)}</div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>{t("listingForm.videoLabel")}</div>
                <div className={classes.metaValue}>
                  {listing.video_subtype
                    ? wordFor("video", listing.video_subtype, t)
                    : t("listingForm.videoNone")}
                </div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>{t("listingDetails.created")}</div>
                <div className={classes.metaValue}>{dateText(listing.created_at, locale)}</div>
              </div>

              <div className={classes.metaBlock}>
                <div className={classes.metaLabel}>{t("listingDetails.lastUpdated")}</div>
                <div className={classes.metaValue}>{dateText(listing.updated_at, locale)}</div>
              </div>
            </div>
          </div>

          <div className={`${classes.readinessCard} scroll-mt-48`} id="publish-checklist">
            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>{t("listingForm.checklist")}</h2>

              <p className={classes.text}>{t("listingDetails.checklistText")}</p>
            </div>

            <ListingPublishChecklist readiness={publishReadiness} />
          </div>

          <div className={classes.revisionCard}>
            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>{t("revision.title")}</h2>

              <p className={classes.text}>{t("listingDetails.revisionText")}</p>
            </div>

            {revisionsError && (
              <div className={classes.errorCard}>
                {t("revision.loadFailed")}
              </div>
            )}

            {isLoadingRevisions && (
              <div className={classes.loadingText}>{t("revision.loading")}</div>
            )}

            {!isLoadingRevisions && !revisionsError && (revisionsPage?.rows.length ?? 0) === 0 && (
              <p className={classes.text}>{t("revision.none")}</p>
            )}

            {!isLoadingRevisions && !revisionsError && (revisionsPage?.rows.length ?? 0) > 0 && (
              <div className={classes.section}>
                <div className={classes.revisionList}>
                  {revisionsPage?.rows.map((revision, index, rows) => {
                    const previousRevision = rows[index + 1] ?? null;
                    const changes = getListingRevisionChanges(revision, previousRevision, t);

                    return (
                      <div key={revision.id} className={classes.revisionItem}>
                        <div className={classes.revisionTop}>
                          <div className={classes.revisionTitle}>
                            {t(revisionEventKey(revision.event_type))}
                          </div>

                          <div className={classes.revisionMeta}>
                            {revisionDateText(revision.created_at, locale)}
                          </div>
                        </div>

                        <div className={classes.changeList}>
                          {changes.map((change) => (
                            <div
                              key={`${revision.id}-${change.key}-${change.label}`}
                              className={classes.changeItem}
                            >
                              <ListingRevisionChangeText change={change} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={classes.row}>
                  {revisionsPage?.hasMore && (
                    <Link
                      className={classes.btnOutline}
                      to={`/creator/listings/${listing.id}/revisions`}
                    >
                      {t("listingDetails.moreRevisions")}
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={classes.card}>
            <div className={classes.section}>
              <h2 className={classes.sectionTitle}>{t("listingDetails.actions")}</h2>

              <p className={classes.text}>
                {t(isAdminHidden ? "listingDetails.actionsLocked" : "listingDetails.actionsText")}
              </p>
            </div>

            <div className={classes.row}>
              {isAdminHidden ? (
                <button className={classes.btnDisabled} type="button" disabled>
                  {t("myListings.lockedByAdmin")}
                </button>
              ) : isDraftInactive ? (
                <>
                  <Link
                    className={classes.btnOutline}
                    to={`/creator/listings/${listing.id}/edit`}
                  >
                    {t("myListings.editDraft")}
                  </Link>

                  <button
                    className={classes.btnDanger}
                    type="button"
                    onClick={handleDeleteDraft}
                    disabled={deleteDraftMutation.isPending}
                  >
                    {t(deleteDraftMutation.isPending ? "myListings.deleting" : "myListings.deleteDraft")}
                  </button>

                  {publishReadiness.isReady ? (
                    <button
                      className={classes.btnPrimary}
                      type="button"
                      onClick={handlePublishListing}
                      disabled={publishListingMutation.isPending}
                    >
                      {t(publishListingMutation.isPending ? "listingDetails.publishing" : "listingDetails.publish")}
                    </button>
                  ) : (
                    <span className={classes.btnDisabled}>
                      {t("listingDetails.completeChecklist")}
                    </span>
                  )}
                </>
              ) : listing.status === "published" ? (
                <>
                  {listing.is_active ? (
                    <button
                      className={classes.btnDanger}
                      type="button"
                      onClick={handleDeactivateListing}
                      disabled={setListingActiveStateMutation.isPending}
                    >
                      {t(setListingActiveStateMutation.isPending ? "creatorCommission.updating" : "listingDetails.deactivate")}
                    </button>
                  ) : (
                    <button
                      className={classes.btnPrimary}
                      type="button"
                      onClick={handleReactivateListing}
                      disabled={setListingActiveStateMutation.isPending}
                    >
                      {t(setListingActiveStateMutation.isPending ? "creatorCommission.updating" : "listingDetails.reactivateListing")}
                    </button>
                  )}

                  <button
                    className={classes.btnOutline}
                    type="button"
                    onClick={handleMoveToDraft}
                    disabled={moveListingToDraftMutation.isPending}
                  >
                    {t(moveListingToDraftMutation.isPending ? "listingDetails.movingDraft" : "listingDetails.edit")}
                  </button>
                </>
              ) : (
                <span className={classes.btnDisabled}>{t("listingDetails.noActions")}</span>
              )}

              <Link className={classes.btnOutline} to="/creator/listings">
                {t("listingDetails.back")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatorListingDetails;