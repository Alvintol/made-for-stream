// The site's text in English: the master list. Every key here needs a
// French line in fr.ts, or the type check fails. Text not moved here yet is
// still written in its component, in English.
//
// "{name}" is filled in by t(key, { name }). A plural message has a form per
// plural category ("one", "other"), chosen from { count }.

export type Message = string | { one: string; other: string };

export const en = {
  // Top bar and menu (src/components/layout/Nav.tsx)
  "nav.market": "Market",
  "nav.creators": "Creators",
  "nav.dashboard": "Dashboard",
  "nav.admin": "Admin",
  "nav.live": "Live",
  "nav.inbox": "Inbox",
  "nav.inboxUnread": { one: "Inbox, {count} unread message", other: "Inbox, {count} unread messages" },
  "nav.unread": { one: "{count} unread message", other: "{count} unread messages" },
  "nav.settings": "Settings",
  "nav.signIn": "Sign in",
  "nav.signOut": "Sign out",
  "nav.searchLabel": "Search marketplace",
  "nav.searchPlaceholder": "Search emotes, overlays, VTuber models, editors, riggers…",
  "nav.search": "Search",
  "nav.main": "Main",
  "nav.menu": "Menu",
  "nav.all": "All",
  "nav.free": "Free",
  "nav.otherCategories": "Other categories",
  "nav.categories": "Categories",
  "nav.statement": "Human-made • No generative AI",
  "nav.learnMore": "Learn more →",

  // Categories (src/domain/catalog.ts keys)
  "category.emotes": "Emotes",
  "category.overlays": "Overlays",
  "category.panels": "Panels",
  "category.screens": "Screens",
  "category.alerts": "Alerts",
  "category.badges": "Badges",
  "category.pngtuber-models": "PNG-tuber Models",
  "category.vtuber-models": "VTuber Models",
  "category.vtuber-rigging": "PNG/VTuber Rigging",
  "category.video-editing": "Video Editing",
  "category.audio-tech-help": "Audio Tech Help",
  "category.games": "Games",

  // Footer (src/components/layout/Footer.tsx)
  "footer.home": "Home",
  "footer.tagline":
    "For creators, by creators. A human-made marketplace for emotes, overlays, VTuber models, editing and audio help.",
  "footer.explore": "Explore",
  "footer.exploreNav": "Footer explore navigation",
  "footer.liveNow": "Live now",
  "footer.about": "About",
  "footer.legal": "Legal",
  "footer.legalNav": "Footer legal navigation",
  "footer.terms": "Terms",
  "footer.privacy": "Privacy",
  "footer.creatorTerms": "Creator Terms",
  "footer.cookieSettings": "Cookie settings",
  "footer.copyright": "© {year} Made for Stream • Marketplace for creator assets & services",
  "footer.whatsNew": "What’s new",
  "footer.builtBy": "Built by Alvin (Beans) •",

  // Language and currency (RegionPicker, DisplayCurrencySettings)
  "region.title": "Language and currency",
  "region.button": "Language and currency ({label})",
  "region.close": "Close",
  "display.intro":
    "Creators set prices in their own currency, and you always pay in the creator's currency. We can also show an approximate price in yours.",
  "display.language": "Language",
  "display.languageHint": "More languages are planned.",
  "display.languageHintUnfinished": "Some pages are still in English while the translation is finished.",
  "display.showPricesIn": "Show prices in",
  "display.countryCurrency": "My country's currency ({currency})",
  "display.creatorCurrency": "The creator's own currency (no conversion)",
  "display.estimateHint": "Converted prices are estimates and are marked with ≈.",
  "display.save": "Save",
  "display.saving": "Saving…",
  "display.saved": "Saved.",
  "display.guestNote": " Sign in to keep it: without an account it lasts until you reload or close this page.",
  "display.saveError": "Your choice could not be saved. Please try again.",

  // Sign-in page (src/pages/SignIn.tsx)
  "signin.policyRequired": "Please accept the Terms of Service and Privacy Policy to continue.",
  "signin.oauthFailed": "Could not start {provider} sign-in.",
  "signin.emailRequired": "Please enter your email.",
  "signin.linkFailed": "Could not send sign-in link.",
  "signin.signOutFailed": "Could not sign out.",
  "signin.signedInTitle": "You’re signed in",
  "signin.signedInAs": "Signed in as",
  "signin.yourAccount": "your account",
  "signin.signOut": "Sign out",
  "signin.browseCreators": "Browse creators",
  "signin.title": "Sign in",
  "signin.intro": "Use Twitch or Google, or get a sign-in link by email.",
  "signin.twitch": "Sign in with Twitch",
  "signin.google": "Sign in with Google",
  "signin.orByEmail": "or by email",
  "signin.email": "Email",
  "signin.emailPlaceholder": "you@example.com",
  "signin.working": "Working…",
  "signin.sendLink": "Send sign-in link",
  // "I agree to the [Terms of Service] and the [Privacy Policy]." The two
  // middle parts are links, so the sentence is in five pieces.
  "signin.agreeBefore": "I agree to the",
  "signin.agreeTerms": "Terms of Service",
  "signin.agreeAnd": "and the",
  "signin.agreePrivacy": "Privacy Policy",
  "signin.agreeAfter": ".",
  "signin.linkSent": "Link sent. Check your inbox and spam folder.",
  "signin.backHome": "Back home",
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;
