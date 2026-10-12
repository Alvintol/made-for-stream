import { hasErrorMessage } from "../errorMessage";
import { supabase } from "../supabaseClient";

// Tells the database that something did not go through, so the ops digest
// can list what fails and how often (public.log_app_failure, migration
// 20261012_157; playbook OPS-006 in docs/support/operations/alerting.md).
// Called for every failed action and every failed page load, from the query
// client in AppProvider. It must never throw or get in the way: the person
// already has a failure on their screen.

const ID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// The page with ids taken out, so every commission page counts as one place.
export const getFailureRoute = (pathname: string): string =>
  pathname.replace(ID_PATTERN, ":id");

export const reportFailure = (
  source: "action" | "load",
  error: unknown,
  label?: unknown,
): void => {
  try {
    const code = (error as { code?: unknown } | null)?.code;

    void supabase
      .rpc("log_app_failure", {
        p_source: source,
        p_message: hasErrorMessage(error) ? error.message : String(error),
        p_code: typeof code === "string" || typeof code === "number" ? String(code) : null,
        p_route: getFailureRoute(window.location.pathname),
        p_label: typeof label === "string" ? label : null,
      })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // Nothing to do: reporting is best effort.
  }
};
