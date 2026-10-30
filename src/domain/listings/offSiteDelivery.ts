// A creator's own statement that work was also sent outside Made for Stream
// (migration 20261013_162). The site holds no copy of that work and cannot
// tell whether it arrived; it only records where the creator says it went,
// on the submission and as a line in the commission's chat.
//
// The list and the limits mirror public.clean_off_site_delivery_methods.

import { english, hasMessage, type Translate } from "../../lib/i18n/i18n";
export const offSiteDeliveryMethods = [
  "email",
  "discord",
  "text_message",
  "other",
] as const;

export type OffSiteDeliveryMethod = (typeof offSiteDeliveryMethods)[number];

export const OFF_SITE_OTHER_MIN_LENGTH = 2;
export const OFF_SITE_OTHER_MAX_LENGTH = 80;

// What the form holds while it is being filled in.
export type OffSiteDeliveryFormState = {
  provided: boolean;
  methods: OffSiteDeliveryMethod[];
  other: string;
};

// What is sent with the submission.
export type OffSiteDeliveryInput = {
  methods: OffSiteDeliveryMethod[];
  other: string | null;
};

export const emptyOffSiteDelivery: OffSiteDeliveryFormState = {
  provided: false,
  methods: [],
  other: "",
};

export const validateOffSiteDelivery = (
  state: OffSiteDeliveryFormState,
  t: Translate = english,
): string | undefined => {
  if (!state.provided) return undefined;

  if (state.methods.length === 0) {
    return t("offSiteFields.errorMethod");
  }

  const other = state.other.trim();

  if (
    state.methods.includes("other") &&
    (other.length < OFF_SITE_OTHER_MIN_LENGTH || other.length > OFF_SITE_OTHER_MAX_LENGTH)
  ) {
    return t("offSiteFields.errorOther", {
      min: OFF_SITE_OTHER_MIN_LENGTH,
      max: OFF_SITE_OTHER_MAX_LENGTH,
    });
  }

  return undefined;
};

// Null when the creator did not tick "Provided off site".
export const toOffSiteDeliveryInput = (
  state: OffSiteDeliveryFormState,
): OffSiteDeliveryInput | null => {
  if (!state.provided || state.methods.length === 0) return null;

  return {
    methods: offSiteDeliveryMethods.filter((method) => state.methods.includes(method)),
    other: state.methods.includes("other") ? state.other.trim() : null,
  };
};

// "Email, Discord, Another way (a USB stick in the post)", or null when
// nothing was recorded. Takes what the database returns, so an unknown
// value is shown as it is rather than hidden.
export const describeOffSiteDelivery = (
  methods: readonly string[] | null | undefined,
  other: string | null | undefined,
  t: Translate = english,
): string | null => {
  if (!methods || methods.length === 0) return null;

  return methods
    .map((method) => {
      const key = `offSiteMethod.${method}`;
      const label = hasMessage(key) ? t(key) : method;

      return method === "other" && other ? `${label} (${other})` : label;
    })
    .join(", ");
};
