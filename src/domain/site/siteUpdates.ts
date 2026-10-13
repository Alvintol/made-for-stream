// The site's version and what changed in each one, newest first. This is
// what people see at /updates, in the footer, and in the "what's new" window
// (for those who asked for it in Settings -> Preferences).
//
// To publish an update: add an entry at the TOP and set siteVersion to its
// version. Write for the people using the site, not for developers: what is
// different for them, in plain words. A test fails if siteVersion and the
// first entry disagree. Site updates are never sent by email.

export type SiteUpdate = {
  version: string;
  // The day it was released, as YYYY-MM-DD.
  date: string;
  title: string;
  changes: readonly string[];
};

export const siteVersion = "2026.10.12";

export const siteUpdates: readonly SiteUpdate[] = [
  {
    version: "2026.10.12",
    date: "2026-10-12",
    title: "Commissions: images, change orders and clearer messages",
    changes: [
      "Creators can add up to six preview images when submitting a milestone. Each one is watermarked before it is uploaded, and only the creator and the buyer can see them.",
      "A creator can withdraw a change order until the buyer answers it, and can lower a price: the payments still to come are reduced to match the new total.",
      "When something is refused, the page now says why, and offers a button to reload if the page may be out of date.",
      "Images uploaded to a commission are deleted 180 days after it closes. Images of a listing that is no longer offered are deleted on the same schedule, and the listing returns to a draft.",
      "When our Terms or Privacy Policy change, the page that asks you to accept them now lists what changed.",
      "This page is new: every update to the site is listed here, and the footer shows the current version.",
    ],
  },
];
