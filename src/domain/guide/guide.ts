import type { MessageKey } from "../../lib/i18n/messages/en";
import { tours, type TourId } from "./tours";

// The creator and buyer guides at /guide/creators and /guide/buyers. Each
// step explains one part of the site, can open a spotlight tour of the page
// it's about, and ticks itself off from what the account has actually done.
// Nothing is ticked by hand. Text is guide.<track>.<step>.title / .body in the
// language files; a body can hold several paragraphs, split on blank lines.

export type GuideTrack = "creators" | "buyers";

export const guideTracks: readonly GuideTrack[] = ["creators", "buyers"];

export const isGuideTrack = (value: string | undefined): value is GuideTrack =>
  value === "creators" || value === "buyers";

// From my_guide_progress() (migration 188).
export type GuideProgress = {
  listing_published: boolean;
  request_received: boolean;
  commission_delivered: boolean;
  download_sold: boolean;
  sale_made: boolean;
  request_sent: boolean;
  payment_made: boolean;
  commission_received: boolean;
  download_bought: boolean;
};

export type GuideFacts = {
  signedIn: boolean;
  isCreator: boolean;
  profileReady: boolean;
  applicationStatus: string | null;
  payoutsReady: boolean;
  // False before launch (payments_are_live, 20261110_193): there's no payout
  // setup to do yet. Left out, payments count as open.
  paymentsLive?: boolean;
  progress: GuideProgress | null;
};

// done: the account has done it. waiting: done its part, waiting on someone
// else. todo: not yet. read: nothing to do, just worth knowing.
export type GuideStepState = "done" | "waiting" | "todo" | "read";

export type GuideStep = {
  key: string;
  tour?: TourId;
  link?: { to: string; label: MessageKey };
  // A setting changed right in the step (Guide.tsx draws it).
  control?: "theme";
  state: (facts: GuideFacts) => GuideStepState;
  // Which body text to show, when it depends on the account: the suffix after
  // guide.<track>.<step>. Left out, it's "body".
  body?: (facts: GuideFacts) => "body" | "bodyClosed";
};

// Payouts can't be set up before launch, so the step is only worth knowing
// then, and says paid listings go live without it in the meantime.
const payoutsClosed = (facts: GuideFacts) => facts.paymentsLive === false && !facts.payoutsReady;

const read = () => "read" as const;
const when = (done: boolean): GuideStepState => (done ? "done" : "todo");
const did = (key: keyof GuideProgress) => (facts: GuideFacts) => when(Boolean(facts.progress?.[key]));

// First in both guides: works signed out too, and makes the rest easier on
// the eyes.
const look: GuideStep = { key: "look", control: "theme", state: read };

export const guideSteps: Record<GuideTrack, readonly GuideStep[]> = {
  creators: [
    look,
    {
      key: "profile",
      tour: "profile",
      link: { to: "/settings/profile", label: "guide.goProfile" },
      state: (facts) => when(facts.profileReady),
    },
    {
      key: "apply",
      tour: "apply",
      link: { to: "/apply/creator", label: "guide.goApply" },
      state: (facts) => {
        if (facts.isCreator) return "done";
        if (facts.applicationStatus === "submitted" || facts.applicationStatus === "under_review") {
          return "waiting";
        }
        return "todo";
      },
    },
    {
      key: "payouts",
      tour: "profile",
      link: { to: "/settings/profile", label: "guide.goPayouts" },
      state: (facts) => (payoutsClosed(facts) ? "read" : when(facts.payoutsReady)),
      body: (facts) => (payoutsClosed(facts) ? "bodyClosed" : "body"),
    },
    {
      key: "listing",
      tour: "newListing",
      link: { to: "/creator/listings/new", label: "guide.goNewListing" },
      state: did("listing_published"),
    },
    { key: "dashboard", tour: "dashboard", state: read },
    {
      key: "requests",
      tour: "creatorRequests",
      link: { to: "/creator/requests", label: "guide.goCommissions" },
      state: did("request_received"),
    },
    { key: "agreement", state: read },
    {
      key: "deliver",
      state: did("commission_delivered"),
    },
    { key: "downloads", state: did("download_sold") },
    {
      key: "earnings",
      tour: "earnings",
      link: { to: "/creator/earnings", label: "guide.goEarnings" },
      state: did("sale_made"),
    },
    {
      key: "problems",
      link: { to: "/policies/refunds", label: "guide.goRefunds" },
      state: read,
    },
  ],
  buyers: [
    look,
    {
      key: "profile",
      tour: "profile",
      link: { to: "/settings/profile", label: "guide.goProfile" },
      state: (facts) => when(facts.profileReady),
    },
    {
      key: "find",
      tour: "market",
      link: { to: "/market", label: "guide.goMarket" },
      state: read,
    },
    {
      key: "request",
      tour: "buyerRequests",
      link: { to: "/requests", label: "guide.goRequests" },
      state: did("request_sent"),
    },
    { key: "agreement", state: read },
    { key: "pay", state: did("payment_made") },
    { key: "approve", state: did("commission_received") },
    {
      key: "downloads",
      tour: "downloads",
      link: { to: "/downloads", label: "guide.goDownloads" },
      state: did("download_bought"),
    },
    {
      key: "messages",
      tour: "inbox",
      link: { to: "/messages", label: "guide.goInbox" },
      state: read,
    },
    {
      key: "problems",
      link: { to: "/policies/refunds", label: "guide.goRefunds" },
      state: read,
    },
  ],
};

// Whether this person can open the tour's page (the guide hides "Show me"
// otherwise, rather than sending them to a sign-in page or a refusal).
export const canTakeTour = (id: TourId, facts: Pick<GuideFacts, "signedIn" | "isCreator">) =>
  facts.signedIn && (tours[id].access !== "creator" || facts.isCreator);

// Steps with something to do, and how many of those are done.
export const guideProgressCount = (track: GuideTrack, facts: GuideFacts) => {
  const states = guideSteps[track].map((entry) => entry.state(facts)).filter((state) => state !== "read");
  return { done: states.filter((state) => state === "done").length, total: states.length };
};
