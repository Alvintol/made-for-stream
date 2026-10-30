import { useMemo, useState } from "react";
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
import { useT, type Translate } from "../../lib/i18n/i18n";
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

const agreementKeys: AgreementKey[] = ["terms", "originalWork", "manualReview", "ageAndCapacity"];

const AgreementCopy = ({ agreement }: { agreement: AgreementKey }) => {
  const t = useT();

  return agreement === "terms" ? (
    <>
      {t("apply.agreeTermsStart")}{" "}
      <Link className={classes.inlineLink} to="/terms/creator" target="_blank" rel="noreferrer">
        {t("apply.agreeTermsLink")}
      </Link>
      {t("apply.agreeTermsEnd")}
    </>
  ) : (
    <>
      {t(
        agreement === "originalWork"
          ? "apply.agreeOriginal"
          : agreement === "manualReview"
            ? "apply.agreeReview"
            : "apply.agreeAge"
      )}
    </>
  );
};
const requirementSection: Record<CreatorApplicationRequirementKey, SectionKey> = {
  profile: "basics",
  platform: "basics",
  recentUpload: "recent",
  samples: "samples",
  agreements: "agreements",
};

const getErrorMessage = (error: unknown, t: Translate): string =>
  error && typeof error === "object" && "message" in error
    ? String((error as { message: unknown }).message)
    : t("apply.failed");

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

const DoneBadge = ({ done, todo }: { done: boolean; todo?: string }) => {
  const t = useT();

  return done ? (
    <span className={`${classes.badge} ${classes.badgeDone}`}>{t("apply.done")}</span>
  ) : todo ? (
    <span className={`${classes.badge} ${classes.badgeMuted}`}>{todo}</span>
  ) : null;
};

const ApplyCreator = () => {
  const t = useT();
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

  // The saved answers load into the checkboxes whenever they change (while
  // rendering, not in an effect).
  const savedAgreements: Record<AgreementKey, boolean> = {
    terms: Boolean(sellerApplication?.agreed_to_terms),
    originalWork: Boolean(sellerApplication?.agreed_to_original_work),
    manualReview: Boolean(sellerApplication?.agreed_to_manual_review),
    ageAndCapacity: Boolean(sellerApplication?.agreed_to_age_and_capacity),
  };
  const savedAgreementsKey = JSON.stringify(savedAgreements);
  const [agreementsFor, setAgreementsFor] = useState<string | null>(null);
  if (savedAgreementsKey !== agreementsFor) {
    setAgreementsFor(savedAgreementsKey);
    setAgreements(savedAgreements);
  }

  const recentUploadSample = useMemo(
    () => samples.find(isRequiredRecentUploadSample) ?? null,
    [samples]
  );
  const otherSamples = samples.filter((sample) => sample !== recentUploadSample);

  const [recentUploadFor, setRecentUploadFor] = useState<typeof recentUploadSample | undefined>(
    undefined
  );
  if (recentUploadSample !== recentUploadFor) {
    setRecentUploadFor(recentUploadSample);
    setRecentUploadUrl(recentUploadSample?.url ?? "");
  }

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
  }, t);
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
    .map((error) => getErrorMessage(error, t))
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
      setErrMsg(t("apply.errorProfile"));
      return;
    }

    try {
      await upsertApplication.mutateAsync({ status: "draft", ...agreementPayload });
      setOkMsg(t("apply.started"));
    } catch (error) {
      setErrMsg(getErrorMessage(error, t));
    }
  };

  const onSaveRecentUpload = async () => {
    resetMessages();
    const nextUrl = normaliseUrlInput(recentUploadUrl);

    if (!applicationId || !canEdit) return;

    if (!recentUploadSample && counts.total >= MAX_WORK_SAMPLES) {
      setErrMsg(t("apply.errorMax", { count: MAX_WORK_SAMPLES }));
      return;
    }

    if (!isValidPublicUrl(nextUrl)) {
      setErrMsg(t("apply.errorRecentLink"));
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
      setOkMsg(t("apply.recentSaved"));
    } catch (error) {
      setErrMsg(getErrorMessage(error, t));
    }
  };

  const onAddSample = async () => {
    resetMessages();
    const nextTitle = title.trim();
    const nextUrl = normaliseUrlInput(url);

    if (!applicationId || !canEdit) return;

    if (counts.total >= MAX_WORK_SAMPLES) {
      setErrMsg(t("apply.errorMax", { count: MAX_WORK_SAMPLES }));
      return;
    }

    if (!nextTitle) {
      setErrMsg(t("apply.errorSampleTitle"));
      return;
    }

    if (!isValidPublicUrl(nextUrl)) {
      setErrMsg(t("apply.errorSampleLink"));
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
      setOkMsg(t("apply.sampleAdded"));
    } catch (error) {
      setErrMsg(getErrorMessage(error, t));
    }
  };

  const onRemoveSample = async (sampleId: string) => {
    resetMessages();

    try {
      await removeSample.mutateAsync(sampleId);
      setOkMsg(t("apply.sampleRemoved"));
    } catch (error) {
      setErrMsg(getErrorMessage(error, t));
    }
  };

  const onSubmit = async () => {
    resetMessages();

    if (!applicationId || !canSubmit) {
      setErrMsg(blocker?.blocker ?? t("apply.errorSubmit"));
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
      setOkMsg(t("apply.submitted"));
    } catch (error) {
      setErrMsg(getErrorMessage(error, t));
    }
  };

  if (!loading && !user) {
    return (
      <div className={classes.card}>
        <div className={classes.cardTitle}>{t("apply.signedOutTitle")}</div>
        <p className={classes.text}>{t("apply.signedOutText")}</p>
        <div className={classes.actions}>
          <Link className={classes.btnPrimary} to="/signin">
            {t("apply.signIn")}
          </Link>
          <Link className={classes.btnOutline} to="/">
            {t("apply.home")}
          </Link>
        </div>
      </div>
    );
  }

  const basicsDone = profileReady && hasLinkedCreatorPlatform;

  const stages: StatusHeaderStage[] = (() => {
    const inReviewOrLater = phase === "in_review" || phase === "approved";
    const steps = [
      { key: "basics", label: t("apply.stepBasics"), done: basicsDone || inReviewOrLater },
      { key: "samples", label: t("apply.stepSamples"), done: requirements.slice(2, 4).every((item) => item.done) || inReviewOrLater },
      { key: "agreements", label: t("apply.stepAgreements"), done: agreementsAccepted || inReviewOrLater },
      {
        key: "review",
        label: t(phase === "approved" ? "apply.stepApproved" : phase === "in_review" ? "stage.inReview" : "apply.stepSubmit"),
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
      backLabel={t("apply.back")}
      eyebrow={t("apply.eyebrow")}
      title={t("apply.title")}
      meta={[
        <span key="review">{t("apply.metaReview")}</span>,
        <span key="human">{t("apply.metaHuman")}</span>,
        <span key="samples">
          {t("apply.metaSamples", { min: MIN_WORK_SAMPLES, max: MAX_WORK_SAMPLES })}
        </span>,
      ]}
      statusLabel={getCreatorApplicationStatusLabel(sellerApplication?.status, t)}
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
              {t(sellerApplication?.rejection_reason ? "apply.reason" : "apply.reviewerNotes")}
            </strong>{" "}
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
                <div className={classes.rowTitle}>
                  {isRequired ? t("apply.recentSampleTitle") : sample.title}
                </div>
                <div className={classes.rowSub}>
                  {t(isRequired ? "apply.requiredSample" : `apply.sampleType.${sample.sample_type}`)}
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
                  {t("apply.remove")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    ) : (
      <p className={classes.small}>{t("apply.noSamples")}</p>
    );

  if (phase === "not_started") {
    return (
      <div className={classes.page}>
        {header}
        {messages}

        <section className={classes.intro} aria-label={t("apply.beforeStart")}>
          <div>
            <h2 className={classes.cardTitle}>{t("apply.needTitle")}</h2>
            <p className={classes.text}>{t("apply.needText")}</p>
          </div>

          <ul className={classes.introList}>
            {[
              { done: profileReady, label: t("apply.needHandle") },
              { done: hasLinkedCreatorPlatform, label: t("apply.needPlatform") },
              { done: false, label: t("apply.needRecent") },
              { done: false, label: t("apply.needLinks", { min: MIN_WORK_SAMPLES, max: MAX_WORK_SAMPLES }) },
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
              {t(upsertApplication.isPending ? "apply.starting" : "apply.start")}
            </button>
            {!canStartApplication && (
              <Link className={classes.btnOutline} to="/settings/profile">
                {t("apply.finishProfile")}
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

        <section className={classes.card} aria-label={t("apply.statusLabel")}>
          {phase === "approved" ? (
            <>
              <h2 className={classes.cardTitle}>{t("apply.approvedTitle")}</h2>
              <p className={classes.text}>{t("apply.approvedText")}</p>
              <div className={classes.actions}>
                <Link className={classes.btnPrimary} to="/creator/listings/new">
                  {t("apply.createListing")}
                </Link>
                <Link className={classes.btnOutline} to="/creator/dashboard">
                  {t("apply.dashboard")}
                </Link>
                <Link className={classes.btnOutline} to="/settings/profile">
                  {t("apply.payouts")}
                </Link>
              </div>
            </>
          ) : phase === "in_review" ? (
            <>
              <h2 className={classes.cardTitle}>{t("apply.reviewTitle")}</h2>
              <p className={classes.text}>{t("apply.reviewText")}</p>
            </>
          ) : (
            <>
              <h2 className={classes.cardTitle}>
                {t(sellerApplication?.status === "suspended" ? "apply.suspendedTitle" : "apply.rejectedTitle")}
              </h2>
              <p className={classes.text}>{t("apply.closedText")}</p>
            </>
          )}
        </section>

        {phase !== "approved" && (
          <div className={classes.sections}>
            <CollapsibleSection
              title={t("apply.submittedSamples")}
              summary={t("apply.sampleCount", { count: counts.total })}
            >
              {sampleRows(false)}
            </CollapsibleSection>
          </div>
        )}
      </div>
    );
  }

  const recentUrlError = getUrlValidationError(recentUploadUrl, t);
  const sampleUrlError = getUrlValidationError(url, t);
  const atMax = counts.total >= MAX_WORK_SAMPLES;

  return (
    <div className={classes.page}>
      {header}
      {messages}

      <div className={classes.layout}>
        <div className={classes.sections}>
          <CollapsibleSection
            id="application-basics"
            title={t("apply.stepBasics")}
            summary={t(basicsDone ? "apply.basicsReady" : "apply.basicsTodo")}
            badge={<DoneBadge done={basicsDone} />}
            {...sectionFlags("basics")}
          >
            <ul className={classes.rows}>
              <li className={classes.row}>
                <Mark done={profileReady} />
                <div className={classes.rowMain}>
                  <div className={classes.rowTitle}>{t("apply.rowHandle")}</div>
                  <div className={classes.rowSub}>{t("apply.rowHandleSub")}</div>
                </div>
              </li>
              <li className={classes.row}>
                <Mark done={hasLinkedCreatorPlatform} />
                <div className={classes.rowMain}>
                  <div className={classes.rowTitle}>{t("apply.rowPlatform")}</div>
                  <div className={classes.rowSub}>{t("apply.rowPlatformSub")}</div>
                </div>
              </li>
            </ul>
            {!basicsDone && (
              <Link className={classes.btnOutline} to="/settings/profile">
                {t("apply.openSettings")}
              </Link>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            id="application-recent"
            title={t("apply.recentTitle")}
            summary={
              recentUploadSample?.url ? hostOf(recentUploadSample.url) : t("apply.recentRequired")
            }
            badge={<DoneBadge done={counts.hasRecentUpload} todo={t("apply.required")} />}
            {...sectionFlags("recent")}
          >
            <div className={classes.inline}>
              <label className={classes.field}>
                <span className="sr-only">{t("apply.recentLink")}</span>
                <KeptPlaceholder>
                <input
                  className={classes.input}
                  value={recentUploadUrl}
                  onChange={(event) => setRecentUploadUrl(event.currentTarget.value)}
                  onBlur={() => setRecentUploadUrl((value) => normaliseUrlInput(value))}
                  placeholder={t("apply.recentPlaceholder")}
                  disabled={!canEdit}
                />
                </KeptPlaceholder>
                {recentUrlError ? (
                  <span className={classes.fieldError}>{recentUrlError}</span>
                ) : (
                  <span className={classes.small}>{t("apply.recentHint", { min: MIN_WORK_SAMPLES })}</span>
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
                {t(saveRecentUploadLink.isPending ? "listingForm.saving" : recentUploadSample ? "apply.update" : "apply.saveLink")}
              </button>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="application-samples"
            title={t("apply.stepSamples")}
            summary={t("apply.samplesSummary", { count: counts.total, min: MIN_WORK_SAMPLES, max: MAX_WORK_SAMPLES })}
            badge={<DoneBadge done={requirements[3].done} />}
            {...sectionFlags("samples")}
          >
            {sampleRows(canEdit)}

            {canEdit && !atMax && (
              <div className={classes.addForm}>
                <div className={classes.addTitle}>{t("apply.addSampleTitle")}</div>
                <div className={classes.grid}>
                  <label className={classes.field}>
                    <span className={classes.label}>{t("listingForm.titleLabel")}</span>
                    <KeptPlaceholder>
                    <input
                      className={classes.input}
                      value={title}
                      onChange={(event) => setTitle(event.currentTarget.value)}
                      placeholder={t("apply.samplePlaceholder")}
                    />
                    </KeptPlaceholder>
                  </label>
                  <label className={classes.field}>
                    <span className={classes.label}>{t("listingForm.link")}</span>
                    <KeptPlaceholder>
                    <input
                      className={classes.input}
                      value={url}
                      onChange={(event) => setUrl(event.currentTarget.value)}
                      onBlur={() => setUrl((value) => normaliseUrlInput(value))}
                      placeholder={t("apply.linkPlaceholder")}
                    />
                    </KeptPlaceholder>
                    {sampleUrlError && <span className={classes.fieldError}>{sampleUrlError}</span>}
                  </label>
                  <label className={classes.fieldWide}>
                    <span className={classes.label}>{t("apply.shows")}</span>
                    <KeptPlaceholder>
                    <textarea
                      className={classes.textarea}
                      rows={2}
                      value={description}
                      onChange={(event) => setDescription(event.currentTarget.value)}
                      placeholder={t("apply.showsPlaceholder")}
                    />
                    </KeptPlaceholder>
                  </label>
                </div>
                <div className={classes.addFooter}>
                  <span className={classes.small}>{t("apply.linksOnly")}</span>
                  <button
                    className={classes.btnPrimary}
                    type="button"
                    onClick={() => void onAddSample()}
                    disabled={
                      addLinkSample.isPending || !title.trim() || !url.trim() || Boolean(sampleUrlError)
                    }
                  >
                    {t(addLinkSample.isPending ? "apply.adding" : "apply.add")}
                  </button>
                </div>
              </div>
            )}

            {canEdit && atMax && (
              <p className={classes.small}>{t("apply.atMax", { count: MAX_WORK_SAMPLES })}</p>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            id="application-agreements"
            title={t("apply.stepAgreements")}
            summary={agreementsAccepted ? t("apply.allAccepted") : t("apply.accepted", { count: acceptedCount })}
            badge={<DoneBadge done={agreementsAccepted} />}
            {...sectionFlags("agreements")}
          >
            <div className={classes.checks}>
              {agreementKeys.map((key) => (
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
                  <span><AgreementCopy agreement={key} /></span>
                </label>
              ))}
            </div>
          </CollapsibleSection>
        </div>

        <aside className={classes.aside} aria-label={t("apply.checklist")}>
          <div className={classes.asideHead}>
            <span className={classes.asideTitle}>{t("apply.ready")}</span>
            <span className={classes.asideCount}>
              {t("apply.progress", { done: doneCount, total: requirements.length })}
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
              ? t("apply.checkingSlots")
              : isQueueFull
                ? t("apply.paused", { open: queueState.openCount, max: queueState.maxOpen })
                : t("apply.slots", { count: queueState.remaining })}
          </p>

          <button
            className={classes.submit}
            type="button"
            onClick={() => void onSubmit()}
            disabled={!canSubmit}
          >
            {t(
              submitApplication.isPending
                ? "apply.submitting"
                : sellerApplication?.status === "needs_changes"
                  ? "apply.resubmit"
                  : "apply.submit"
            )}
          </button>

          {blocker && <p className={classes.blocker}>{blocker.blocker}</p>}
        </aside>
      </div>

      {(isAccessLoading || isSamplesLoading) && <p className={classes.small}>{t("common.loading")}</p>}
    </div>
  );
};

export default ApplyCreator;
