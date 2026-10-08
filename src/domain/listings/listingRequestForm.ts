import { SUPPORTED_CURRENCY_CODES } from "../payments/supportedCurrencies";

export type ListingRequestFormInput = {
  requestTitle: string;
  requestDetails: string;
  requestedTimeline: string;
  budgetText: string;
  referenceLinksText: string;
};

export type ListingRequestFormErrors = {
  requestTitle?: string;
  requestDetails?: string;
  requestedTimeline?: string;
  budgetAmount?: string;
  referenceLinks?: string;
};

export type ValidListingRequestForm = {
  requestTitle: string;
  requestDetails: string;
  requestedTimeline?: string;
  // A single figure, or the bottom of a range.
  budgetAmount: number | null;
  // The top of a range; null for a single figure.
  budgetAmountMax: number | null;
  referenceLinks: string[];
};

export const BUDGET_MAX = 999999.99;

export const BUDGET_FORMAT_MESSAGE =
  "Enter an amount such as 100, or a range such as 100-150. Put anything else about your budget in the details.";

export type ListingRequestBudget = { min: number; max: number | null };

const CURRENCY_MARKS = new RegExp(
  `[$€£¥]|(?<![a-z])(?:${SUPPORTED_CURRENCY_CODES.join("|")})(?![a-z])`,
  "g"
);

// Reads what a buyer typed as a budget: one amount ("100", "$1,250.50",
// "CAD 100") or a range ("100-150", "100 to 150", "$100 – $150"). Returns
// null for an empty box and "invalid" for anything it cannot be sure of
// ("around 100", "100 per emote"): guessing a number out of a sentence would
// put a wrong figure in front of the creator.
export const parseListingRequestBudget = (
  text: string
): ListingRequestBudget | null | "invalid" => {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/\b(to|and)\b/g, "-")
    .replace(/[–—~]/g, "-")
    // A currency sign or a supported currency code beside an amount is fine.
    .replace(CURRENCY_MARKS, "")
    .replace(/\s+/g, "")
    // "1,250" is a thousand; "100,50" is a decimal comma.
    .replace(/,(\d{3})(?!\d)/g, "$1")
    .replace(/,(\d{1,2})(?!\d)/g, ".$1");

  if (!cleaned) return text.trim() ? "invalid" : null;

  const match = /^(\d+(?:\.\d{1,2})?)(?:-(\d+(?:\.\d{1,2})?))?$/.exec(cleaned);

  if (!match) return "invalid";

  const amounts = [Number(match[1]), ...(match[2] ? [Number(match[2])] : [])].sort((a, b) => a - b);
  const min = amounts[0];
  const max = amounts.length > 1 && amounts[1] > min ? amounts[1] : null;

  return min > BUDGET_MAX || (max ?? 0) > BUDGET_MAX ? "invalid" : { min, max };
};

export type ListingRequestFormValidationResult = {
  values: ValidListingRequestForm | null;
  errors: ListingRequestFormErrors;
};

export const parseListingRequestReferenceLinks = (value: string): string[] =>
  value
    .split("\n")
    .map((link) => link.trim())
    .filter(Boolean);

export const isValidListingRequestReferenceUrl = (value: string): boolean => {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const validateListingRequestForm = (
  input: ListingRequestFormInput
): ListingRequestFormValidationResult => {
  const errors: ListingRequestFormErrors = {};

  const requestTitle = input.requestTitle.trim();
  const requestDetails = input.requestDetails.trim();
  const requestedTimeline = input.requestedTimeline.trim();
  const budgetText = input.budgetText.trim();
  const referenceLinks = parseListingRequestReferenceLinks(
    input.referenceLinksText
  );

  if (requestTitle.length < 3 || requestTitle.length > 120) {
    errors.requestTitle = "Summary must be between 3 and 120 characters.";
  }

  if (requestDetails.length < 10 || requestDetails.length > 2000) {
    errors.requestDetails = "Details must be between 10 and 2000 characters.";
  }

  if (requestedTimeline.length > 160) {
    errors.requestedTimeline = "Timeline must be 160 characters or fewer.";
  }

  const budget = parseListingRequestBudget(budgetText);

  if (budget === "invalid") {
    errors.budgetAmount = BUDGET_FORMAT_MESSAGE;
  }

  if (referenceLinks.length > 5) {
    errors.referenceLinks = "Add up to 5 reference links.";
  } else if (
    referenceLinks.some((link) => !isValidListingRequestReferenceUrl(link))
  ) {
    errors.referenceLinks =
      "Reference links must start with http:// or https://.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      values: null,
      errors,
    };
  }

  return {
    values: {
      requestTitle,
      requestDetails,
      requestedTimeline: requestedTimeline || undefined,
      budgetAmount: budget && budget !== "invalid" ? budget.min : null,
      budgetAmountMax: budget && budget !== "invalid" ? budget.max : null,
      referenceLinks,
    },
    errors,
  };
};