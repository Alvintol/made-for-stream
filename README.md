# Made for Stream

**For creators, by creators.**

Production domain: [madeforstream.com](https://madeforstream.com).

Branding compatibility and domain launch settings: [Rebranding notes](docs/rebranding.md).

A creator-first hub and marketplace for digital creator work: emotes, PNG/VTuber models, overlays, rigging, video editing and more. It is built around **trust** (verified creators, agreements, protected payments) and **discoverability** (market browsing, creator profiles, "Live now").

**Status:** Active development (beta). The web app, request workflow, messaging, moderation and Stripe payments are functional against Supabase.

---

## Why Made for Stream exists

Creators often struggle to:
- get discovered by a niche audience
- prove legitimacy and avoid impersonation
- avoid scams (buyers or sellers disappearing, refusing to pay, or not delivering)

Made for Stream makes it easy to find trusted creators, agree on the work up front, and pay safely in stages so both sides are protected.

---

## Features

**Discovery**
- Market browsing with category filters (`/market`)
- Creator directory and public creator profiles (`/creators`, `/creator/:handle`)
- Live creators powered by Twitch (`/live`)
- Listing pages with request forms (`/listing/:id`, `/listing/:id/request`)

**Creators**
- Creator applications, with admin review
- Listing drafts, editing, publish checks and revision history
- Stripe Connect onboarding, embedded in profile settings

**Requests (buyer ↔ creator workspace)**
- One workspace layout for buyers, creators and admins (`/requests/:id`, `/creator/requests/:id`, `/admin/requests/:id`)
- A "Next step" card that shows whose turn it is and jumps to the right section
- Chat as the main column; project details sit in collapsible sections that surface when they need attention
- On phones, Messages and Project tabs sit under the Next step card
- Project agreements with scope, timeline, revision policy and buyer confirmations
- Payment structures: full prepayment, deposit plus balance, or milestone payments
- Milestone submissions and reviews, change orders, progress updates and final deliveries
- Large creator forms open in a full-page sheet

**Messaging and safety**
- Inquiry and request conversations with read receipts
- Buyer image uploads, which the creator must approve
- Reporting and ending conversations, plus a report status page for users
- Admin moderation queue and report details

**Payments**
- Stripe Checkout for starting, milestone, change-order and final-balance payments
- Stripe webhooks apply the results; fees are calculated server-side

**UI**
- Indigo/frost theme with a muted dark mode and a light/dark toggle
- GSAP motion (page transitions, collapsible panels, parallax home hero), with reduced-motion support

---

## Tech stack

| Area | Tools |
| --- | --- |
| Web app | React 19, TypeScript, Vite 7, React Router 7 |
| Data | TanStack Query 5, Supabase (Postgres, Auth, RLS, RPCs) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`), shared component classes in `src/styles/ui.css` |
| Motion | GSAP, `@gsap/react`, ScrollTrigger |
| API | Node + Express (`api/server.js`): Stripe, Stripe Connect, Twitch OAuth and streams |
| Payments | Stripe Checkout, Stripe Connect (embedded onboarding) |
| Testing | Vitest, Testing Library, jsdom |

---

## Project structure

```text
api/                  Express API (Stripe, Stripe Connect, Twitch) and dev seed script
public/               Static assets
src/
  components/         UI by feature (listingRequests/, conversations/, listings/, layout/, ui/ …)
  domain/             Pure business rules (request stages, agreements, milestones, payments …)
  hooks/              TanStack Query hooks around Supabase and the API
  lib/                Env, Supabase and Stripe clients, motion (GSAP) and theme helpers
  pages/              Route components (buyer/, creator/, admin/, messages/ …)
  providers/          App-level providers (auth, query client, theme)
  styles/             Tailwind entry, theme tokens and shared component classes
supabase/migrations/  Database schema, RLS policies and RPCs, applied in order
```

Tests live next to the code in `tests/` folders (for example `src/domain/tests`, `src/pages/tests`).

---

## Getting started

### Prerequisites
- Node.js 20.19+ or 22.12+ (required by Vite 7)
- A Supabase project with the migrations in `supabase/migrations` applied in filename order
- A Stripe account in test mode, for payments
- A Twitch application, for live status and account linking

### Install

```bash
npm install
```

```bash
npm install --prefix api
```

### Configure environment

Copy the examples and fill in your own values. Never commit real keys.

```bash
cp .env.example .env.local
```

```bash
cp api/.env.example api/.env
```

**Web app** (`.env.local`)

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase project (required) |
| `VITE_API_BASE` | Base URL of the Express API (default port `8787`) |
| `VITE_STRIPE_KEY_MODE` | `dev` or `prod`; picks the publishable key |
| `VITE_STRIPE_PUBLISHABLE_KEY_DEV`, `VITE_STRIPE_PUBLISHABLE_KEY_PROD` | Stripe publishable keys |
| `VITE_STRIPE_PAYMENTS_ENABLED` | Turns payment UI on or off |
| `VITE_BETA_MODE` | Beta-mode UI flags |
| `VITE_ADSENSE_ENABLED`, `VITE_ADSENSE_CLIENT_ID` | Optional AdSense slots |

**API** (`api/.env`)

| Variable | Purpose |
| --- | --- |
| `PORT`, `APP_ORIGIN` | API port, and the web app origin used for CORS and Stripe redirects |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access (keep secret) |
| `STRIPE_KEY_MODE` | `dev` or `prod` |
| `STRIPE_SECRET_KEY_DEV`, `STRIPE_SECRET_KEY_PROD` | Stripe secret keys |
| `STRIPE_WEBHOOK_SECRET_DEV`, `STRIPE_WEBHOOK_SECRET_PROD` | Signing secrets for `/api/stripe/webhook` |
| `STRIPE_CONNECT_RETURN_URL`, `STRIPE_CONNECT_REFRESH_URL`, `STRIPE_CONNECT_SETUP_URL`, `STRIPE_CHECKOUT_RETURN_PATH` | Stripe redirect targets |
| `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_REDIRECT_URI` | Twitch OAuth and streams |
| `OAUTH_STATE_SECRET` | Signs OAuth state |

### Run locally

Start the API (port 8787 by default):

```bash
npm run dev --prefix api
```

In a second terminal, start the web app. Vite proxies `/api` to the API:

```bash
npm run dev
```

To receive webhooks locally, forward Stripe events to the API:

```bash
stripe listen --forward-to localhost:8787/api/stripe/webhook
```

Optionally, seed development data:

```bash
npm run seed:dev:data --prefix api
```

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run Vitest in watch mode (`npx vitest run` for a single run) |
| `npm run test:ui` | Vitest UI |
| `npm run lint` | ESLint |

---

## Roadmap

- **Discovery:** search improvements, featured listings and boosts
- **Trust:** YouTube account linking, verified badges
- **Payments:** dispute windows, timeout-based release, payout reporting
- **Messaging:** listing inquiry UI (the backend RPC exists), a single shared chat view
- **Mobile:** navigation menu for small screens
- **Sustainability:** banner ads in the reserved side gutters once traffic exists
