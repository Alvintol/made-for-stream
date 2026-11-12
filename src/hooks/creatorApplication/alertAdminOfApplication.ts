import { supabase } from "../../lib/supabaseClient";

const getApiBase = (): string =>
  (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || "";

// After an application is submitted, asks the API to email the team so it
// can be reviewed straight away (APP-007). Best effort, the same pattern as
// listingRequestNoticeEmail.ts: the submission is already a database fact,
// a failure here never undoes it, and the hourly ops run sends any alert
// this call missed.
export const alertAdminOfApplication = async (applicationId: string): Promise<void> => {
  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) return;

    await fetch(`${getApiBase()}/api/creator-applications/${applicationId}/alert-admin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    // Best effort -- see the comment above.
  }
};
