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
// behind-the-scenes improvements"). One change per line: never join two
// changes in one sentence. A test fails if siteVersion and the
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

export const siteVersion = "V0.5.01";

// How many versions /updates lists at a time.
export const siteUpdatesPageSize = 10;

export const siteUpdates: readonly SiteUpdate[] = [
  {
    version: "V0.5.01",
    date: "2026-10-16",
    title: "Safe file types for deliveries",
    changes: [
      "For safety, a final delivery can only include images, artwork files, video, audio, 3D and Live2D models, fonts, PDF, text and zip files.",
      "Program and script files cannot be uploaded, on their own or inside a zip.",
      "A zip is checked before it is uploaded, and one that cannot be opened, for example because it has a password, is refused.",
      "Lists of changes, here and on the page that asks you to accept a policy, now show each change on its own line.",
    ],
  },
  {
    version: "V0.5.00",
    date: "2026-10-16",
    title: "More room for delivery files",
    changes: [
      "Delivery files can now be up to 2 GB each, with up to 50 files and 10 GB in one final delivery.",
      "Each commission has 20 GB of storage for its delivery files.",
      "A bar on the final delivery form shows how much storage is used and how much the files you are adding will take.",
      "A folder larger than 2 GB is best zipped on your computer; the form explains how.",
    ],
  },
  {
    version: "V0.4.00",
    date: "2026-10-16",
    title: "Upload finished files, and names in the chat",
    changes: [
      "Creators can upload the finished files with the final delivery: single files, or a whole folder, which is zipped in the browser before it is uploaded. One .zip is recommended.",
      "The buyer downloads the files from the commission page once nothing is owed for the final release.",
      "Delivered files are kept for 180 days after the commission closes, then deleted, so keep your own copy.",
      "Automatic lines in the chat now name the people, for example \"@meowington sent a project change order\", instead of saying \"The creator\".",
      "The Privacy Policy now covers delivered files. You will be asked to accept the new version.",
    ],
  },
  {
    version: "V0.3.00",
    date: "2026-10-13",
    title: "A record of work sent outside the site, and tidier conversations",
    changes: [
      "Creators submitting a milestone or a final delivery can tick \"Provided off site\" and say how the work was also sent: email, Discord, text message or another way.",
      "The commission's chat and the delivery then show where the creator says the work went, so both people have a record. It is the creator's statement: Made for Stream holds no copy of work sent that way and cannot confirm that it arrived.",
      "The same forms now warn that work sent outside Made for Stream carries no watermark and is not protected by Made for Stream.",
      "Conversations group messages under the day they were sent, and each message shows only its time.",
      "Automatic lines in a conversation, such as \"The creator sent a change order\", now sit on the side of the person who did it.",
    ],
  },
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
      "A creator can withdraw a change order until the buyer answers it.",
      "A creator can lower a price with a change order: the payments still to come are reduced to match the new total.",
      "When something is refused, the page now says why.",
      "After a refusal, the page offers a button to reload in case it is out of date.",
      "Images uploaded to a commission are deleted 180 days after it closes.",
      "Images of a listing that is no longer offered are deleted 180 days after it stops being offered, and the listing returns to a draft.",
      "When our Terms or Privacy Policy change, the page that asks you to accept them now lists what changed.",
      "This page is new: every update to the site is listed here.",
      "The footer shows the current version.",
    ],
  },
];
