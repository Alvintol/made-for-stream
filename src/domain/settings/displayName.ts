// The public display name every account must choose for itself
// (20261008_152). The database enforces the length and refuses listings,
// commission requests and agreements from an account still on the
// placeholder; this mirrors it for the forms.

// What a new account is called until its owner chooses a name.
export const PLACEHOLDER_DISPLAY_NAME = "New member";

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 50;

type DisplayNameProfile = {
  display_name: string | null;
  display_name_auto: boolean;
};

// True once the person has picked their own name.
export const hasChosenDisplayName = (profile: DisplayNameProfile | null | undefined): boolean =>
  Boolean(profile && !profile.display_name_auto && profile.display_name?.trim());

// Null when the name is acceptable.
export const getDisplayNameError = (value: string): string | null => {
  const length = value.trim().length;

  return length < DISPLAY_NAME_MIN || length > DISPLAY_NAME_MAX
    ? `Enter a display name of ${DISPLAY_NAME_MIN} to ${DISPLAY_NAME_MAX} characters.`
    : null;
};
