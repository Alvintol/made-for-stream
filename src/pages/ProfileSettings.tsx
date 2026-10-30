import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../providers/AuthProvider";
import { useMyProfile, type ProfileRow } from "../hooks/profile/useMyProfile";
import { useProfilePlatformAccounts } from "../hooks/profile/useProfilePlatformAccounts";
import { useSellerAccess } from "../hooks/creatorApplication/useSellerAccess";
import {
  getCreatorPaymentAccountIsReady,
  getCreatorPaymentAccountStatusLabel,
  useCreatorPaymentAccount,
} from "../hooks/payments/useCreatorPaymentAccount";
import { getProfileAvatarUrl } from "../domain/profileMedia";
import { getDisplayNameError } from "../domain/settings/displayName";
import {
  getAccountSetupProgress,
  getAccountSetupSteps,
  getNextAccountSetupStep,
  type AccountSetupStep,
  type AccountSetupStepKey,
} from "../domain/settings/accountSetup";
import CollapsibleSection from "../components/ui/CollapsibleSection";
import CreatorPayoutSettings from "../components/settings/CreatorPayoutSettings";
import { useT, type Translate } from "../lib/i18n/i18n";
import { FadeIn } from "../lib/motion";
import KeptPlaceholder from "../components/ui/KeptPlaceholder";

const classes = {
  page: "space-y-4",
  // The settings pages list already takes a column, so the checklist only
  // sits beside the sections on very wide screens.
  layout: "grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]",
  sections: "card min-w-0 divide-y divide-[var(--hairline)] overflow-hidden hover:shadow-[var(--shadow-md)]",

  noticeInfo: "notice noticeInfo",
  noticeOk: "notice noticeSuccess",
  noticeErr: "notice noticeError",

  // Profile
  avatarRow: "flex items-center gap-3 rounded-xl border border-[var(--hairline)] px-3 py-2.5",
  avatar: "h-10 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-100",
  avatarImage: "h-full w-full object-cover",
  avatarFallback: "flex h-full w-full items-center justify-center text-[10px] font-semibold text-zinc-600",
  avatarText: "min-w-0 text-xs text-zinc-600",
  avatarTitle: "font-semibold text-zinc-900",
  grid: "grid gap-3 sm:grid-cols-2",
  field: "space-y-1.5",
  fieldWide: "space-y-1.5 sm:col-span-2",
  label: "formLabel",
  input: "formControl",
  textarea: "formControl min-h-[96px]",
  fieldHelp: "text-xs text-zinc-500",
  footer: "flex flex-wrap items-center justify-end gap-2",
  saved: "mr-auto text-xs font-medium text-emerald-700",

  // Rows (platforms, requirements)
  rows: "divide-y divide-[var(--hairline)] rounded-xl border border-[var(--hairline)]",
  row: "flex items-center gap-3 px-3 py-2.5",
  rowBadge:
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white",
  twitch: "bg-[#9146FF]",
  youtube: "bg-[#FF0033]",
  rowMain: "min-w-0 flex-1",
  rowTitle: "text-sm font-semibold text-zinc-900",
  rowSub: "truncate text-xs text-zinc-500",
  rowLink: "font-medium text-[rgb(var(--accent-text))] hover:underline",
  btn: "btnOutline btnSm shrink-0",
  btnPrimary: "btnPrimary btnSm shrink-0",
  soon: "chip shrink-0",

  // Creator access
  statusRow: "flex flex-wrap items-center justify-between gap-3",
  statusText: "text-sm text-zinc-600",
  statusStrong: "font-semibold text-zinc-900",
  checklist: "grid gap-x-4 gap-y-1.5 text-sm text-zinc-700 sm:grid-cols-2",
  check: "flex items-start gap-2",
  checkMark: "mt-0.5 h-4 w-4 shrink-0 rounded-full text-center text-[10px] font-bold leading-4",
  checkDone: "bg-emerald-100 text-emerald-700",
  checkTodo: "border border-zinc-300 text-transparent",
  pills: "flex flex-wrap gap-1.5",
  pill: "chip",

  // Badges in section headers
  badge: "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
  badgeDone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  badgeMuted: "border-zinc-200 bg-zinc-100 text-zinc-600",
  badgeWaiting: "border-sky-200 bg-sky-50 text-sky-700",

  // Setup checklist
  aside: "card p-4 hover:shadow-[var(--shadow-md)] xl:sticky xl:top-24",
  asideHead: "flex items-center justify-between gap-3",
  asideTitle: "font-display text-sm font-bold text-zinc-900",
  asideCount: "text-xs font-medium text-zinc-500",
  bar: "mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200",
  barFill: "h-full rounded-full bg-gradient-to-r from-[rgb(var(--accent))] to-[rgb(var(--brand))] transition-[width] duration-500",
  steps: "mt-3 hidden space-y-0.5 xl:block",
  step:
    "flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-[rgb(var(--ink)/0.04)]",
  stepIcon:
    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
  iconDone: "bg-emerald-100 text-emerald-700",
  iconTodo: "border border-[rgb(var(--brand))] text-[rgb(var(--brand))]",
  iconWaiting: "bg-sky-100 text-sky-700",
  iconLocked: "bg-zinc-100 text-zinc-500",
  stepLabel: "block text-sm font-semibold text-zinc-900",
  stepLabelMuted: "block text-sm font-semibold text-zinc-500",
  stepDetail: "block text-xs text-zinc-500",
  next: "mt-3 flex items-center justify-between gap-3 border-t border-[var(--hairline)] pt-3 xl:hidden",
  nextText: "min-w-0 text-xs text-zinc-600",
  allDone: "mt-3 text-xs text-zinc-500",

  signedOut: "card space-y-3 p-5",
  signedOutTitle: "font-display text-base font-bold text-zinc-900",
  signedOutActions: "flex flex-wrap gap-2",
} as const;

const creatorRequirements = [
  "profile.reqProfile",
  "profile.reqPlatform",
  "profile.reqRecent",
  "profile.reqSamples",
  "profile.reqReview",
] as const;

// Pulls a readable error message from an unknown thrown value
const getErrorMessage = (error: unknown, t: Translate): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : t("apply.failed");

// Validates a public handle
const isValidHandle = (value: string): boolean =>
  /^[a-z0-9][a-z0-9_-]{2,24}$/i.test(value);

const stepIcon: Record<AccountSetupStep["state"], { className: string; glyph: string }> = {
  done: { className: classes.iconDone, glyph: "✓" },
  todo: { className: classes.iconTodo, glyph: "•" },
  waiting: { className: classes.iconWaiting, glyph: "…" },
  locked: { className: classes.iconLocked, glyph: "—" },
  optional: { className: classes.iconLocked, glyph: "+" },
};

const StepBadge = ({ step }: { step: AccountSetupStep }): ReactNode => {
  const t = useT();

  return step.state === "done" ? (
    <span className={`${classes.badge} ${classes.badgeDone}`}>{t("apply.done")}</span>
  ) : step.state === "waiting" ? (
    <span className={`${classes.badge} ${classes.badgeWaiting}`}>{t("stage.inReview")}</span>
  ) : step.state === "locked" || step.state === "optional" ? (
    <span className={`${classes.badge} ${classes.badgeMuted}`}>
      {t(step.state === "locked" ? "profile.locked" : "agreement.optionalBadge")}
    </span>
  ) : null;
};

const ProfileSettings = () => {
  const t = useT();
  const navigate = useNavigate();
  const { search } = useLocation();

  const { user, session, loading } = useAuth();
  const { data: profile, isLoading, error, refetch } = useMyProfile();

  const {
    data: platformAccounts = [],
    isLoading: isLoadingPlatforms,
    error: platformAccountsError,
    refetch: refetchPlatformAccounts,
  } = useProfilePlatformAccounts();

  const {
    isLoading: isSellerAccessLoading,
    sellerApplication,
    creatorStatusLabel,
    canStartApplication,
    isCreatorApproved,
    profileReady,
    hasLinkedCreatorPlatform,
  } = useSellerAccess();

  const { data: paymentAccount = null } = useCreatorPaymentAccount();

  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ key: AccountSetupStepKey; nonce: number } | null>(null);

  const focusSection = (key: AccountSetupStepKey) =>
    setFocus((current) => ({ key, nonce: (current?.nonce ?? 0) + 1 }));

  // Shows Twitch callback results when redirected back to this page
  useEffect(() => {
    const params = new URLSearchParams(search);
    const twitch = params.get("twitch");

    if (!twitch) return;

    if (twitch === "connected") {
      setOkMsg(t("profile.twitchConnected"));
      setErrMsg(null);
      void Promise.all([refetch(), refetchPlatformAccounts()]);
    }

    if (twitch === "error") {
      setErrMsg(params.get("msg") ?? t("profile.twitchFailed"));
      setOkMsg(null);
    }

    setFocus((current) => ({ key: "connections", nonce: (current?.nonce ?? 0) + 1 }));

    // Removes the query params so the message does not reappear on refresh
    navigate({ pathname: "/settings/profile", search: "" }, { replace: true });
  }, [search, navigate, refetch, refetchPlatformAccounts, t]);

  // Syncs form state from the latest profile response
  useEffect(() => {
    if (!profile) return;

    setHandle(profile.handle ?? "");
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
  }, [profile]);

  // Marks the first profile-settings visit as seen
  useEffect(() => {
    if (!user?.id || !profile || profile.profile_setup_seen) return;

    const markProfileSetupSeen = async () => {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_setup_seen: true })
        .eq("user_id", user.id);

      if (!updateError) {
        setInfoMsg(t("profile.welcome"));
        await refetch();
      }
    };

    void markProfileSetupSeen();
  }, [user?.id, profile, refetch, t]);

  const loadError = useMemo(() => {
    const messages = [
      error ? getErrorMessage(error, t) : null,
      platformAccountsError ? getErrorMessage(platformAccountsError, t) : null,
    ].filter(Boolean);

    return messages.length ? messages.join(" ") : null;
  }, [error, platformAccountsError, t]);

  const twitchAccount = platformAccounts.find((account) => account.platform === "twitch") ?? null;
  const youtubeAccount = platformAccounts.find((account) => account.platform === "youtube") ?? null;
  const isTwitchConnected = Boolean(twitchAccount?.platform_user_id);
  const avatarUrl = getProfileAvatarUrl(profile, twitchAccount);

  const payoutsReady = getCreatorPaymentAccountIsReady(paymentAccount);

  const steps = useMemo(
    () =>
      getAccountSetupSteps({
        profileReady,
        hasLinkedPlatform: hasLinkedCreatorPlatform,
        applicationStatus: sellerApplication?.status ?? null,
        payoutsReady,
      }, t),
    [profileReady, hasLinkedCreatorPlatform, sellerApplication?.status, payoutsReady, t]
  );

  const stepByKey = Object.fromEntries(steps.map((step) => [step.key, step])) as Record<
    AccountSetupStepKey,
    AccountSetupStep
  >;

  const isSettled = !loading && !isLoading && !isLoadingPlatforms && !isSellerAccessLoading;
  const nextStep = isSettled ? getNextAccountSetupStep(steps) : null;
  const progress = getAccountSetupProgress(steps);

  // The step to work on opens by default; with nothing pending, the profile stays open.
  const sectionFlags = (key: AccountSetupStepKey) => ({
    attention: nextStep?.key === key,
    // Linking a platform helps but is not required.
    attentionLabel: t(key === "connections" ? "profile.recommended" : "common.needsAttention"),
    defaultOpen: isSettled && !nextStep && key === "profile",
    focusKey: focus?.key === key ? focus.nonce : null,
  });

  const onSave = async () => {
    if (!user?.id) return;

    setOkMsg(null);
    setErrMsg(null);
    setInfoMsg(null);
    setSavedAt(null);

    const nextHandle = handle.trim();
    const nextDisplayName = displayName.trim();
    const nextBio = bio.trim();

    if (nextHandle && !isValidHandle(nextHandle)) {
      setErrMsg(t("profile.handleError"));
      return;
    }

    const displayNameError = getDisplayNameError(nextDisplayName, t);

    if (displayNameError) {
      setErrMsg(displayNameError);
      return;
    }

    try {
      setBusy(true);

      const patch: Partial<ProfileRow> & Record<string, unknown> = {
        handle: nextHandle || null,
        display_name: nextDisplayName,
        bio: nextBio || null,
        profile_setup_seen: true,
        profile_setup_completed_at:
          profile?.profile_setup_completed_at ?? new Date().toISOString(),
      };

      // If the user manually sets a display name, stop auto-syncing from email
      if ((profile?.display_name_auto ?? true) && nextDisplayName) {
        patch.display_name_auto = false;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(patch)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setSavedAt(Date.now());
      await refetch();
    } catch (saveError) {
      setErrMsg(getErrorMessage(saveError, t));
    } finally {
      setBusy(false);
    }
  };

  // Starts Twitch account linking for trust / profile enrichment
  const onConnectTwitch = async () => {
    setOkMsg(null);
    setErrMsg(null);
    setInfoMsg(null);

    if (isTwitchConnected) {
      setInfoMsg(t("profile.alreadyConnected"));
      return;
    }

    const token = session?.access_token;

    if (!token) {
      setErrMsg(t("profile.mustSignIn"));
      return;
    }

    try {
      setBusy(true);

      const apiBase =
        (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

      const response = await fetch(`${apiBase}/api/twitch/connect/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const json = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !json.url) {
        throw new Error(json.error || `Twitch connect failed (${response.status})`);
      }

      window.location.assign(json.url);
    } catch (connectError) {
      setErrMsg(getErrorMessage(connectError, t));
      setBusy(false);
    }
  };

  const creatorApplicationCtaLabel = !sellerApplication
    ? t("apply.start")
    : stepByKey.creator.actionLabel;

  if (!loading && !user) {
    return (
      <div className={classes.signedOut}>
        <div className={classes.signedOutTitle}>{t("apply.signedOutTitle")}</div>
        <p className={classes.statusText}>{t("profile.signedOutText")}</p>
        <div className={classes.signedOutActions}>
          <Link className="btnPrimary btnSm" to="/signin">
            {t("apply.signIn")}
          </Link>
          <Link className="btnOutline btnSm" to="/">
            {t("apply.home")}
          </Link>
        </div>
      </div>
    );
  }

  const profileSummary = profileReady
    ? `@${profile?.handle} · ${profile?.display_name}`
    : t("setup.profileTodo");

  const platformSummary = isTwitchConnected
    ? `Twitch${twitchAccount?.platform_login ? ` · @${twitchAccount.platform_login}` : ""}`
    : isLoadingPlatforms
      ? t("dashboard.checking")
      : t("profile.noPlatforms");

  const payoutSummary = isCreatorApproved
    ? getCreatorPaymentAccountStatusLabel(paymentAccount, t)
    : t("profile.payoutsLocked");

  return (
    <div className={classes.page}>
      {infoMsg && <FadeIn className={classes.noticeInfo}>{infoMsg}</FadeIn>}
      {okMsg && <FadeIn className={classes.noticeOk}>{okMsg}</FadeIn>}
      {(errMsg || loadError) && (
        <FadeIn className={classes.noticeErr}>{errMsg ?? loadError}</FadeIn>
      )}

      <div className={classes.layout}>
        <aside className={`${classes.aside} xl:order-last`} aria-label={t("profile.setup")}>
          <div className={classes.asideHead}>
            <span className={classes.asideTitle}>{t("profile.setup")}</span>
            <span className={classes.asideCount}>
              {t("profile.progress", { done: progress.done, total: progress.total })}
            </span>
          </div>

          <div className={classes.bar} aria-hidden="true">
            <div
              className={classes.barFill}
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>

          <ul className={classes.steps}>
            {steps.map((step) => (
              <li key={step.key}>
                <button type="button" className={classes.step} onClick={() => focusSection(step.key)}>
                  <span
                    className={`${classes.stepIcon} ${stepIcon[step.state].className}`}
                    aria-hidden="true"
                  >
                    {stepIcon[step.state].glyph}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={
                        step.state === "locked" || step.state === "optional"
                          ? classes.stepLabelMuted
                          : classes.stepLabel
                      }
                    >
                      {step.label}
                    </span>
                    <span className={classes.stepDetail}>{step.detail}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {nextStep ? (
            <div className={classes.next}>
              <span className={classes.nextText}>
                {t("profile.next")} <strong className="text-zinc-900">{nextStep.label}</strong> — {nextStep.detail}
              </span>
              <button
                type="button"
                className={classes.btnPrimary}
                onClick={() => focusSection(nextStep.key)}
              >
                {nextStep.actionLabel}
              </button>
            </div>
          ) : (
            isSettled && <p className={`${classes.allDone} xl:hidden`}>{t("profile.nothing")}</p>
          )}
        </aside>

        <div className={classes.sections}>
          <CollapsibleSection
            id="settings-profile"
            title={t("setup.profile")}
            summary={profileSummary}
            badge={<StepBadge step={stepByKey.profile} />}
            {...sectionFlags("profile")}
          >
            <div className={classes.avatarRow}>
              <div className={classes.avatar}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className={classes.avatarImage} />
                ) : (
                  <div className={classes.avatarFallback}>{t("profile.none")}</div>
                )}
              </div>
              <div className={classes.avatarText}>
                <div className={classes.avatarTitle}>{t("profile.imageTitle")}</div>
                {t("profile.imageText")}
              </div>
            </div>

            <div className={classes.grid}>
              <label className={classes.field}>
                <span className={classes.label}>{t("profile.handle")}</span>
                <KeptPlaceholder>
                <input
                  className={classes.input}
                  value={handle}
                  onChange={(event) => setHandle(event.currentTarget.value)}
                  placeholder={t("profile.handlePlaceholder")}
                  autoComplete="off"
                />
                </KeptPlaceholder>
                <span className={classes.fieldHelp}>{t("profile.handleHint")}</span>
              </label>

              <label className={classes.field}>
                <span className={classes.label}>{t("profile.displayName")}</span>
                <KeptPlaceholder>
                <input
                  className={classes.input}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.currentTarget.value)}
                  placeholder={t("profile.displayNamePlaceholder")}
                  autoComplete="name"
                />
                </KeptPlaceholder>
                <span className={classes.fieldHelp}>{t("profile.displayNameHint")}</span>
              </label>

              <label className={classes.fieldWide}>
                <span className={classes.label}>{t("profile.bio")}</span>
                <KeptPlaceholder>
                <textarea
                  className={classes.textarea}
                  rows={3}
                  value={bio}
                  onChange={(event) => setBio(event.currentTarget.value)}
                  placeholder={t("profile.bioPlaceholder")}
                />
                </KeptPlaceholder>
              </label>
            </div>

            <div className={classes.footer}>
              {savedAt && (
                <FadeIn key={savedAt} className={classes.saved}>
                  {t("profile.saved")}
                </FadeIn>
              )}
              <button
                className={classes.btnPrimary}
                type="button"
                onClick={() => void onSave()}
                disabled={busy || isLoading}
              >
                {t(busy ? "listingForm.saving" : "profile.save")}
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="settings-connections"
            title={t("setup.connections")}
            summary={platformSummary}
            badge={<StepBadge step={stepByKey.connections} />}
            {...sectionFlags("connections")}
          >
            <p className={classes.statusText}>
              {t("profile.connectionsText")}
            </p>

            <div className={classes.rows}>
              <div className={classes.row}>
                <span className={`${classes.rowBadge} ${classes.twitch}`} aria-hidden="true">
                  Tw
                </span>
                <div className={classes.rowMain}>
                  <div className={classes.rowTitle}>Twitch</div>
                  <div className={classes.rowSub}>
                    {isTwitchConnected ? (
                      <>
                        {twitchAccount?.platform_login
                          ? t("profile.connectedAs", { login: twitchAccount.platform_login })
                          : t("profile.connected")}
                        {twitchAccount?.profile_url && (
                          <>
                            {" · "}
                            <a
                              href={twitchAccount.profile_url}
                              target="_blank"
                              rel="noreferrer"
                              className={classes.rowLink}
                            >
                              {t("profile.viewChannel")}
                            </a>
                          </>
                        )}
                      </>
                    ) : (
                      t("profile.twitchText")
                    )}
                  </div>
                </div>
                <button
                  className={isTwitchConnected ? classes.btn : classes.btnPrimary}
                  type="button"
                  onClick={() => void onConnectTwitch()}
                  disabled={busy || isLoading || isLoadingPlatforms || isTwitchConnected}
                >
                  {t(isLoadingPlatforms ? "dashboard.checking" : isTwitchConnected ? "profile.connected" : "setup.connect")}
                </button>
              </div>

              <div className={classes.row}>
                <span className={`${classes.rowBadge} ${classes.youtube}`} aria-hidden="true">
                  YT
                </span>
                <div className={classes.rowMain}>
                  <div className={classes.rowTitle}>YouTube</div>
                  <div className={classes.rowSub}>
                    {youtubeAccount?.platform_login
                      ? t("profile.connectedAs", { login: youtubeAccount.platform_login })
                      : t("profile.youtubeText")}
                  </div>
                </div>
                <span className={classes.soon}>{t("profile.soon")}</span>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="settings-creator"
            title={t("setup.creator")}
            summary={creatorStatusLabel}
            badge={<StepBadge step={stepByKey.creator} />}
            {...sectionFlags("creator")}
          >
            <div className={classes.statusRow}>
              <p className={classes.statusText}>
                {t("chat.statusLabel")} <span className={classes.statusStrong}>{creatorStatusLabel}</span>
                {sellerApplication?.reviewer_notes && ` · ${t("profile.notesOnPage")}`}
              </p>
              <Link className={classes.btnPrimary} to="/apply/creator">
                {creatorApplicationCtaLabel}
              </Link>
            </div>

            {!canStartApplication && !sellerApplication && (
              <p className={classes.fieldHelp}>
                {t("profile.startHint")}
              </p>
            )}

            <ul className={classes.checklist} aria-label={t("profile.requirements")}>
              {creatorRequirements.map((requirement, index) => {
                const met =
                  isCreatorApproved ||
                  (index === 0 && profileReady) ||
                  (index === 1 && hasLinkedCreatorPlatform);

                return (
                  <li key={requirement} className={classes.check}>
                    <span
                      className={`${classes.checkMark} ${met ? classes.checkDone : classes.checkTodo}`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span>
                      {t(requirement)}
                      {met && <span className="sr-only"> {t("profile.doneHidden")}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className={classes.pills}>
              <span className={classes.pill}>{t("profile.pillHuman")}</span>
              <span className={classes.pill}>{t("profile.pillReview")}</span>
              <span className={classes.pill}>{t("profile.pillNoInstant")}</span>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="settings-payouts"
            title={t("setup.payouts")}
            summary={payoutSummary}
            badge={<StepBadge step={stepByKey.payouts} />}
            {...sectionFlags("payouts")}
          >
            <CreatorPayoutSettings isCreatorApproved={isCreatorApproved} />
          </CollapsibleSection>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
