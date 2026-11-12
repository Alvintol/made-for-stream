// Emails the team when a creator application is submitted, so it can be
// reviewed straight away (20261112_198). The website calls
// POST /api/creator-applications/:id/alert-admin right after submitting, and
// the hourly ops run (POST /api/internal/ops/alerts/run) sends any that
// call missed. Each submission is alerted once: an alert is claimed by
// setting admin_alerted_at before sending and released if the send fails,
// so two attempts at the same moment can't both send it.
// Playbook: docs/support/creators/applications.md (APP-007).

import { renderActionEmail } from "./emailTemplates.js";

// The application's "What will you offer?" answers (20261112_197), in the
// order the site lists them. src/domain/tests/creatorApplicationAlerts.test.ts
// checks these against the site's list.
export const OFFERING_LABELS = {
  emotes: "Emotes",
  overlays: "Overlays",
  panels: "Panels",
  screens: "Screens",
  alerts: "Alerts",
  badges: "Badges",
  "pngtuber-models": "PNG-tuber Models",
  "vtuber-models": "VTuber Models",
  "vtuber-rigging": "PNG/VTuber Rigging",
  "video-editing": "Video Editing",
  "audio-tech-help": "Audio Tech Help",
  games: "Games",
  other: "Something else",
};

// Due while submitted and not alerted since its latest submission.
export const isAwaitingAdminAlert = (application) => {
  if (application?.status !== "submitted") return false;
  if (!application.admin_alerted_at) return true;

  const alertedAt = Date.parse(application.admin_alerted_at);
  const submittedAt = Date.parse(application.submitted_at || "");

  return Number.isNaN(alertedAt) || (!Number.isNaN(submittedAt) && alertedAt < submittedAt);
};

export const describeOfferings = (offerings, other) => {
  const chosen = Object.keys(OFFERING_LABELS).filter((key) => (offerings || []).includes(key));

  if (chosen.length === 0) return "Not chosen";

  return chosen
    .map((key) => (key === "other" && String(other || "").trim() ? `Something else: ${String(other).trim()}` : OFFERING_LABELS[key]))
    .join(", ");
};

const platformName = (platform) =>
  platform === "twitch" ? "Twitch" : platform === "youtube" ? "YouTube" : String(platform || "Account");

// Dev and prod mail the same inbox; only prod's alerts are about real people.
const whereFrom = (siteUrl) => {
  try {
    return new URL(siteUrl).hostname === "madeforstream.com" ? "ops" : "dev ops";
  } catch {
    return "dev ops";
  }
};

export const renderNewCreatorApplicationAlert = ({
  application,
  profile,
  platforms = [],
  sampleCount = 0,
  siteUrl,
}) => {
  const handle = profile?.handle ? `@${profile.handle}` : "";
  const name = String(profile?.display_name || "").trim() || handle || "Unnamed applicant";
  const who = handle && name !== handle ? `${name} (${handle})` : name;
  const resubmitted = Boolean(application?.reviewed_at);

  const channelLines = platforms.length
    ? platforms.map((account) => {
        const login = account.platform_login ? ` @${account.platform_login}` : "";
        return `${platformName(account.platform)}${login}${account.profile_url ? `: ${account.profile_url}` : ""}`;
      })
    : ["No linked Twitch or YouTube account."];

  return renderActionEmail({
    subject: `[Made for Stream ${whereFrom(siteUrl)}] ${resubmitted ? "Creator application resubmitted" : "New creator application"}: ${who}`,
    title: resubmitted ? "A creator application was resubmitted" : "A new creator application is waiting",
    lines: [
      `${who} ${resubmitted ? "sent their creator application back for review" : "applied to be a creator"}.`,
      `Plans to offer: ${describeOfferings(profile?.offering_types, profile?.offering_other)}`,
      `Work samples: ${sampleCount}`,
      "Linked channels (check the audience minimum: Twitch Affiliate or Partner with 300+ followers, or 500+ YouTube subscribers):",
      ...channelLines,
    ],
    ctaUrl: `${siteUrl}/admin/creator-applications?application=${encodeURIComponent(application.id)}`,
    ctaLabel: "Review the application",
  });
};

// Sends the alerts that are due: one application, or (with no id) up to
// `limit` of the oldest. `sendEmail` is sendTransactionalEmail bound to the
// admin client. Returns what happened, for the caller to log.
export const alertNewCreatorApplications = async ({
  supabaseAdmin,
  sendEmail,
  to,
  siteUrl,
  applicationId = null,
  limit = 10,
  now = () => new Date().toISOString(),
}) => {
  let query = supabaseAdmin
    .from("seller_applications")
    .select("id, profile_user_id, status, submitted_at, reviewed_at, admin_alerted_at")
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true })
    .limit(applicationId ? 1 : limit);

  if (applicationId) query = query.eq("id", applicationId);

  const { data: candidates, error } = await query;
  if (error) throw new Error(error.message);

  const outcome = { sent: 0, failed: 0, skipped: 0 };

  for (const application of candidates || []) {
    if (!isAwaitingAdminAlert(application)) {
      outcome.skipped += 1;
      continue;
    }

    // Claim it: only one attempt gets the row back.
    const claimedAt = now();
    let claim = supabaseAdmin
      .from("seller_applications")
      .update({ admin_alerted_at: claimedAt })
      .eq("id", application.id)
      .eq("status", "submitted");
    claim = application.admin_alerted_at
      ? claim.eq("admin_alerted_at", application.admin_alerted_at)
      : claim.is("admin_alerted_at", null);

    const { data: claimed, error: claimError } = await claim.select("id");
    if (claimError) throw new Error(claimError.message);
    if (!claimed?.length) {
      outcome.skipped += 1;
      continue;
    }

    let result;

    try {
      const [{ data: profile }, { data: platforms }, { count }] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("handle, display_name, offering_types, offering_other")
          .eq("user_id", application.profile_user_id)
          .maybeSingle(),
        supabaseAdmin
          .from("profile_platform_accounts")
          .select("platform, platform_login, profile_url")
          .eq("profile_user_id", application.profile_user_id),
        supabaseAdmin
          .from("seller_application_samples")
          .select("id", { count: "exact", head: true })
          .eq("application_id", application.id),
      ]);

      result = await sendEmail({
        to,
        ...renderNewCreatorApplicationAlert({
          application,
          profile,
          platforms: platforms || [],
          sampleCount: count || 0,
          siteUrl,
        }),
      });
    } catch (err) {
      result = { status: "failed", failedReason: String(err?.message || err) };
    }

    if (result?.status === "sent") {
      outcome.sent += 1;
      continue;
    }

    outcome.failed += 1;
    console.error(
      `APP-007: the new-application email for creator application ${application.id} failed: ${result?.failedReason || "unknown"}`,
    );

    // Release the claim so the next attempt (the hourly run) tries again.
    const { error: releaseError } = await supabaseAdmin
      .from("seller_applications")
      .update({ admin_alerted_at: application.admin_alerted_at ?? null })
      .eq("id", application.id)
      .eq("admin_alerted_at", claimedAt);

    if (releaseError) {
      console.error(
        `APP-007: creator application ${application.id} could not be re-queued for its email: ${releaseError.message}`,
      );
    }
  }

  return outcome;
};
