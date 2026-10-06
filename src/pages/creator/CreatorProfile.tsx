import { Collapse } from "../../lib/motion";
import { Link, useNavigate, useParams } from "react-router-dom";
import { normalizeTwitchLogin } from "../../domain/twitch";
import { usePublicCreatorProfile } from "../../hooks/profile/usePublicCreatorProfile";
import { useTwitchStreams } from "../../hooks/useTwitchStreams";
import { useState } from 'react';
import { ConversationInitiationReasonCode, conversationInitiationReasonOptions } from '../../domain/conversations/conversations';
import { useCreateCreatorInquiryConversation } from '../../hooks/conversations/useCreateInquiryConversation';
import { useAuth } from '../../providers/AuthProvider';
import { useSubmitProfileModerationReport } from '../../hooks/moderation/useSubmitProfileModerationReport';
import { ModerationReportReasonCode, moderationReportReasonOptions } from '../../domain/moderation/moderationReports';

const classes = {
  container: "space-y-8",

  backLink: "backLink",

  notFoundWrap: "space-y-4",
  h1: "pageTitle",
  h2: "font-display text-xl font-extrabold tracking-tight",

  card: "card p-6",

  titleRow: "flex flex-wrap items-center gap-2",
  bio: "mt-2 text-zinc-600",

  badgeLive: "badge badgeLive",

  linksRow: "mt-4 flex flex-wrap gap-2",
  btnPrimary: "btnPrimary",
  btnOutline: "btnOutline",

  listingsSection: "space-y-3",
  emptyText: "text-sm text-zinc-600",
  loadingText: "text-sm text-zinc-600",
  grid: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",

  listingCard: "card overflow-hidden",
  listingImg: "h-40 w-full object-cover bg-zinc-100",
  listingBody: "p-4",
  listingTitle: "font-display text-base font-extrabold tracking-tight",
  listingDesc: "mt-1 text-sm text-zinc-600",
  listingMeta: "mt-3 flex items-center justify-between text-sm",
  listingMetaLeft: "font-extrabold",
  listingMetaRight: "text-zinc-600",

  liveCard: "mt-4 overflow-hidden rounded-3xl border border-zinc-200 bg-white",
  liveImg: "h-56 w-full object-cover",
  liveBody: "p-4",
  liveMeta: "text-sm font-extrabold text-zinc-900",
  liveDot: "text-zinc-500",
  liveTitle: "mt-1 text-sm text-zinc-600",

  platformSection: "mt-6 space-y-3",
  platformSectionTitle: "text-sm font-extrabold text-zinc-900",
  platformList: "space-y-2",
  platformItem:
    "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-3",
  platformItemLeft: "space-y-1",
  platformItemTitle: "text-sm font-semibold text-zinc-900",
  platformItemValue: "text-sm text-zinc-600",
  platformItemLink: "text-sm font-semibold text-zinc-600 hover:text-zinc-900",
  platformBtnBase:
    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold shadow-[0_3px_10px_rgba(0,0,0,0.08)] transition-all duration-200 hover:-translate-y-[1px]",
  platformBtnTwitch:
    "border-[#9146FF] bg-[#9146FF] text-white hover:brightness-110 hover:shadow-[0_8px_22px_rgba(145,70,255,0.30)]",
  platformBtnYouTube:
    "border-[#FF0000] bg-[#FF0000] text-white hover:brightness-105 hover:shadow-[0_8px_22px_rgba(255,0,0,0.24)]",
  platformBtnGeneric:
    "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 hover:border-zinc-400",
  platformBtnIcon: "h-4 w-4 shrink-0",

  inquiryBox:
    "mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4",
  inquiryTitle: "font-extrabold text-zinc-900",
  inquiryText: "mt-1 text-sm text-zinc-600",
  form: "mt-4 space-y-3",
  field: "space-y-2",
  label: "formLabel",
  select:
    "formControl",
  textarea:
    "formControl min-h-[120px]",
  hint: "formHint",
  errorBox:
    "notice noticeError",

  reportCard: "card p-5",
  reportTitle: "font-display text-base font-extrabold tracking-tight",
  reportText: "mt-1 text-sm text-zinc-600",
  reportForm: "mt-4 space-y-3",
  row: "flex flex-wrap items-center gap-3",
  successCard:
    "notice noticeSuccess",
  errorCard:
    "notice noticeError",
  btnDanger:
    "btnDanger",
} as const;

type CreatorLinkButtonProps = {
  href: string;
  label: string;
  platform?: "twitch" | "youtube" | "generic";
};

const TwitchLogo = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={classes.platformBtnIcon}
    fill="currentColor"
  >
    <path d="M4 3h16v11l-4 4h-4l-2 2H7v-2H4V3Zm14 10V5H6v11h3v2l2-2h4l3-3Z" />
    <path d="M10 8h2v5h-2V8Zm5 0h2v5h-2V8Z" />
  </svg>
);

const YouTubeLogo = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={classes.platformBtnIcon}
    fill="currentColor"
  >
    <path d="M23 12.001s0-3.068-.389-4.548a2.965 2.965 0 0 0-2.084-2.1C18.691 4.85 12 4.85 12 4.85s-6.691 0-8.527.503a2.965 2.965 0 0 0-2.084 2.1C1 8.933 1 12.001 1 12.001s0 3.068.389 4.548a2.965 2.965 0 0 0 2.084 2.1c1.836.503 8.527.503 8.527.503s6.691 0 8.527-.503a2.965 2.965 0 0 0 2.084-2.1c.389-1.48.389-4.548.389-4.548ZM10 15.5v-7l6 3.5-6 3.5Z" />
  </svg>
);

const getPlatformButtonClass = (
  platform: CreatorLinkButtonProps["platform"]
): string =>
  platform === "twitch"
    ? `${classes.platformBtnBase} ${classes.platformBtnTwitch}`
    : platform === "youtube"
      ? `${classes.platformBtnBase} ${classes.platformBtnYouTube}`
      : `${classes.platformBtnBase} ${classes.platformBtnGeneric}`;

const CreatorLinkButton = ({
  href,
  label,
  platform = "generic",
}: CreatorLinkButtonProps) => (
  <a
    className={getPlatformButtonClass(platform)}
    target="_blank"
    rel="noreferrer"
    href={href}
  >
    {platform === "twitch" && <TwitchLogo />}
    {platform === "youtube" && <YouTubeLogo />}
    <span>{label}</span>
  </a>
);

const CreatorNotFound = () => (
  <div className={classes.notFoundWrap}>
    <h1 className={classes.h1}>Creator not found</h1>

    <Link to="/creators" className={classes.btnOutline}>
      Back to creators
    </Link>
  </div>
);

const CreatorProfile = () => {
  const { handle } = useParams<{ handle: string }>();
  const { twitchByLogin } = useTwitchStreams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, error } = usePublicCreatorProfile(handle ?? null);
  const createInquiryMutation = useCreateCreatorInquiryConversation();
  const submitProfileReport = useSubmitProfileModerationReport();

  const profile = data?.profile ?? null;
  const profileUserId = profile?.user_id ?? null;

  const [showInquiryForm, setShowInquiryForm] = useState(false);
  const [inquiryTopic, setInquiryTopic] =
    useState<ConversationInitiationReasonCode | "">("");
  const [inquiryMessage, setInquiryMessage] = useState("");

  const defaultProfileReportReason =
    moderationReportReasonOptions[0]?.value ?? null;

  const [isProfileReportOpen, setIsProfileReportOpen] = useState(false);
  const [profileReportReason, setProfileReportReason] =
    useState<ModerationReportReasonCode | null>(defaultProfileReportReason);
  const [profileReportDetails, setProfileReportDetails] = useState("");
  const [profileReportSuccess, setProfileReportSuccess] = useState<string | null>(
    null
  );
  const [profileReportError, setProfileReportError] = useState<string | null>(
    null
  );

  const profileReportDetailsTrimmed = profileReportDetails.trim();

  const canSubmitProfileReport =
    Boolean(profileUserId && profileReportReason) &&
    profileReportDetailsTrimmed.length <= 2000 &&
    !submitProfileReport.isPending;

  const handleSubmitProfileReport = async () => {
    if (!profileUserId || !profileReportReason || !canSubmitProfileReport) return;

    setProfileReportSuccess(null);
    setProfileReportError(null);

    try {
      await submitProfileReport.mutateAsync({
        profileUserId,
        reasonCode: profileReportReason,
        reasonDetails: profileReportDetailsTrimmed,
      });

      setProfileReportSuccess(
        "Profile report submitted. An admin will review it soon."
      );
      setProfileReportDetails("");
      setIsProfileReportOpen(false);
    } catch (error) {
      setProfileReportError(
        error instanceof Error
          ? error.message
          : "Profile report could not be submitted."
      );
    }
  };

  if (!handle) return <CreatorNotFound />;

  if (isLoading) {
    return (
      <div className={classes.container}>
        <div className={classes.loadingText}>Loading…</div>
      </div>
    );
  }

  if (error || !profile || !data) return <CreatorNotFound />;

  const { platformAccounts, listings } = data;

  const twitchAccount =
    platformAccounts.find((account) => account.platform === "twitch") ?? null;

  const youtubeAccount =
    platformAccounts.find((account) => account.platform === "youtube") ?? null;

  const twitchLoginRaw = twitchAccount?.platform_login ?? null;
  const twitchLogin = twitchLoginRaw
    ? normalizeTwitchLogin(twitchLoginRaw)
    : null;

  const stream = twitchLogin ? twitchByLogin[twitchLogin] : undefined;
  const isLive = Boolean(stream);

  const watchUrl =
    twitchAccount?.profile_url ??
    (twitchLogin
      ? `https://twitch.tv/${encodeURIComponent(twitchLogin)}`
      : undefined);

  const inquiryMessageTrimmed = inquiryMessage.trim();
  const isOwnProfile = user?.id === profile.user_id;

  const inquiryMessageError =
    inquiryMessageTrimmed.length > 0 && inquiryMessageTrimmed.length < 10
      ? "Message must be at least 10 characters."
      : inquiryMessageTrimmed.length > 2000
        ? "Message must be 2000 characters or less."
        : null;

  const canSubmitInquiry =
    Boolean(profile.user_id) &&
    Boolean(inquiryTopic) &&
    inquiryMessageTrimmed.length >= 10 &&
    inquiryMessageTrimmed.length <= 2000 &&
    !createInquiryMutation.isPending;

  const handleCreateInquiry = async () => {
    if (!profile.user_id || !inquiryTopic || !canSubmitInquiry) return;

    try {
      const conversation = await createInquiryMutation.mutateAsync({
        creatorUserId: profile.user_id,
        initiationReasonCode: inquiryTopic,
        initialMessage: inquiryMessageTrimmed,
      });

      navigate(`/messages/${conversation.id}`);
    } catch {
      // createInquiryMutation.error is rendered in the form below.
    }
  };

  return (
    <div className={classes.container}>
      <Link to="/creators" className={classes.backLink}>
        ← Back
      </Link>

      <section className={classes.card}>
        <div className={classes.titleRow}>
          <h1 className={classes.h1}>
            {profile.display_name ?? profile.handle ?? "Creator"}
          </h1>

          {isLive && <span className={classes.badgeLive}>Live</span>}
        </div>

        {profile.bio && <p className={classes.bio}>{profile.bio}</p>}

        <div className={classes.linksRow}>
          {watchUrl && (
            <CreatorLinkButton
              href={watchUrl}
              label={isLive ? "Watch live on Twitch" : "Twitch"}
              platform="twitch"
            />
          )}

          {youtubeAccount?.profile_url && (
            <CreatorLinkButton
              href={youtubeAccount.profile_url}
              label="YouTube"
              platform="youtube"
            />
          )}
        </div>

        <div className={classes.inquiryBox}>
          <div className={classes.inquiryTitle}>Message this creator</div>

          <p className={classes.inquiryText}>
            Start a focused conversation with a required topic so the creator knows what
            you are asking about.
          </p>

          {authLoading ? (
            <p className={classes.inquiryText}>Checking sign-in status…</p>
          ) : !user ? (
            <Link to="/signin" className={`${classes.btnPrimary} mt-3 inline-flex`}>
              Sign in to message
            </Link>
          ) : isOwnProfile ? (
            <p className={classes.inquiryText}>
              You cannot start a conversation with your own creator profile.
            </p>
          ) : (
            <>
              <button
                className={`${classes.btnOutline} mt-3`}
                type="button"
                onClick={() => setShowInquiryForm((current) => !current)}
              >
                {showInquiryForm ? "Cancel message" : "Message creator"}
              </button>

              <Collapse open={showInquiryForm}>
                <div className={classes.form}>
                  <div className={classes.field}>
                    <label className={classes.label} htmlFor="creatorInquiryTopic">
                      Topic
                    </label>

                    <select
                      id="creatorInquiryTopic"
                      className={classes.select}
                      value={inquiryTopic}
                      onChange={(event) =>
                        setInquiryTopic(
                          event.target.value as ConversationInitiationReasonCode | ""
                        )
                      }
                    >
                      <option value="">Choose a topic</option>

                      {conversationInitiationReasonOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={classes.field}>
                    <label className={classes.label} htmlFor="creatorInquiryMessage">
                      Message
                    </label>

                    <textarea
                      id="creatorInquiryMessage"
                      className={classes.textarea}
                      value={inquiryMessage}
                      onChange={(event) => setInquiryMessage(event.target.value)}
                      placeholder="Ask a focused question about availability, style fit, pricing, deliverables, or project scope."
                      maxLength={2000}
                      disabled={createInquiryMutation.isPending}
                    />

                    <div className={classes.hint}>
                      {inquiryMessageTrimmed.length}/2000 characters. Minimum 10.
                    </div>

                    {inquiryMessageError && (
                      <div className={classes.errorBox}>{inquiryMessageError}</div>
                    )}
                  </div>

                  {createInquiryMutation.error && (
                    <div className={classes.errorBox}>
                      Conversation could not be started right now.
                    </div>
                  )}

                  <button
                    className={classes.btnPrimary}
                    type="button"
                    onClick={() => void handleCreateInquiry()}
                    disabled={!canSubmitInquiry}
                  >
                    {createInquiryMutation.isPending
                      ? "Starting conversation…"
                      : "Start conversation"}
                  </button>
                </div>
              </Collapse>
            </>
          )}
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
      </section>

      <section className={classes.listingsSection}>
        <h2 className={classes.h2}>Listings</h2>

        {listings.length === 0 ? (
          <p className={classes.emptyText}>No listings yet.</p>
        ) : (
          <div className={classes.grid}>
            {listings.map((listing) => (
              <Link
                key={listing.id}
                to={`/listing/${listing.id}`}
                className={classes.listingCard}
              >
                {listing.preview_url ? (
                  <img
                    src={listing.preview_url}
                    alt=""
                    className={classes.listingImg}
                    loading="lazy"
                  />
                ) : (
                  <div className={classes.listingImg} />
                )}

                <div className={classes.listingBody}>
                  <div className={classes.listingTitle}>{listing.title}</div>
                  <p className={classes.listingDesc}>{listing.short}</p>

                  <div className={classes.listingMeta}>
                    <span className={classes.listingMetaLeft}>
                      {listing.offering_type}
                    </span>

                    <span className={classes.listingMetaRight}>
                      {listing.category}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      <div className={classes.reportCard}>
        <h2 className={classes.reportTitle}>Report creator</h2>

        <p className={classes.reportText}>
          Report this creator profile if it appears unsafe, misleading, abusive,
          impersonated, or against Made for Stream rules. Reporting does not automatically
          restrict the profile.
        </p>

        {profileReportSuccess && (
          <div className={classes.successCard}>{profileReportSuccess}</div>
        )}

        {profileReportError && (
          <div className={classes.errorCard}>{profileReportError}</div>
        )}

        {authLoading ? (
          <p className={classes.reportText}>Checking sign-in status…</p>
        ) : !user ? (
          <div className={classes.reportForm}>
            <p className={classes.reportText}>
              You need to sign in before reporting a creator.
            </p>

            <Link className={classes.btnOutline} to="/signin">
              Sign in to report
            </Link>
          </div>
        ) : isOwnProfile ? (
          <p className={classes.reportText}>
            You cannot report your own creator profile.
          </p>
        ) : (
          <div className={classes.reportForm}>
            {!isProfileReportOpen ? (
              <button
                className={classes.btnOutline}
                type="button"
                onClick={() => {
                  setIsProfileReportOpen(true);
                  setProfileReportSuccess(null);
                  setProfileReportError(null);
                }}
              >
                Report creator
              </button>
            ) : (
              <>
                <div className={classes.field}>
                  <label className={classes.label} htmlFor="profileReportReason">
                    Reason
                  </label>

                  <select
                    id="profileReportReason"
                    className={classes.select}
                    value={profileReportReason ?? ""}
                    onChange={(event) =>
                      setProfileReportReason(
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
                  <label className={classes.label} htmlFor="profileReportDetails">
                    Details
                  </label>

                  <textarea
                    id="profileReportDetails"
                    className={classes.textarea}
                    value={profileReportDetails}
                    onChange={(event) => setProfileReportDetails(event.target.value)}
                    placeholder="Optional. Add context that will help admins review this profile."
                    maxLength={2000}
                    disabled={submitProfileReport.isPending}
                  />

                  <div className={classes.hint}>
                    {profileReportDetailsTrimmed.length}/2000 characters.
                  </div>
                </div>

                <div className={classes.row}>
                  <button
                    className={classes.btnDanger}
                    type="button"
                    disabled={!canSubmitProfileReport}
                    onClick={() => void handleSubmitProfileReport()}
                  >
                    {submitProfileReport.isPending
                      ? "Submitting…"
                      : "Submit report"}
                  </button>

                  <button
                    className={classes.btnOutline}
                    type="button"
                    disabled={submitProfileReport.isPending}
                    onClick={() => {
                      setIsProfileReportOpen(false);
                      setProfileReportError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreatorProfile;