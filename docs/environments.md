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

1. **Cloudflare Access** on `dev.madeforstream.com` (Zero Trust → Access →
   Applications → `dev`): only email addresses in the policy's **Include →
   Emails** list can load the site. Login method: **One-time PIN** (a code
   emailed to the address). Without that method enabled, only members of the
   Cloudflare account can sign in. The Worker's `workers.dev` address and
   preview URLs are disabled, so the custom domain is the only way in.
   Check from outside: `curl -s -o /dev/null -w "%{http_code}" https://dev.madeforstream.com/`
   must print `302`, not `200`.
2. **Supabase Auth → "Allow new users to sign up" is off.** This is the real
   boundary: nobody can create an account, whatever they reach. Test accounts
   are added by hand in the Supabase dashboard (Authentication → Users → Add
   user, auto-confirm on). Check from outside: `GET /auth/v1/settings` with
   the publishable key must report `"disable_signup": true`.

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

## The API's health probe

Cloud Run calls `GET /api/health` every 30 seconds and restarts the API if it
fails three times in a row. The probe's path must be exactly `/api/health`.
Check it:

```bash
gcloud run services describe made-for-stream-api --region us-central1 --format="value(spec.template.spec.containers[0].livenessProbe.httpGet.path)"
```

**What went wrong (found 2026-10-05).** From 2026-09-22 to 2026-10-05 the
path was the whole option string, `/api/health httpGet.port=8787
periodSeconds=30 ...`, because the shell turned the commas in the command
into spaces. That path returns 404, so Cloud Run shut down every instance
about 30 seconds after it started. The API answered only in the gaps, and on
2026-10-05 it stopped answering at all (every route `500`). Fixed in revision
`00017`. Playbook: `support/operations/alerting.md` `OPS-004`.

**Setting it.** Run this in **Git Bash**, with the quotes, so the commas
survive. Then run the check above; do not trust the command's own output.

```bash
gcloud run services update made-for-stream-api --region us-central1 "--liveness-probe=httpGet.path=/api/health,httpGet.port=8787,periodSeconds=30,failureThreshold=3,timeoutSeconds=5"
```

A probe setting is part of the service, so later `gcloud run deploy` runs keep
it. The same goes for a wrong one: it carried through twelve revisions unnoticed.

## Before prod is built

- Replay every migration on an empty database first. `056` and `058` could not
  apply on the live one (`20260926_140` explains why), so the chain may not
  replay cleanly.
- Prod needs its own: Supabase project and keys, Cloud Run service and secrets,
  Stripe live webhook endpoint and account-events destination, Cloud Scheduler
  jobs, the health probe above (checked after it is set), Supabase Auth SMTP and URL settings, and `APP_ORIGIN` /
  `EMAIL_SITE_URL` pointing at `madeforstream.com`.
