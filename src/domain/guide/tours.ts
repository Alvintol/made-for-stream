// Spotlight tours: short walks around one page that dim everything except
// the control being explained. A tour runs when the page's address has
// ?tour=<id> (see GuideTour), so a "Show me" link is all it takes to start
// one, and the browser's back button or a reload behaves.
//
// Each step points at a CSS selector on that page. If the element isn't
// there (still loading, hidden on a phone, or not shown in this state), the
// step still shows, as a card in the middle of the screen. Text lives in the
// language files as tour.<id>.<step> (title) and tour.<id>.<step>Text (body).
//
// `path` is where "Show me" goes. A null path is a tour of a page that needs
// an id, such as one commission: it's started from that page itself.
// `access` says who can open the page, so the guide only offers "Show me" to
// people the page would let in.

export type TourAccess = "signedIn" | "creator";

export type TourStep = {
  key: string;
  target: string | null;
};

export type Tour = {
  path: string | null;
  access: TourAccess;
  steps: readonly TourStep[];
};

const step = (key: string, target: string | null = null): TourStep => ({ key, target });

export const tours = {
  profile: {
    path: "/settings/profile",
    access: "signedIn",
    steps: [
      step("intro"),
      step("profile", "#settings-profile"),
      step("connections", "#settings-connections"),
      step("creator", "#settings-creator"),
      step("payouts", "#settings-payouts"),
    ],
  },
  apply: {
    path: "/apply/creator",
    access: "signedIn",
    steps: [
      step("intro"),
      step("basics", "#application-basics"),
      step("samples", "#application-samples"),
      step("agreements", "#application-agreements"),
    ],
  },
  newListing: {
    path: "/creator/listings/new",
    access: "creator",
    steps: [
      step("intro"),
      step("type", "#offeringType"),
      step("flow", "#fulfilmentMode"),
      step("pricing", '[data-tour="listing-pricing"]'),
      step("preview", '[data-tour="listing-preview"]'),
      step("checklist", '[data-tour="listing-checklist"]'),
    ],
  },
  dashboard: {
    path: "/creator/dashboard",
    access: "creator",
    steps: [
      step("intro"),
      step("create", '[data-tour="dashboard-create"]'),
      step("pages", '[data-tour="dashboard-pages"]'),
      step("stats", '[data-tour="dashboard-stats"]'),
      step("chart", '[data-tour="dashboard-chart"]'),
      step("attention", '[data-tour="dashboard-attention"]'),
      step("month", '[data-tour="dashboard-month"]'),
      step("latest", '[data-tour="dashboard-latest"]'),
    ],
  },
  creatorRequests: {
    path: "/creator/requests",
    access: "creator",
    steps: [
      step("intro"),
      step("folders", '[data-tour="requests-folders"]'),
      step("list", '[data-tour="requests-list"]'),
    ],
  },
  creatorRequest: {
    path: null,
    access: "creator",
    steps: [
      step("intro"),
      step("next", '[data-tour="request-next"]'),
      step("chat", '[data-tour="request-chat"]'),
      step("agreement", "#request-section-agreement"),
      step("milestones", "#request-section-milestones"),
      step("delivery", "#request-section-delivery"),
      step("changes", "#request-section-changeOrders"),
      step("manage", '[data-tour="request-manage"]'),
    ],
  },
  earnings: {
    path: "/creator/earnings",
    access: "creator",
    steps: [
      step("intro"),
      step("month", '[data-tour="earnings-month"]'),
      step("sales", '[data-tour="earnings-sales"]'),
      step("transactions", '[data-tour="earnings-transactions"]'),
      step("tax", '[data-tour="earnings-tax"]'),
    ],
  },
  market: {
    path: "/market",
    access: "signedIn",
    steps: [
      step("intro"),
      step("filters", '[data-tour="market-filters"]'),
      step("listings", '[data-tour="market-listings"]'),
      step("creators", '[data-tour="nav-creators"]'),
    ],
  },
  buyerRequests: {
    path: "/requests",
    access: "signedIn",
    steps: [
      step("intro"),
      step("folders", '[data-tour="requests-folders"]'),
      step("list", '[data-tour="requests-list"]'),
    ],
  },
  buyerRequest: {
    path: null,
    access: "signedIn",
    steps: [
      step("intro"),
      step("next", '[data-tour="request-next"]'),
      step("chat", '[data-tour="request-chat"]'),
      step("agreement", "#request-section-agreement"),
      step("payments", "#request-section-payments"),
      step("delivery", "#request-section-delivery"),
      step("manage", '[data-tour="request-manage"]'),
    ],
  },
  downloads: {
    path: "/downloads",
    access: "signedIn",
    steps: [step("intro"), step("list", '[data-tour="downloads-list"]')],
  },
  inbox: {
    path: "/messages",
    access: "signedIn",
    steps: [
      step("intro"),
      step("folders", '[data-tour="inbox-folders"]'),
      step("list", '[data-tour="inbox-list"]'),
    ],
  },
} as const satisfies Record<string, Tour>;

export type TourId = keyof typeof tours;

export const isTourId = (value: string | null): value is TourId =>
  value !== null && Object.prototype.hasOwnProperty.call(tours, value);

// The address that starts a tour: the tour's own page, or the page it's on.
export const tourHref = (id: TourId, currentPath?: string, currentSearch = "") => {
  const path = tours[id].path ?? currentPath ?? "/";
  const search = new URLSearchParams(tours[id].path ? "" : currentSearch);
  search.set("tour", id);
  return `${path}?${search.toString()}`;
};
