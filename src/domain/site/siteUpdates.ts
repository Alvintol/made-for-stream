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

export const siteVersion = "V0.7.21";

// How many versions /updates lists at a time.
export const siteUpdatesPageSize = 10;

export const siteUpdates: readonly SiteUpdate[] = [
  {
    version: "V0.7.21",
    date: "2026-10-30",
    title: "Behind the scenes",
    changes: ["Fixes and behind-the-scenes improvements."],
  },
  {
    version: "V0.7.20",
    date: "2026-10-30",
    title: "Behind the scenes",
    changes: ["Fixes and behind-the-scenes improvements."],
  },
  {
    version: "V0.7.19",
    date: "2026-10-30",
    title: "Clearer creator commissions",
    changes: [
      "The creator commission list shows how each listing is bought, its type and its category as words, such as Commission request, instead of codes.",
      "The count above the creator commission list reads \"1 commission found\" instead of \"1 commission(s) found\".",
      "When a buyer approves a milestone, the creator's page says the next milestone unlocks after payment is confirmed, instead of saying the payment waits for an admin.",
    ],
  },
  {
    version: "V0.7.18",
    date: "2026-10-30",
    title: "Behind the scenes",
    changes: ["Fixes and behind-the-scenes improvements."],
  },
  {
    version: "V0.7.17",
    date: "2026-10-30",
    title: "Clearer listing snapshot",
    changes: [
      "A commission's listing snapshot shows the listing type, purchase flow and category as the same words used across the site, such as Commission request.",
      "Listing titles in the snapshot keep the creator's own capitalisation.",
    ],
  },
  {
    version: "V0.7.16",
    date: "2026-10-29",
    title: "Clearer cancellation steps",
    changes: [
      "A cancellation statement now says that unearned amounts are refunded to the buyer once the cancellation is accepted.",
      "A final notice now says that, after it runs out, you may request administrative closure, fixing a mistyped word.",
      "The cancellation statement form names each payment the way the rest of the site does, such as \"Starting payment\".",
      "Dates and times on notices and cancellation proposals read like the rest of the site, such as \"Jun 7, 2026, 6:00 PM\".",
    ],
  },
  {
    version: "V0.7.15",
    date: "2026-10-29",
    title: "Clearer milestone review",
    changes: [
      "When you review a milestone, the instructions now read \"request revisions\" instead of a mistyped word.",
      "After you approve a milestone, the page says the creator continues once its payment is confirmed, instead of saying the payment waits for an admin.",
    ],
  },
  {
    version: "V0.7.14",
    date: "2026-10-29",
    title: "Behind the scenes",
    changes: ["Fixes and behind-the-scenes improvements."],
  },
  {
    version: "V0.7.13",
    date: "2026-10-29",
    title: "Clearer commission list",
    changes: [
      "Your commission list shows how each listing is bought in words, such as Commission request, instead of a code.",
      "Commission cards show the listing type and category as words.",
      "The count above your commissions reads \"1 commission found\" instead of \"1 commission(s) found\".",
    ],
  },
  {
    version: "V0.7.12",
    date: "2026-10-29",
    title: "Behind the scenes",
    changes: ["Fixes and behind-the-scenes improvements."],
  },
  {
    version: "V0.7.11",
    date: "2026-10-29",
    title: "Clearer commission request message",
    changes: [
      "A listing that doesn't take commission requests now says so plainly.",
    ],
  },
  {
    version: "V0.7.10",
    date: "2026-10-29",
    title: "Clearer listing pages",
    changes: [
      "A commission listing now explains that you send the creator your idea and pay nothing until you accept their agreement.",
      "Market cards show each listing in the creator's own currency again.",
      "Listing cards show the listing type as a word, such as Service, instead of a code.",
    ],
  },
  {
    version: "V0.7.09",
    date: "2026-10-29",
    title: "Behind the scenes",
    changes: ["Fixes and behind-the-scenes improvements."],
  },
  {
    version: "V0.7.08",
    date: "2026-10-29",
    title: "Clearer reporting",
    changes: [
      "Report forms ask you to say why, if you believe something is illegal, and remind you that a report should be accurate and complete.",
      "The report reasons now include \"Illegal, or against another Made for Stream rule\", and \"Inappropriate, mature or adult content\".",
      "Message reports can now use the \"Illegal, or against another Made for Stream rule\" reason too.",
      "If you're signed out, listing and creator pages tell you how to report by email without an account.",
    ],
  },
  {
    version: "V0.7.07",
    date: "2026-10-29",
    title: "Updated Terms, Privacy Policy and Community Guidelines",
    changes: [
      "Mature and adult content is no longer allowed anywhere on Made for Stream, with or without a warning.",
      "Mature or adult content is removed, and the account that posted it can be suspended or permanently banned.",
      "The Terms say where Made for Stream is not available because of sanctions, and that Quebec comes once the site is in French.",
      "The Terms and Community Guidelines explain how reports are handled, that a person makes every removal decision, and how to ask for a review within six months.",
      "safety@madeforstream.com is named as the contact for reports and for authorities under EU and UK online safety law.",
      "The Privacy Policy says when a creator is told a buyer has EU or UK consumer rights, and how location is used to check availability.",
      "You'll be asked to accept the updated Terms and Privacy Policy the next time you sign in, and creators the updated Creator Terms.",
    ],
  },
  {
    version: "V0.7.06",
    date: "2026-10-29",
    title: "Prices with the service fee included",
    changes: [
      "Listing prices now include the 5% buyer service fee, so the price you see is what you pay before any tax.",
      "Each listing's page also shows the creator's own price.",
      "On the request form, the estimate calls the listing's price the creator's price, with the fee as its own line.",
      "When a buyer in the EU, EEA or UK sends a request, the creator is told about the buyer's 14-day cancellation right and confirms it before accepting.",
    ],
  },
  {
    version: "V0.7.05",
    date: "2026-10-29",
    title: "Where Made for Stream is available",
    changes: [
      "Made for Stream isn't available in Quebec until the site is in French.",
      "Made for Stream can't be used from Belarus, Cuba, Iran, North Korea, Russia or Syria, because of sanctions.",
    ],
  },
  {
    version: "V0.7.04",
    date: "2026-10-28",
    title: "Behind the scenes",
    changes: ["Fixes and behind-the-scenes improvements."],
  },
  {
    version: "V0.7.03",
    date: "2026-10-28",
    title: "Behind the scenes",
    changes: ["Fixes and behind-the-scenes improvements."],
  },
  {
    version: "V0.7.02",
    date: "2026-10-28",
    title: "Receipts, policy changes and Unity packages",
    changes: [
      "Approving a milestone now also confirms that work sent outside Made for Stream for it arrived.",
      "The chat says when a milestone approval confirmed work sent off site.",
      "If a policy changed since you last accepted it, signing in shows you what changed before you accept it.",
      "When a Unity package can't be uploaded, the message explains how to send it for now, and that a safe way to accept them is coming.",
    ],
  },
  {
    version: "V0.7.01",
    date: "2026-10-28",
    title: "Behind the scenes",
    changes: ["Fixes and behind-the-scenes improvements."],
  },
  {
    version: "V0.7.00",
    date: "2026-10-27",
    title: "Video previews on milestones",
    changes: [
      "Creators can add videos and animated GIFs to a milestone's previews, to show work that moves.",
      "Each video is re-recorded in the creator's browser with the Made for Stream watermark on every frame, and only that copy is uploaded.",
      "A preview video keeps the first 30 seconds, without sound.",
      "The buyer plays preview videos on the commission page, where they repeat until stopped.",
      "At payment, the summary now shows the tip, the contribution and the total as you type them.",
      "Round up brings the total to a whole number once, and rests until the total changes again.",
    ],
  },
  {
    version: "V0.6.04",
    date: "2026-10-27",
    title: "Clearer confirmations and rounding",
    changes: [
      "The buyer's confirmations on an agreement now say what each line is: something the buyer provides, something the buyer approves, or a milestone.",
      "The two Round up buttons at payment now work independently: when the total is already a whole number, pressing one takes it up to the next.",
    ],
  },
  {
    version: "V0.6.03",
    date: "2026-10-26",
    title: "Examples stay in view while you type",
    changes: [
      "The grey example inside a form field no longer disappears when you start typing: it moves underneath the field in smaller grey text.",
      "The example can be selected and copied while you fill in the field.",
    ],
  },
  {
    version: "V0.6.02",
    date: "2026-10-26",
    title: "A simpler sign-in page",
    changes: [
      "The sign-in page shows Twitch and Google as two matching buttons, with the email link below them.",
      "The box to agree to the Terms of Service and Privacy Policy is now at the bottom of the sign-in card instead of the top.",
      "Choosing a way to sign in without ticking that box now makes it shake and turn red, with a note saying why.",
    ],
  },
  {
    version: "V0.6.01",
    date: "2026-10-17",
    title: "Easier final approval",
    changes: [
      "If work sent off site still needs confirming, approving the final delivery takes you to the confirmation above the chat instead of showing an error.",
      "The confirmation box repeats why it is needed: work sent outside Made for Stream must be confirmed before the final delivery is approved.",
      "Once a project is complete, the final delivery is listed first in the project details.",
    ],
  },
  {
    version: "V0.6.00",
    date: "2026-10-17",
    title: "Confirming work sent off site",
    changes: [
      "When a creator says work was also sent outside Made for Stream, the buyer is asked, above the commission's chat, whether it arrived.",
      "The buyer's answer is written into the chat, and the creator is emailed either way.",
      "A commission cannot be completed until the buyer confirms that work sent off site arrived.",
      "Buyers are reminded by email 3 and 7 days after the work was sent, if they have not answered.",
      "A zip made on the final delivery form is named after the creator and the commission, for example \"meowington_Emote_Pack_deliverables.zip\".",
      "Uploaded file names use underscores instead of spaces, and each one gets a short unique code so two files with the same name never clash.",
      "Automatic lines in the chat have more room when they run over several lines.",
      "Automatic lines now name the people throughout, including after a title.",
    ],
  },
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
