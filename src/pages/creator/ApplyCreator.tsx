import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../providers/AuthProvider";
import { useSellerAccess } from "../../hooks/creatorApplication/useSellerAccess";
import { useUpsertMySellerApplication } from "../../hooks/creatorApplication/useUpsertMySellerApplication";
import { useCreatorApplicationQueueState } from "../../hooks/creatorApplication/useCreatorApplicationQueueState";
import {
  useSellerApplicationSampleMutations,
  useSellerApplicationSamples,
  useSubmitSellerApplication,
} from "../../hooks/creatorApplication/useSellerApplicationSamples";
import {
  MAX_WORK_SAMPLES,
  MIN_WORK_SAMPLES,
  getCreatorApplicationPhase,
  getCreatorApplicationRequirements,
  getCreatorApplicationStatusLabel,
  getFirstApplicationBlocker,
  getUrlValidationError,
  getWorkSampleCounts,
  isRequiredRecentUploadSample,
  isValidPublicUrl,
  normaliseUrlInput,
  type CreatorApplicationRequirementKey,
} from "../../domain/creatorApplication/creatorApplication";
import CollapsibleSection from "../../components/ui/CollapsibleSection";
import StatusHeader, { type StatusHeaderStage } from "../../components/ui/StatusHeader";
import { FadeIn } from "../../lib/motion";
import KeptPlaceholder from "../../components/ui/KeptPlaceholder";

type SectionKey = "basics" | "recent" | "samples" | "agreements";

type AgreementKey = "terms" | "originalWork" | "manualReview" | "ageAndCapacity";

const classes = {
  page: "space-y-4",
  layout: "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]",
  sections: "card min-w-0 divide-y divide-[var(--hairline)] overflow-hidden hover:shadow-[var(--shadow-md)]",
  card: "card space-y-3 p-4 hover:shadow-[var(--shadow-md)] sm:p-5",
  cardTitle: "font-display text-base font-bold tracking-tight text-zinc-900",
  text: "text-sm text-zinc-600",
  small: "text-xs text-zinc-500",
  actions: "flex flex-wrap items-center gap-2",

  noticeOk: "notice noticeSuccess",
  noticeErr: "notice noticeError",
  noticeWarn: "notice noticeWarning",

  // Rows
  rows: "divide-y divide-[var(--hairline)] rounded-xl border border-[var(--hairline)]",
  row: "flex items-center gap-3 px-3 py-2.5",
  rowMain: "min-w-0 flex-1",
  rowTitle: "truncate text-sm font-semibold text-zinc-900",
  rowSub: "truncate text-xs text-zinc-500",
  rowLink: "font-medium text-[rgb(var(--accent-text))] hover:underline",
  mark: "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
  markDone: "bg-emerald-100 text-emerald-700",
  markTodo: "border border-[rgb(var(--brand))] text-[rgb(var(--brand))]",

  // Forms
  inline: "flex flex-col gap-2 sm:flex-row sm:items-start",
  grid: "grid gap-3 sm:grid-cols-2",
  field: "flex min-w-0 flex-1 flex-col gap-1.5",
  fieldWide: "flex flex-col gap-1.5 sm:col-span-2",
  label: "formLabel",
  input: "formControl",
  textarea: "formControl min-h-[72px]",
  fieldError: "text-xs text-rose-700",
  btnPrimary: "btnPrimary btnSm shrink-0",
  btnOutline: "btnOutline btnSm shrink-0",
  btnRemove:
    "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50",
  addForm: "space-y-3 rounded-xl border border-dashed border-[var(--hairline-strong)] p-3",
  addTitle: "text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500",
  addFooter: "flex flex-wrap items-center justify-between gap-2",

  // Agreements
  checks: "space-y-1",
  check: "flex items-start gap-3 rounded-xl px-2 py-2 text-sm text-zinc-700 transition hover:bg-[rgb(var(--ink)/0.03)]",
  checkbox: "mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 accent-[rgb(var(--brand))]",
  inlineLink: "font-semibold text-[rgb(var(--accent-text))] underline underline-offset-2 hover:opacity-80",

  // Badges
  badge: "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
  badgeDone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  badgeMuted: "border-zinc-200 bg-zinc-100 text-zinc-600",

  // Submit panel
  aside: "card space-y-3 p-4 hover:shadow-[var(--shadow-md)] lg:sticky lg:top-24",
  asideHead: "flex items-center justify-between gap-3",
  asideTitle: "font-display text-sm font-bold text-zinc-900",
  asideCount: "text-xs font-medium text-zinc-500",
  bar: "h-1.5 overflow-hidden rounded-full bg-zinc-200",
  barFill: "h-full rounded-full bg-gradient-to-r from-[rgb(var(--accent))] to-[rgb(var(--brand))] transition-[width] duration-500",
  reqs: "space-y-1.5",
  req: "flex items-start gap-2 text-xs",
  reqDone: "text-zinc-600",
  reqTodo: "font-medium text-zinc-900",
  queue: "rounded-xl bg-[rgb(var(--ink)/0.04)] px-3 py-2 text-xs text-zinc-600",
  queueBlocked: "rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700",
  submit: "btnPrimary w-full justify-center",
  blocker: "text-center text-xs text-zinc-500",

  // Phase cards
  intro: "card space-y-4 p-4 hover:shadow-[var(--shadow-md)] sm:p-5",
  introList: "grid gap-2 sm:grid-cols-2",
} as const;

const agreementCopy: Record<AgreementKey, ReactNode> = {
  terms: (
    <>
      I have read, understood, and agree to the{" "}
      <Link className={classes.inlineLink} to="/terms/creator" target="_blank" rel="noreferrer">
        Creator Terms
      </Link>
      .
    </>
  ),
  originalWork:
    "My samples are my own work, or work I have the clear right to showcase.",
  manualReview:
    "Creator access is reviewed manually and may be approved, rejected, paused, suspended, or sent back for changes.",
  ageAndCapacity:
    "I am at least 18 (or the higher age of majority where I live) and legally able to enter a binding agreement.",
};

const requirementSection: Record<CreatorApplicationRequirementKey, SectionKey> = {
  profile: "basics",
  platform: "basics",
  recentUpload: "recent",
  samples: "samples",
  agreements: "agreements",
};

const getErrorMessage = (error: unknown): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : "Something went wrong.";

const hostOf = (url: string | null | undefined) => {
  try {
    return url ? new URL(url).host.replace(/^www\./, "") : "";
  } catch {
    return url ?? "";
  }
};

const Mark = ({ done }: { done: boolean }) => (
  <span className={`${classes.mark} ${done ? classes.markDone : classes.markTodo}`} aria-hidden="true">
    {done ? "✓" : "•"}
  </span>
);

const DoneBadge = ({ done, todo }: { done: boolean; todo?: string }) =>
  done ? (
    <span className={`${classes.badge} ${classes.badgeDone}`}>Done</span>
  ) : todo ? (
    <span className={`${classes.badge} ${classes.badgeMuted}`}>{todo}</span>
  ) : null;

const ApplyCreator = () => {
  const { user, loading } = useAuth();

  const {
    isLoading: isAccessLoading,
    profileReady,
    hasLinkedCreatorPlatform,
    sellerApplication,
    canStartApplication,
    canEditApplication,
    canSubmitApplication,
    error: sellerAccessError,
  } = useSellerAccess();

  const upsertApplication = useUpsertMySellerApplication();
  const { data: queueState, isLoading: isQueueLoading, error: queueError } =
    useCreatorApplicationQueueState();

  const applicationId = sellerApplication?.id ?? null;
  const phase = getCreatorApplicationPhase(sellerApplication?.status);

  const { data: samples = [], isLoading: isSamplesLoading, error: samplesError } =
    useSellerApplicationSamples(applicationId);
  const { addLinkSample, saveRecentUploadLink, removeSample } =
    useSellerApplicationSampleMutations(applicationId);
  const submitApplication = useSubmitSellerApplication(user?.id ?? null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [recentUploadUrl, setRecentUploadUrl] = useState("");
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ key: SectionKey; nonce: number } | null>(null);
  const [agreements, setAgreements] = useState<Record<AgreementKey, boolean>>({
    terms: false,
    originalWork: false,
    manualReview: false,
    ageAndCapacity: false,
  });

  useEffect(() => {
    setAgreements({
      terms: Boolean(sellerApplication?.agreed_to_terms),
      originalWork: Boolean(sellerApplication?.agreed_to_original_work),
      manualReview: Boolean(sellerApplication?.agreed_to_manual_review),
      ageAndCapacity: Boolean(sellerApplication?.agreed_to_age_and_capacity),
    });
  }, [
    sellerApplication?.agreed_to_terms,
    sellerApplication?.agreed_to_original_work,
    sellerApplication?.agreed_to_manual_review,
    sellerApplication?.agreed_to_age_and_capacity,
  ]);

  const recentUploadSample = useMemo(
    () => samples.find(isRequiredRecentUploadSample) ?? null,
    [samples]
  );
  const otherSamples = samples.filter((sample) => sample !== recentUploadSample);

  useEffect(() => {
    setRecentUploadUrl(recentUploadSample?.url ?? "");
  }, [recentUploadSample]);

  const acceptedCount = Object.values(agreements).filter(Boolean).length;
  const agreementsAccepted = acceptedCount === 4;
  const counts = getWorkSampleCounts(samples);
  const isQueueFull = Boolean(queueState?.isFull);
  const canEdit = phase === "editing" && canEditApplication;

  const requirements = getCreatorApplicationRequirements({
    profileReady,
    hasLinkedPlatform: hasLinkedCreatorPlatform,
    samples,
    agreementsAccepted,
  });
  const blocker = getFirstApplicationBlocker(requirements);
  const doneCount = requirements.filter((item) => item.done).length;
  const attentionSection = phase === "editing" && blocker ? requirementSection[blocker.key] : null;

  const canSubmit =
    canEdit &&
    canSubmitApplication &&
    !blocker &&
    !isQueueFull &&
    !isQueueLoading &&
    Boolean(applicationId) &&
    !submitApplication.isPending;

  const loadError = [sellerAccessError, samplesError, queueError]
    .filter(Boolean)
    .map(getErrorMessage)
    .join(" ");

  const sectionFlags = (key: SectionKey) => ({
    attention: attentionSection === key,
    focusKey: focus?.key === key ? focus.nonce : null,
  });

  const focusSection = (key: SectionKey) =>
    setFocus((current) => ({ key, nonce: (current?.nonce ?? 0) + 1 }));

  const resetMessages = () => {
    setOkMsg(null);
    setErrMsg(null);
  };

  const agreementPayload = {
    agreed_to_terms: agreements.terms,
    agreed_to_original_work: agreements.originalWork,
    agreed_to_manual_review: agreements.manualReview,
    agreed_to_age_and_capacity: agreements.ageAndCapacity,
  };

  const onStartDraft = async () => {
    resetMessages();

    if (!canStartApplication) {
      setErrMsg("Add a display name and handle in settings before starting your application.");
      return;
    }

    try {
      await upsertApplication.mutateAsync({ status: "draft", ...agreementPayload });
      setOkMsg("Application started. Add your samples below.");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  const onSaveRecentUpload = async () => {
    resetMessages();
    const nextUrl = normaliseUrlInput(recentUploadUrl);

    if (!applicationId || !canEdit) return;

    if (!recentUploadSample && counts.total >= MAX_WORK_SAMPLES) {
      setErrMsg(`You can add a maximum of ${MAX_WORK_SAMPLES} work samples.`);
      return;
    }

    if (!isValidPublicUrl(nextUrl)) {
      setErrMsg("Add a valid public link to your most recent upload or VOD.");
      return;
    }

    try {
      await saveRecentUploadLink.mutateAsync({
        applicationId,
        sampleId: recentUploadSample?.id,
        url: nextUrl,
        sortOrder: counts.total,
      });
      setRecentUploadUrl(nextUrl);
      setOkMsg("Most recent upload saved.");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  const onAddSample = async () => {
    resetMessages();
    const nextTitle = title.trim();
    const nextUrl = normaliseUrlInput(url);

    if (!applicationId || !canEdit) return;

    if (counts.total >= MAX_WORK_SAMPLES) {
      setErrMsg(`You can add a maximum of ${MAX_WORK_SAMPLES} work samples.`);
      return;
    }

    if (!nextTitle) {
      setErrMsg("Give the sample a title.");
      return;
    }

    if (!isValidPublicUrl(nextUrl)) {
      setErrMsg("Add a valid public link for the sample.");
      return;
    }

    try {
      await addLinkSample.mutateAsync({
        applicationId,
        title: nextTitle,
        description: description.trim(),
        url: nextUrl,
        sortOrder: counts.total,
      });
      setTitle("");
      setDescription("");
      setUrl("");
      setOkMsg("Work sample added.");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  const onRemoveSample = async (sampleId: string) => {
    resetMessages();

    try {
      await removeSample.mutateAsync(sampleId);
      setOkMsg("Work sample removed.");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  const onSubmit = async () => {
    resetMessages();

    if (!applicationId || !canSubmit) {
      setErrMsg(blocker?.blocker ?? "This application can't be submitted right now.");
      return;
    }

    try {
      // Agreements are stored with the application, so save them before submitting.
      await upsertApplication.mutateAsync({
        id: applicationId,
        status: sellerApplication?.status === "needs_changes" ? "needs_changes" : "draft",
        ...agreementPayload,
      });
      await submitApplication.mutateAsync({
        applicationId,
        sampleCount: counts.total,
        videoCount: counts.videos,
      });
      setOkMsg("Application submitted. We'll let you know once it has been reviewed.");
    } catch (error) {
      setErrMsg(getErrorMessage(error));
    }
  };

  if (!loading && !user) {
    return (
      <div className={classes.card}>
        <div className={classes.cardTitle}>You’re not signed in</div>
        <p className={classes.text}>Sign in to start or manage your creator application.</p>
        <div className={classes.actions}>
          <Link className={classes.btnPrimary} to="/signin">
            Sign in
          </Link>
          <Link className={classes.btnOutline} to="/">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  const basicsDone = profileReady && hasLinkedCreatorPlatform;

  const stages: StatusHeaderStage[] = (() => {
    const inReviewOrLater = phase === "in_review" || phase === "approved";
    const steps = [
      { key: "basics", label: "Account basics", done: basicsDone || inReviewOrLater },
      { key: "samples", label: "Work samples", done: requirements.slice(2, 4).every((item) => item.done) || inReviewOrLater },
      { key: "agreements", label: "Agreements", done: agreementsAccepted || inReviewOrLater },
      {
        key: "review",
        label: phase === "approved" ? "Approved" : phase === "in_review" ? "In review" : "Submit",
        done: phase === "approved",
      },
    ];
    const currentIndex =
      phase === "in_review" ? 3 : phase === "approved" ? -1 : steps.findIndex((step) => !step.done);

    return steps.map((step, index) => ({
      key: step.key,
      label: step.label,
      state: step.done ? "done" : index === currentIndex ? "current" : "upcoming",
    }));
  })();

  const reviewNote = sellerApplication?.rejection_reason || sellerApplication?.reviewer_notes;

  const header = (
    <StatusHeader
      backTo="/settings/profile"
      backLabel="Back to settings"
      eyebrow="Creator application"
      title="Apply to sell on Made for Stream"
      meta={[
        <span key="review">Manually reviewed</span>,
        <span key="human">Human-made work only</span>,
        <span key="samples">
          {MIN_WORK_SAMPLES}–{MAX_WORK_SAMPLES} samples
        </span>,
      ]}
      statusLabel={getCreatorApplicationStatusLabel(sellerApplication?.status)}
      statusTone={
        phase === "approved"
          ? "success"
          : phase === "closed"
            ? "danger"
            : phase === "in_review" || sellerApplication?.status === "needs_changes"
              ? "review"
              : "muted"
      }
      stages={phase === "closed" ? [] : stages}
      notice={
        reviewNote && phase !== "approved" ? (
          <div className={phase === "closed" ? classes.noticeErr : classes.noticeWarn}>
            <strong>
              {sellerApplication?.rejection_reason ? "Reason: " : "Reviewer notes: "}
            </strong>
            {reviewNote}
          </div>
        ) : undefined
      }
    />
  );

  const messages = (
    <>
      {okMsg && <FadeIn className={classes.noticeOk}>{okMsg}</FadeIn>}
      {(errMsg || loadError) && <FadeIn className={classes.noticeErr}>{errMsg || loadError}</FadeIn>}
    </>
  );

  const sampleRows = (editable: boolean) =>
    samples.length > 0 ? (
      <ul className={classes.rows}>
        {[...(recentUploadSample ? [recentUploadSample] : []), ...otherSamples].map((sample) => {
          const isRequired = sample === recentUploadSample;

          return (
            <li key={sample.id} className={classes.row}>
              <div className={classes.rowMain}>
                <div className={classes.rowTitle}>{sample.title}</div>
                <div className={classes.rowSub}>
                  {isRequired ? "Required link sample" : `${sample.sample_type} sample`}
                  {sample.url && (
                    <>
                      {" · "}
                      <a className={classes.rowLink} href={sample.url} target="_blank" rel="noreferrer">
                        {hostOf(sample.url)}
                      </a>
                    </>
                  )}
                  {sample.description && !isRequired && ` · ${sample.description}`}
                </div>
              </div>
              {editable && !isRequired && (
                <button
                  type="button"
                  className={classes.btnRemove}
                  onClick={() => void onRemoveSample(sample.id)}
                  disabled={removeSample.isPending}
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>
    ) : (
      <p className={classes.small}>No samples added yet.</p>
    );

  if (phase === "not_started") {
    return (
      <div className={classes.page}>
        {header}
        {messages}

        <section className={classes.intro} aria-label="Before you start">
          <div>
            <h2 className={classes.cardTitle}>What you’ll need</h2>
            <p className={classes.text}>
              Applications are reviewed by the Made for Stream team to keep the marketplace human-made and trustworthy.
            </p>
          </div>

          <ul className={classes.introList}>
            {[
              { done: profileReady, label: "A handle and display name" },
              { done: hasLinkedCreatorPlatform, label: "A linked Twitch or YouTube account" },
              { done: false, label: "A link to your most recent upload or VOD" },
              { done: false, label: `${MIN_WORK_SAMPLES}–${MAX_WORK_SAMPLES} links to your work` },
            ].map((item) => (
              <li key={item.label} className={classes.req}>
                <Mark done={item.done} />
                <span className={item.done ? classes.reqDone : classes.reqTodo}>{item.label}</span>
              </li>
            ))}
          </ul>

          <div className={classes.actions}>
            <button
              className={classes.btnPrimary}
              type="button"
              onClick={() => void onStartDraft()}
              disabled={upsertApplication.isPending || !canStartApplication}
            >
              {upsertApplication.isPending ? "Starting…" : "Start application"}
            </button>
            {!canStartApplication && (
              <Link className={classes.btnOutline} to="/settings/profile">
                Finish your profile first
              </Link>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (phase !== "editing") {
    return (
      <div className={classes.page}>
        {header}
        {messages}

        <section className={classes.card} aria-label="Application status">
          {phase === "approved" ? (
            <>
              <h2 className={classes.cardTitle}>You’re an approved creator</h2>
              <p className={classes.text}>
                Set up payouts, then publish your first listing.
              </p>
              <div className={classes.actions}>
                <Link className={classes.btnPrimary} to="/creator/listings/new">
                  Create a listing
                </Link>
                <Link className={classes.btnOutline} to="/creator/dashboard">
                  Creator dashboard
                </Link>
                <Link className={classes.btnOutline} to="/settings/profile">
                  Payout settings
                </Link>
              </div>
            </>
          ) : phase === "in_review" ? (
            <>
              <h2 className={classes.cardTitle}>Your application is with our reviewers</h2>
              <p className={classes.text}>
                There’s nothing more to do right now. We’ll update your status here and in settings once it has been reviewed.
              </p>
            </>
          ) : (
            <>
              <h2 className={classes.cardTitle}>
                {sellerApplication?.status === "suspended"
                  ? "Creator access is suspended"
                  : "This application wasn’t approved"}
              </h2>
              <p className={classes.text}>
                The application is closed and can’t be edited. Contact support if you think this is a mistake.
              </p>
            </>
          )}
        </section>

        {phase !== "approved" && (
          <div className={classes.sections}>
            <CollapsibleSection
              title="Submitted samples"
              summary={`${counts.total} sample${counts.total === 1 ? "" : "s"}`}
            >
              {sampleRows(false)}
            </CollapsibleSection>
          </div>
        )}
      </div>
    );
  }

  const recentUrlError = getUrlValidationError(recentUploadUrl);
  const sampleUrlError = getUrlValidationError(url);
  const atMax = counts.total >= MAX_WORK_SAMPLES;

  return (
    <div className={classes.page}>
      {header}
      {messages}

      <div className={classes.layout}>
        <div className={classes.sections}>
          <CollapsibleSection
            id="application-basics"
            title="Account basics"
            summary={basicsDone ? "Profile and platform ready" : "Finish these in settings"}
            badge={<DoneBadge done={basicsDone} />}
            {...sectionFlags("basics")}
          >
            <ul className={classes.rows}>
              <li className={classes.row}>
                <Mark done={profileReady} />
                <div className={classes.rowMain}>
                  <div className={classes.rowTitle}>Handle and display name</div>
                  <div className={classes.rowSub}>Shown on your public creator profile</div>
                </div>
              </li>
              <li className={classes.row}>
                <Mark done={hasLinkedCreatorPlatform} />
                <div className={classes.rowMain}>
                  <div className={classes.rowTitle}>Linked creator platform</div>
                  <div className={classes.rowSub}>Twitch or YouTube, so reviewers can see your channel</div>
                </div>
              </li>
            </ul>
            {!basicsDone && (
              <Link className={classes.btnOutline} to="/settings/profile">
                Open settings
              </Link>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            id="application-recent"
            title="Most recent upload"
            summary={
              recentUploadSample?.url ? hostOf(recentUploadSample.url) : "Required — a VOD or upload from the last 30 days"
            }
            badge={<DoneBadge done={counts.hasRecentUpload} todo="Required" />}
            {...sectionFlags("recent")}
          >
            <div className={classes.inline}>
              <label className={classes.field}>
                <span className="sr-only">Most recent upload link</span>
                <KeptPlaceholder>
                <input
                  className={classes.input}
                  value={recentUploadUrl}
                  onChange={(event) => setRecentUploadUrl(event.currentTarget.value)}
                  onBlur={() => setRecentUploadUrl((value) => normaliseUrlInput(value))}
                  placeholder="twitch.tv/videos/… or youtube.com/watch?v=…"
                  disabled={!canEdit}
                />
                </KeptPlaceholder>
                {recentUrlError ? (
                  <span className={classes.fieldError}>{recentUrlError}</span>
                ) : (
                  <span className={classes.small}>Counts as one of your {MIN_WORK_SAMPLES} required samples.</span>
                )}
              </label>
              <button
                className={classes.btnPrimary}
                type="button"
                onClick={() => void onSaveRecentUpload()}
                disabled={
                  !canEdit ||
                  saveRecentUploadLink.isPending ||
                  !recentUploadUrl.trim() ||
                  Boolean(recentUrlError) ||
                  (!recentUploadSample && atMax)
                }
              >
                {saveRecentUploadLink.isPending ? "Saving…" : recentUploadSample ? "Update" : "Save link"}
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="application-samples"
            title="Work samples"
            summary={`${counts.total} added · ${MIN_WORK_SAMPLES} minimum, ${MAX_WORK_SAMPLES} maximum`}
            badge={<DoneBadge done={requirements[3].done} />}
            {...sectionFlags("samples")}
          >
            {sampleRows(canEdit)}

            {canEdit && !atMax && (
              <div className={classes.addForm}>
                <div className={classes.addTitle}>Add a sample</div>
                <div className={classes.grid}>
                  <label className={classes.field}>
                    <span className={classes.label}>Title</span>
                    <KeptPlaceholder>
                    <input
                      className={classes.input}
                      value={title}
                      onChange={(event) => setTitle(event.currentTarget.value)}
                      placeholder="Emote portfolio, VOD edit reel…"
                    />
                    </KeptPlaceholder>
                  </label>
                  <label className={classes.field}>
                    <span className={classes.label}>Link</span>
                    <KeptPlaceholder>
                    <input
                      className={classes.input}
                      value={url}
                      onChange={(event) => setUrl(event.currentTarget.value)}
                      onBlur={() => setUrl((value) => normaliseUrlInput(value))}
                      placeholder="Portfolio, drive folder or showcase"
                    />
                    </KeptPlaceholder>
                    {sampleUrlError && <span className={classes.fieldError}>{sampleUrlError}</span>}
                  </label>
                  <label className={classes.fieldWide}>
                    <span className={classes.label}>What it shows (optional)</span>
                    <KeptPlaceholder>
                    <textarea
                      className={classes.textarea}
                      rows={2}
                      value={description}
                      onChange={(event) => setDescription(event.currentTarget.value)}
                      placeholder="Your role and any useful context."
                    />
                    </KeptPlaceholder>
                  </label>
                </div>
                <div className={classes.addFooter}>
                  <span className={classes.small}>Links only for now — image and video uploads are coming soon.</span>
                  <button
                    className={classes.btnPrimary}
                    type="button"
                    onClick={() => void onAddSample()}
                    disabled={
                      addLinkSample.isPending || !title.trim() || !url.trim() || Boolean(sampleUrlError)
                    }
                  >
                    {addLinkSample.isPending ? "Adding…" : "Add sample"}
                  </button>
                </div>
              </div>
            )}

            {canEdit && atMax && (
              <p className={classes.small}>You’ve reached the {MAX_WORK_SAMPLES}-sample limit.</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            id="application-agreements"
            title="Agreements"
            summary={agreementsAccepted ? "All accepted" : `${acceptedCount} of 4 accepted · saved when you submit`}
            badge={<DoneBadge done={agreementsAccepted} />}
            {...sectionFlags("agreements")}
          >
            <div className={classes.checks}>
              {(Object.keys(agreementCopy) as AgreementKey[]).map((key) => (
                <label key={key} className={classes.check}>
                  <input
                    className={classes.checkbox}
                    type="checkbox"
                    checked={agreements[key]}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setAgreements((current) => ({ ...current, [key]: checked }));
                    }}
                    disabled={!canEdit}
                  />
                  <span>{agreementCopy[key]}</span>
                </label>
              ))}
            </div>
          </CollapsibleSection>
        </div>

        <aside className={classes.aside} aria-label="Submission checklist">
          <div className={classes.asideHead}>
            <span className={classes.asideTitle}>Ready to submit?</span>
            <span className={classes.asideCount}>
              {doneCount} of {requirements.length}
            </span>
          </div>

          <div className={classes.bar} aria-hidden="true">
            <div
              className={classes.barFill}
              style={{ width: `${(doneCount / requirements.length) * 100}%` }}
            />
          </div>

          <ul className={classes.reqs}>
            {requirements.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className={`${classes.req} w-full text-left`}
                  onClick={() => focusSection(requirementSection[item.key])}
                >
                  <Mark done={item.done} />
                  <span className={item.done ? classes.reqDone : classes.reqTodo}>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>

          <p className={isQueueFull ? classes.queueBlocked : classes.queue}>
            {!queueState
              ? "Checking reviewer availability…"
              : isQueueFull
                ? `Applications are paused (${queueState.openCount}/${queueState.maxOpen} in review). Please check again later.`
                : `${queueState.remaining} review slot${queueState.remaining === 1 ? "" : "s"} open`}
          </p>

          <button
            className={classes.submit}
            type="button"
            onClick={() => void onSubmit()}
            disabled={!canSubmit}
          >
            {submitApplication.isPending
              ? "Submitting…"
              : sellerApplication?.status === "needs_changes"
                ? "Re-submit for review"
                : "Submit for review"}
          </button>

          {blocker && <p className={classes.blocker}>{blocker.blocker}</p>}
        </aside>
      </div>

      {(isAccessLoading || isSamplesLoading) && <p className={classes.small}>Loading…</p>}
    </div>
  );
};

export default ApplyCreator;
