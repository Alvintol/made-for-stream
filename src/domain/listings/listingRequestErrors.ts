type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const toSupabaseLikeError = (error: unknown): SupabaseLikeError => {
  if (!error || typeof error !== "object") {
    return {};
  }

  return error as SupabaseLikeError;
};

const includesAny = (value: string, terms: string[]): boolean =>
  terms.some((term) => value.includes(term));

export const getCreateListingRequestErrorMessage = (
  error: unknown
): string => {
  const supabaseError = toSupabaseLikeError(error);
  const message = supabaseError.message?.toLowerCase() ?? "";
  const details = supabaseError.details?.toLowerCase() ?? "";
  const joinedText = `${message} ${details}`;

  // RLS usually means the listing is no longer publicly requestable.
  if (
    supabaseError.code === "42501" ||
    includesAny(joinedText, ["row-level security", "permission denied"])
  ) {
    return "This listing is no longer available for commission requests.";
  }

  // CON-007 (20260924_139): the creator's payout account is not ready, so
  // the database refuses new paid work. Its message is written for buyers.
  if (message.includes("cannot take new paid work")) {
    return "This creator can't take new paid work right now because their payout account needs attention. Please try again later.";
  }

  // Constraint names from the structured request field migration.
  if (joinedText.includes("listing_requests_request_title_check")) {
    return "Commission summary must be between 3 and 120 characters.";
  }

  if (joinedText.includes("listing_requests_request_details_check")) {
    return "Commission details must be between 10 and 2000 characters.";
  }

  if (joinedText.includes("listing_requests_requested_timeline_check")) {
    return "Timeline must be 160 characters or fewer.";
  }

  if (joinedText.includes("listing_requests_budget_amount_check")) {
    return "Budget must be a valid amount between 0 and 999999.99.";
  }

  if (joinedText.includes("listing_requests_budget_amount_max_check")) {
    return "The top of a budget range must be more than the bottom, and no more than 999999.99.";
  }

  if (joinedText.includes("listing_requests_reference_links_check")) {
    return "Add up to 5 reference links.";
  }

  if (
    includesAny(joinedText, [
      "foreign key",
      "violates foreign key constraint",
      "listing_requests_listing_id",
    ])
  ) {
    return "This listing could not be found or is no longer available.";
  }

  return "Your commission request could not be sent right now.";
};