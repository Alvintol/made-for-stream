// Which language an email to a person is written in. Their saved choice
// comes first, then the language their browser last showed the site in
// (20261031_176), then English. Matches src/lib/i18n/languages.ts: a language
// is not "ready" until the site is, so nobody gets email in a language the
// site does not offer them. EMAIL_OFFER_UNFINISHED_LANGUAGES=true lifts that
// on a test deployment, like VITE_OFFER_UNFINISHED_LANGUAGES on the website.
// Playbook: docs/support/messaging/transactional-email.md (EMAIL-005).
export const EMAIL_LANGUAGES = [
  { code: "en", ready: true },
  { code: "fr", ready: false },
  { code: "es", ready: false },
];

const DEFAULT_LANGUAGE = "en";

export const pickEmailLanguage = (
  preferences,
  offerUnfinished = process.env.EMAIL_OFFER_UNFINISHED_LANGUAGES === "true",
) => {
  const code = preferences?.language || preferences?.browser_language;
  const language = EMAIL_LANGUAGES.find((candidate) => candidate.code === code);

  return language && (language.ready || offerUnfinished) ? language.code : DEFAULT_LANGUAGE;
};

// Never throws: an email in English beats no email.
export const getEmailLanguage = async (supabaseAdmin, userId) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_display_preferences")
      .select("language, browser_language")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return pickEmailLanguage(data);
  } catch (err) {
    console.error(`EMAIL-005: could not read the language for ${userId}: ${String(err?.message || err)}`);

    return DEFAULT_LANGUAGE;
  }
};
