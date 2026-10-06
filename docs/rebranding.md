# Made for Stream branding

Public name: **Made for Stream**. Tagline: **For creators, by creators.**

The application, payment descriptions, policy text, metadata, install manifest,
icons and support documentation use this name. The SVG mark is a simple M/play
symbol; raster favicons and install icons are exports of this source.

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
