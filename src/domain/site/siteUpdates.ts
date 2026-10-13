// The site's version and what changed in each one, newest first. This is
// what people see at /updates, in the footer, and in the "what's new" window
// (for those who asked for it in Settings -> Preferences).
//
// Versions read V<major>.<minor>.<patch>, the patch always two digits:
//   major  0 while the site is in private beta, 1 at public launch;
//   minor  something new that people can see or do (patch returns to 00);
//   patch  fixes and small changes to what is already there.
//
// EVERY change to the site moves the version, whether or not people can see
// it: add an entry at the TOP and set siteVersion to its version. One branch,
// one version; several changes on a branch share its entry. Write for the
// people using the site, not for developers: what is different for them, in
// plain words. Work they cannot see gets one plain line ("Fixes and
// behind-the-scenes improvements"). A test fails if siteVersion and the
// first entry disagree, or if the numbers do not go down the list.
//
// This list is PUBLIC, signed in or not. Never describe a security fix in a
// way that tells someone how the fault worked ("Security improvements" is
// enough), and never name internal systems, providers' settings or database
// details. A test refuses the most obvious of those words.
// Site updates are never sent by email.

export type SiteUpdate = {
  version: string;
  // The day it was released, as YYYY-MM-DD.
  date: string;
  title: string;
  changes: readonly string[];
};

export const siteVersion = "V0.2.00";

// How many versions /updates lists at a time.
export const siteUpdatesPageSize = 10;

export const siteUpdates: readonly SiteUpdate[] = [
  {
    version: "V0.2.00",
    date: "2026-10-13",
    title: "Version numbers and a version history",
    changes: [
      "The site now has version numbers, starting from V0.1.00. The footer shows the current one.",
      "The What's new page lists each version with its date. Choose a version to read what changed in it; the latest is open when you arrive.",
      "The page shows the ten most recent versions, with arrows to move to older ones.",
      "Fixes and behind-the-scenes improvements.",
    ],
  },
  {
    version: "V0.1.00",
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
