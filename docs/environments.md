# Environments

Decided 2026-10-01. Nothing is publicly usable until the legal items in
`launch-implementation-checklist.md` are cleared: there is a private **dev**
environment now, and **prod** is built when they clear.

| | Dev (exists) | Prod (not built yet) |
| --- | --- | --- |
| Website | `dev.madeforstream.com`, Cloudflare Worker `made-for-stream-dev` (static assets, `wrangler.jsonc`), built from `main` | `madeforstream.com` |
| API | Cloud Run `made-for-stream-api` (`us-central1`), `STRIPE_KEY_MODE=dev` | a second Cloud Run service with live Stripe keys |
| Database | Supabase project `itbgxxczuazwroniiyot` | a new Supabase project (paid plan: free projects pause when idle) |
| Stripe | test mode (sandbox) | live mode |

`madeforstream.com` and `www` have no web records on purpose. Only email
records exist on the domain.

## What keeps dev private

1. **Cloudflare Access** on `dev.madeforstream.com`: only listed email
   addresses can load the site. The Worker's `workers.dev` address and preview
   URLs are disabled, so the custom domain is the only way in.
2. **Supabase Auth → "Allow new users to sign up" is off.** This is the real
   boundary: nobody can create an account, whatever they reach. Test accounts
   are added by hand in the Supabase dashboard.

The API itself is public on Cloud Run. Every route needs a Supabase session, a
Stripe signature, or the ops cron secret.

## Deploying

- **Web (dev):** automatic. Cloudflare builds and deploys on every push to
  `main` (`npm run build`, then `npx wrangler deploy`). The `VITE_*` values are
  **build** variables in the Worker's Settings → Build, not runtime variables.
- **API:** by hand after each API merge. Merging does not deploy.

  ```bash
  gcloud run deploy made-for-stream-api --source api --region us-central1
  ```

- **Database:** migrations are applied by hand. `list_migrations` is unreliable
  on this project; compare objects directly.

## Before prod is built

- Replay every migration on an empty database first. `056` and `058` could not
  apply on the live one (`20260926_140` explains why), so the chain may not
  replay cleanly.
- Prod needs its own: Supabase project and keys, Cloud Run service and secrets,
  Stripe live webhook endpoint and account-events destination, Cloud Scheduler
  jobs, Supabase Auth SMTP and URL settings, and `APP_ORIGIN` /
  `EMAIL_SITE_URL` pointing at `madeforstream.com`.
