// Supabase hands a refusal back as a plain object ({ message, code, ... }),
// not as an Error, and the hooks throw it as it comes. Testing a caught
// value with `instanceof Error` therefore threw the database's own words
// away and showed a generic line instead ("could not be created"), which
// left people with no idea what to fix. Use this wherever a caught value is
// turned into text for the screen.
export const hasErrorMessage = (error: unknown): error is { message: string } =>
  typeof error === "object" &&
  error !== null &&
  typeof (error as { message?: unknown }).message === "string" &&
  (error as { message: string }).message !== "";
