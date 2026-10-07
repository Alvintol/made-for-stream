import { FadeIn } from "../../lib/motion";
import ListingPriceText from "../../components/listings/ListingPriceText";
import ListingAnimatedPreview from "../../components/listings/ListingAnimatedPreview";
import { Link, useParams } from "react-router-dom";
import { normalizeTwitchLogin } from "../../domain/twitch";
import { useTwitchStreams } from "../../hooks/useTwitchStreams";
import { supabase } from "../../lib/supabaseClient";
import {
  usePublicListing,
  type PublicListingRow,
} from "../../hooks/listings/usePublicListing";
import { getFulfilmentModeCopy } from '../../domain/listings/listings';

// Free listings never go through Stripe or the request flow: a download
// resolves to a public storage URL, an external link is used as-is.
const getFreeListingHref = (listing: PublicListingRow): string | null => {
  if (!listing.is_free) return null;

  if (listing.free_delivery_type === "download" && listing.free_file_path) {
    return supabase.storage
      .from("free-assets")
      .getPublicUrl(listing.free_file_path).data.publicUrl;
  }

  if (listing.free_delivery_type === "external_link" && listing.free_external_url) {
    return listing.free_external_url;
  }

  return null;
};
import { useState } from 'react';
import { ModerationReportReasonCode, moderationReportReasonOptions } from '../../domain/moderation/moderationReports';
import { useSubmitListingModerationReport } from '../../hooks/moderation/useSubmitListingModerationReport';
import { useAuth } from '../../providers/AuthProvider';
import { useActiveListingRequestForListing } from '../../hooks/listings/useActiveListingRequestForListing';

const classes = {
  notFoundWrap: "space-y-4",
  h1: "pageTitle",
  backBtn: "btnOutline",

  page: "space-y-6",
  backLink: "backLink",
  loadingText: "text-sm text-zinc-600",

  grid: "grid gap-6 lg:grid-cols-2",
  img: "aspect-video w-full rounded-3xl border border-zinc-200 object-cover bg-zinc-100",

  rightCol: "space-y-4",
  titleRow: "flex flex-wrap items-center gap-2",
  badge:
    "rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-semibold",
  liveBadge: "badge badgeLive",
  desc: "text-zinc-600",

  priceRow: "flex items-center justify-between gap-3",
  price: "text-xl font-extrabold",
  creatorLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",

  chips: "flex flex-wrap gap-2",
  chip: "chip",

  ctaBox: "rounded-2xl border border-zinc-200 bg-zinc-50 p-4",
  ctaTitle: "font-semibold",
  ctaText: "mt-1 text-sm text-zinc-600",
  ctaLink: "btnPrimary mt-3 inline-flex",

  liveCard: "overflow-hidden rounded-3xl border border-zinc-200 bg-white",
  liveImg: "h-48 w-full object-cover",
  liveBody: "p-4",
  liveMeta: "text-sm font-extrabold text-zinc-900",
  liveDot: "text-zinc-500",
  liveTitle: "mt-1 text-sm text-zinc-600",

  metaText: "text-sm text-zinc-500",
  reportCard: "card p-5",
  reportTitle: "font-display text-base font-extrabold tracking-tight",
  reportText: "mt-1 text-sm text-zinc-600",
  reportForm: "mt-4 space-y-3",
  label: "formLabel",
  select:
    "formControl",
  textarea:
    "formControl min-h-[110px]",
  hint: "formHint",
  successCard:
    "notice noticeSuccess",
  errorCard:
    "notice noticeError",
  btnPrimary:
    "btnPrimary",
  btnOutline:
    "btnOutline",
  btnDanger:
    "btnDanger",
  field: "space-y-2",
  row: "flex flex-wrap items-center gap-3",
} as const;

// Formats the updated timestamp for buyer-facing display
const updatedText = (value: string): string => {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
};

const ListingNotFound = () => (
  <div className={classes.notFoundWrap}>
    <h1 className={classes.h1}>Listing not found</h1>

    <Link to="/market" className={classes.backBtn}>
      Back to market
    </Link>
  </div>
);

const ListingPage = () => {
  const { id } = useParams<{ id: string }>();
  const { twitchByLogin } = useTwitchStreams();
  const { data, isLoading, error } = usePublicListing(id ?? null);

  const { user } = useAuth();
  const submitListingReport = useSubmitListingModerationReport();

  const defaultReportReason = moderationReportReasonOptions[0]?.value ?? null;

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] =
    useState<ModerationReportReasonCode | null>(defaultReportReason);
  const [reportDetails, setReportDetails] = useState("");
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  const listing = data?.listing ?? null;
  const reportDetailsTrimmed = reportDetails.trim();

  const canSubmitListingReport =
    Boolean(listing?.id && reportReason) &&
    reportDetailsTrimmed.length <= 2000 &&
    !submitListingReport.isPending;

  const isOwnListing = Boolean(user?.id && listing?.user_id === user.id);

  const shouldCheckActiveBuyerRequest = Boolean(
    user?.id &&
    listing?.id &&
    listing.fulfilment_mode === "request" &&
    listing.user_id !== user.id
  );

  const activeRequestQuery = useActiveListingRequestForListing(
    shouldCheckActiveBuyerRequest ? listing?.id : null
  );

  const activeListingRequest = activeRequestQuery.data ?? null;

  const handleSubmitListingReport = async () => {
    if (!listing?.id || !reportReason || !canSubmitListingReport) return;


    setReportSuccess(null);
    setReportError(null);

    try {
      await submitListingReport.mutateAsync({
        listingId: listing.id,
        reasonCode: reportReason,
        reasonDetails: reportDetailsTrimmed,
      });

      setReportSuccess(
        "Listing report submitted. An admin will review it soon."
      );
      setReportDetails("");
      setIsReportOpen(false);
    } catch (error) {
      setReportError(
        error instanceof Error
          ? error.message
          : "Listing report could not be submitted."
      );
    }
  };

  if (!id) return <ListingNotFound />;

  if (isLoading) {
    return (
      <div className={classes.page}>
        <div className={classes.loadingText}>Loading…</div>
      </div>
    );
  }

  if (error || !listing || !data) return <ListingNotFound />;

  const { creator, platformAccounts } = data;
  const fulfilmentCopy = getFulfilmentModeCopy(listing.fulfilment_mode);
  const freeListingHref = getFreeListingHref(listing);

  const twitchAccount =
    platformAccounts.find((account) => account.platform === "twitch") ?? null;

  const twitchLoginRaw = twitchAccount?.platform_login ?? null;
  const twitchLogin = twitchLoginRaw
    ? normalizeTwitchLogin(twitchLoginRaw)
    : null;

  const stream = twitchLogin ? twitchByLogin[twitchLogin] : undefined;
  const isLive = Boolean(stream);

  const creatorName = creator?.display_name ?? creator?.handle ?? "Creator";
  const creatorLink = creator?.handle ? `/creator/${creator.handle}` : null;

  return (
    <div className={classes.page}>
      <Link to="/market" className={classes.backLink}>
        ← Back
      </Link>

      <div className={classes.grid}>
        {listing.animated_preview_url ? (
          <ListingAnimatedPreview
            coverUrl={listing.preview_url}
            animationUrl={listing.animated_preview_url}
            className={classes.img}
          />
        ) : listing.preview_url ? (
          <img
            src={listing.preview_url}
            alt=""
            className={classes.img}
            loading="lazy"
          />
        ) : (
          <div className={classes.img} />
        )}

        <div className={classes.rightCol}>
          <div className={classes.titleRow}>
            <h1 className={classes.h1}>{listing.title}</h1>

            <span className={classes.badge}>{listing.offering_type}</span>

            {isLive && <span className={classes.liveBadge}>Live</span>}
          </div>

          <p className={classes.desc}>{listing.short}</p>

          <div className={classes.priceRow}>
            <div className={classes.price}>
              {listing.is_free ? (
                "Free"
              ) : (
                <ListingPriceText listing={listing} variant="detailed" />
              )}
            </div>

            {creatorLink ? (
              <Link to={creatorLink} className={classes.creatorLink}>
                by {creatorName}
                {isLive ? " • Live" : ""} →
              </Link>
            ) : (
              <span className={classes.creatorLink}>
                by {creatorName}
                {isLive ? " • Live" : ""}
              </span>
            )}
          </div>

          <p className={classes.metaText}>
            Last updated: {updatedText(listing.updated_at)}
          </p>

          <div className={classes.chips}>
            <span className={classes.chip}>{listing.category}</span>

            {listing.video_subtype && (
              <span className={classes.chip}>{listing.video_subtype}</span>
            )}

            {listing.deliverables.map((deliverable) => (
              <span key={deliverable} className={classes.chip}>
                {deliverable}
              </span>
            ))}
          </div>

          {isLive && stream?.thumbnailUrl && (
            <div className={classes.liveCard}>
              <img
                src={stream.thumbnailUrl
                  .replace("{width}", "960")
                  .replace("{height}", "540")}
                alt=""
                className={classes.liveImg}
                loading="lazy"
              />

              <div className={classes.liveBody}>
                <div className={classes.liveMeta}>
                  {stream.gameName ?? ""}
                  <span className={classes.liveDot}> • </span>
                  {stream.viewerCount ?? 0} viewers
                </div>

                {stream.title && (
                  <p className={classes.liveTitle}>{stream.title}</p>
                )}
              </div>
            </div>
          )}

          <div className={classes.ctaBox}>
            {listing.is_free && freeListingHref ? (
              <>
                <div className={classes.ctaTitle}>
                  {listing.free_delivery_type === "download"
                    ? "Free download"
                    : "Free — hosted elsewhere"}
                </div>

                <p className={classes.ctaText}>
                  {listing.free_delivery_type === "download"
                    ? "No payment, no sign-in required — this file is uploaded and hosted here."
                    : "This opens on the creator's own site or store, outside Made for Stream."}
                </p>

                <a
                  className={classes.ctaLink}
                  href={freeListingHref}
                  target="_blank"
                  rel="noreferrer"
                  {...(listing.free_delivery_type === "download" && listing.free_file_name
                    ? { download: listing.free_file_name }
                    : {})}
                >
                  {listing.free_delivery_type === "download"
                    ? "Download for free"
                    : "Get it free ↗"}
                </a>
              </>
            ) : (
              <>
                <div className={classes.ctaTitle}>{fulfilmentCopy.title}</div>

                <p className={classes.ctaText}>{fulfilmentCopy.text}</p>

                {listing.fulfilment_mode === "request" ? (
                  activeRequestQuery.isLoading ? (
                    <span className={classes.ctaLink}>Checking commission…</span>
                  ) : activeListingRequest ? (
                    <Link className={classes.ctaLink} to={`/requests/${activeListingRequest.id}`}>
                      View existing commission
                    </Link>
                  ) : (
                    <Link className={classes.ctaLink} to={`/listing/${listing.id}/request`}>
                      Send commission request
                    </Link>
                  )
                ) : (
                  <Link className={classes.ctaLink} to="#">
                    {fulfilmentCopy.primaryLabel}
                  </Link>
                )}
              </>
            )}
          </div>

          <div className={classes.reportCard}>
            <h2 className={classes.reportTitle}>Report listing</h2>

            <p className={classes.reportText}>
              Report this listing if it appears unsafe, misleading, stolen, abusive, or
              against Made for Stream rules. Reporting does not automatically hide the listing.
            </p>

            {reportSuccess && (
              <div className={classes.successCard}>{reportSuccess}</div>
            )}

            {reportError && (
              <div className={classes.errorCard}>{reportError}</div>
            )}

            {!user ? (
              <div className={classes.reportForm}>
                <p className={classes.reportText}>
                  You need to sign in before reporting a listing.
                </p>

                <Link className={classes.btnOutline} to="/signin">
                  Sign in to report
                </Link>
              </div>
            ) : isOwnListing ? (
              <p className={classes.reportText}>
                You cannot report your own listing.
              </p>
            ) : (
              <div className={classes.reportForm}>
                {!isReportOpen ? (
                  <button
                    className={classes.btnOutline}
                    type="button"
                    onClick={() => {
                      setIsReportOpen(true);
                      setReportSuccess(null);
                      setReportError(null);
                    }}
                  >
                    Report listing
                  </button>
                ) : (
                  <FadeIn className="space-y-3">
                    <div className={classes.field}>
                      <label className={classes.label} htmlFor="listingReportReason">
                        Reason
                      </label>

                      <select
                        id="listingReportReason"
                        className={classes.select}
                        value={reportReason ?? ""}
                        onChange={(event) =>
                          setReportReason(
                            event.target.value as ModerationReportReasonCode
                          )
                        }
                      >
                        {moderationReportReasonOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={classes.field}>
                      <label className={classes.label} htmlFor="listingReportDetails">
                        Details
                      </label>

                      <textarea
                        id="listingReportDetails"
                        className={classes.textarea}
                        value={reportDetails}
                        onChange={(event) => setReportDetails(event.target.value)}
                        placeholder="Optional. Add context that will help admins review this report."
                        maxLength={2000}
                      />

                      <div className={classes.hint}>
                        {reportDetailsTrimmed.length}/2000 characters.
                      </div>
                    </div>

                    <div className={classes.row}>
                      <button
                        className={classes.btnDanger ?? classes.btnPrimary}
                        type="button"
                        disabled={!canSubmitListingReport}
                        onClick={() => void handleSubmitListingReport()}
                      >
                        {submitListingReport.isPending
                          ? "Submitting…"
                          : "Submit report"}
                      </button>

                      <button
                        className={classes.btnOutline}
                        type="button"
                        disabled={submitListingReport.isPending}
                        onClick={() => {
                          setIsReportOpen(false);
                          setReportError(null);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </FadeIn>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingPage;