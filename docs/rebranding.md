# Made for Stream branding

Public name: **Made for Stream**. Tagline: **For creators, by creators.**

The application, payment descriptions, policy text, metadata, install manifest,
icons and support documentation use this name.

## Logo and icons (V0.16.00)

The logo is a play-button M with a violet-to-orange gradient, beside "Made for
Stream" lettering. Each file is drawn as vector shapes: no embedded images, no
fonts, no scripts.

| File | Use |
| --- | --- |
| `public/brand/logo-light.svg`, `logo-dark.svg` | Full logo for light and dark backgrounds. The footer, and the header from 640px wide |
| `public/brand/mark-light.svg`, `mark-dark.svg` | The M alone. The header on phones |
| `public/favicon.svg`, `favicon.ico`, `favicon-*.png` | Browser tab icons, in the light colours so they show on light and dark tabs |
| `public/apple-touch-icon.png`, `android-chrome-*.png` | Home-screen icons on charcoal; the maskable one has room to be cropped |
| `public/made-for-stream-mark.svg` | The old mark's address, now holding the new light mark, so anything outside the site that still links to it shows the new logo |

`src/components/layout/BrandLogo.tsx` picks the light or dark file from the
site's theme, so only one downloads. Each full logo is 56 KB compressed, the M
12 KB; both are cached after the first visit.

| Theme | Gradient start | Gradient end | "Made for" |
| --- | --- | --- | --- |
| Light | `#8043ED` | `#F46B45` | `#181333` |
| Dark | `#B9AFE3` | `#FF805C` | `#F3F1F8` |

**An old icon still shows.** Browsers keep tab and home-screen icons for a long
time. `index.html` links them with `?v=mfs-gradient-1`: change that whenever
the icons change. Someone who still sees the old icon can reload the page or
reopen the tab; an installed home-screen icon updates when the phone next
refreshes it, or when they add it again.

**Email.** The email header is itself a violet-to-orange gradient, so the logo
would disappear into it, and `EMAIL_LOGO_URL` stays blank (a text wordmark).
Adding a logo there needs a one-colour (white) version of the logo, or a plain
header.

## Compatibility

Keep `creatorhub_*` Stripe metadata identifiers: existing Stripe objects and
webhook retries use them to associate payments with the application ledger.
Keep the `creatorhub` browser-storage keys so existing theme settings, cookie
choices and pending policy acceptance survive deployment on the same origin.
Keep development seed email identifiers so reseeding finds existing test accounts.
Historical database migrations remain unchanged, including their original error
messages. Support playbooks retain exact matches for those database errors.
The repository remains `Alvintol/creator-hub`; a repository rename is separate.

Policy text has new version identifiers and fingerprints for the rebrand. Previous
acceptance records retain their original meaning; existing acceptance gates will
ask users to accept the new applicable versions.

## Domain launch configuration

Production frontend origin: **https://madeforstream.com**. The entry HTML uses
this address for canonical and social-sharing metadata. No mailbox is assumed.
When deploying:

- Attach the domain to the frontend host and configure its DNS and HTTPS.
- Set API `APP_ORIGIN` to the exact frontend origin and `VITE_API_BASE` to the
  deployed API origin where needed.
- Update authentication site/redirect URLs, OAuth application branding and
  approved callback URLs for the actual authentication flow.
- Update Stripe public business branding and any explicitly configured Connect
  return/refresh and checkout URLs. Update webhook endpoints if the API moves.
- Configure verified sender/support mailboxes and replace legal contact
  placeholders only with real operator and contact details.
- Browser storage cannot move automatically between different origins. Users
  may need to sign in again and set their preferences on the new domain.

These hosting and provider settings are external to the repository and are not
changed by merging the rebrand.
