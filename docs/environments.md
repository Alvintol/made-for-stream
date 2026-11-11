# Environments

Decided 2026-10-01, changed 2026-11-11. Made for Stream has two separate
setups. **Prod** is the public site at `madeforstream.com`, for the soft
launch: people can sign up, apply to be creators, publish listings, send
requests and chat, and no money can move (`support/operations/pre-launch.md`).
**Dev** is private and is the staging area: every change lands there first.

| | Dev (staging, private) | Prod (public) |
| --- | --- | --- |
| Website | `dev.madeforstream.com`, Worker `made-for-stream-dev` (`wrangler.jsonc`), built from `main`, behind Cloudflare Access | `madeforstream.com`, Worker `made-for-stream` (`wrangler.prod.jsonc`), built from the `production` branch |
| API | Cloud Run `made-for-stream-api` (`us-central1`), Stripe test mode | Cloud Run `made-for-stream-api-prod` (`us-central1`), settings in `api/env.prod.yaml`, **no Stripe keys** |
| Database | Supabase `itbgxxczuazwroniiyot` (`us-west-2`), Pro plan, Small compute | Supabase `caqvtbahdhcznwnbixqq` (`made-for-stream-prod`, `us-east-2`), Small compute |
| Sign-ups | Off: test accounts are added by hand | On, with a Turnstile check on email sign-in |
| Migrations | Applied by hand, no record kept | `supabase/apply-migrations.mjs`, recorded in `supabase_migrations.schema_migrations` |
| Stripe | Test mode (sandbox) | None until launch |

Both send email from `send.madeforstream.com`. Bounce and complaint events
from both go to the prod API (`workers/email-events`), so dev records none.
Both mail ops alerts to `ops@madeforstream.com`; dev's subject lines start
`[Made for Stream dev ops]`, so only `[Made for Stream ops]` is about real
people.

## What keeps dev private

1. **Cloudflare Access** on `dev.madeforstream.com` (Zero Trust → Access →
   Applications → `dev`): only email addresses in the policy's **Include →
   Emails** list can load the site. Login method: **One-time PIN** (a code
   emailed to the address). Without that method enabled, only members of the
   Cloudflare account can sign in. The Worker's `workers.dev` address and
   preview URLs are disabled, so the custom domain is the only way in.
   Check from outside: `curl -s -o /dev/null -w "%{http_code}" https://dev.madeforstream.com/`
   must print `302`, not `200`.
2. **Supabase Auth → "Allow new users to sign up" is off** on dev. This is the
   real boundary: nobody can create an account, whatever they reach. Test
   accounts are added by hand in the Supabase dashboard (Authentication →
   Users → Add user, auto-confirm on). Check from outside: `GET
   /auth/v1/settings` with the publishable key must report
   `"disable_signup": true`.

Both APIs are public on Cloud Run. Every route that changes anything needs a
Supabase session, a Stripe signature, or a shared secret (the ops cron
secret, or `EMAIL_WEBHOOK_SECRET` for the email webhook).

## Releasing a change

Every change goes to dev first, then to prod in this order:

1. **Merge to `main`.** Dev's website deploys by itself. Apply any new migration
   to dev by hand, and deploy dev's API if `api/` changed:

   ```bash
   gcloud run deploy made-for-stream-api --source api --region us-central1
   ```

2. **Check it on dev.**
3. **Apply new migrations to prod.** In PowerShell, with
   `$env:SUPABASE_ACCESS_TOKEN` set (Supabase → Account → Access tokens):

   ```bash
   node supabase/apply-migrations.mjs caqvtbahdhcznwnbixqq --dry-run
   ```

   ```bash
   node supabase/apply-migrations.mjs caqvtbahdhcznwnbixqq
   ```

4. **Deploy prod's API** if `api/` changed:

   ```bash
   gcloud run deploy made-for-stream-api-prod --source api --region us-central1
   ```

5. **Release the website** by moving `production` to `main`. Cloudflare builds
   and deploys it:

   ```bash
   git push origin origin/main:refs/heads/production
   ```

Order matters: migration, then API, then website. The website reading a
column that doesn't exist yet breaks every page that lists it (seen with
`listings.currency`, `20261007_146`).

The `VITE_*` values are **build** variables in each Worker's Settings →
Build, not runtime variables. `.env` is not in git, so a build only gets what
is set there. Every `VITE_*` the site reads must be set on both Workers. On
dev, `VITE_STRIPE_PUBLISHABLE_KEY_DEV` must come from the **same Stripe
sandbox** as the API's `STRIPE_SECRET_KEY_DEV`, or payout setup fails
(`support/payments/connect-onboarding.md` `CON-008`).

**Dev's migrations stay manual.** `apply-migrations.mjs` refuses dev: dev has
tables but no record of which files ran, and replaying old files would
overwrite newer functions. `list_migrations` is unreliable on dev; compare
objects directly.

## Setting up prod (once, 2026-11-11)

Alvin does these, in this order. Nothing here moves money.

### 1. Database (`caqvtbahdhcznwnbixqq`)

1. Project Settings → Compute and Disk → **Small**. It's paid; the default
   smallest size ran out of disk on dev (`OPS-005`). Billing emails already go
   to `ops@madeforstream.com` (same organization).
2. Apply every migration, from the repository root in PowerShell, as in
   [Releasing a change](#releasing-a-change) step 3. On an empty database it
   applies all of them. If one fails, nothing from that file is kept: fix the
   file and run it again. `056` was changed on 2026-11-11 so the chain replays
   (`20260926_140` explains why it never applied on dev).
3. Authentication → Sign In / Providers: **allow new users to sign up**, email
   on, and Google and Twitch on with the same client ID and secret as dev.
   Add `https://caqvtbahdhcznwnbixqq.supabase.co/auth/v1/callback` to the
   Google OAuth client's redirect URIs and to the Twitch app's OAuth redirect
   URLs.
4. Authentication → URL Configuration: Site URL `https://madeforstream.com`,
   redirect URL `https://madeforstream.com/**`.
5. Authentication → Emails: SMTP settings as on dev, and paste the templates
   from `supabase/templates/` (`support/messaging/transactional-email.md`).
   Set Rate Limits to match dev.
6. Authentication → Attack Protection: **CAPTCHA protection on**, provider
   Turnstile, with the secret from step 2 below.
7. Realtime → Settings: match dev (public access off; the site only uses
   private channels).

### 2. Turnstile

Cloudflare → Turnstile → Add widget: hostname `madeforstream.com`, mode
Managed, pre-clearance **No** (so it sets no cookie). The site key goes to the
prod Worker's `VITE_TURNSTILE_SITE_KEY`, the secret key to Supabase (step 1.6).
Never set the site key on dev unless dev's Supabase has CAPTCHA on too, or
email sign-in on dev stops (`support/auth/sign-in.md` `AUTH-008`).

### 3. API (`made-for-stream-api-prod`)

New secrets for prod, in **Git Bash** (nothing is printed). Two random ones:

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | gcloud secrets create PROD_OAUTH_STATE_SECRET --data-file=-
```

```bash
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | gcloud secrets create PROD_OPS_CRON_SECRET --data-file=-
```

And prod's service role key (Supabase → Project Settings → API keys). Paste
it at the silent prompt:

```bash
read -rs KEY && printf %s "$KEY" | gcloud secrets create PROD_SUPABASE_SERVICE_ROLE_KEY --data-file=- ; unset KEY
```

Twitch, SMTP, the support address, the company address and the email
webhook secret are shared with dev. Deploy, in **Git Bash**, with the quotes,
so the commas survive:

```bash
gcloud run deploy made-for-stream-api-prod --source api --region us-central1 --allow-unauthenticated --memory 512Mi --max-instances 10 --cpu-boost --env-vars-file api/env.prod.yaml "--set-secrets=SUPABASE_SERVICE_ROLE_KEY=PROD_SUPABASE_SERVICE_ROLE_KEY:latest,OAUTH_STATE_SECRET=PROD_OAUTH_STATE_SECRET:latest,OPS_CRON_SECRET=PROD_OPS_CRON_SECRET:latest,TWITCH_CLIENT_SECRET=TWITCH_CLIENT_SECRET:latest,EMAIL_SMTP_PASS=EMAIL_SMTP_PASS:latest,EMAIL_SUPPORT_EMAIL=EMAIL_SUPPORT_EMAIL:latest,EMAIL_COMPANY_ADDRESS=EMAIL_COMPANY_ADDRESS:latest,EMAIL_WEBHOOK_SECRET=EMAIL_WEBHOOK_SECRET:latest"
```

If it refuses a secret, grant the service account
(`422533033771-compute@developer.gserviceaccount.com`) **Secret Manager Secret
Accessor** on it. Then:

- Check `https://made-for-stream-api-prod-422533033771.us-central1.run.app/api/health`
  answers. `api/env.prod.yaml` and `workers/email-events` assume that address.
- Set and check the [health probe](#the-apis-health-probe), with
  `made-for-stream-api-prod` in place of the service name.
- Add `https://made-for-stream-api-prod-422533033771.us-central1.run.app/api/twitch/connect/callback`
  to the Twitch app's OAuth redirect URLs (for linking a Twitch account).
- The ops alerts job, in Git Bash:

  ```bash
  gcloud scheduler jobs create http mfs-prod-ops-alerts --location us-central1 --schedule "45 * * * *" --time-zone "Etc/UTC" --http-method POST --uri "https://made-for-stream-api-prod-422533033771.us-central1.run.app/api/internal/ops/alerts/run" --headers "Authorization=Bearer $(gcloud secrets versions access latest --secret PROD_OPS_CRON_SECRET)" --attempt-deadline 180s
  ```

  No `connect-resync` job on prod: it only talks to Stripe. Add it at launch.
- Deploy the email-events Worker, so bounces reach prod:

  ```bash
  npx wrangler deploy --config workers/email-events/wrangler.jsonc
  ```

### 4. Website (`made-for-stream`)

1. Push the `production` branch ([Releasing a change](#releasing-a-change)
   step 5).
2. Cloudflare → Workers & Pages → Create → import the repository. Worker name
   `made-for-stream`, production branch `production`, build command
   `npm run build`, deploy command
   `npx wrangler deploy --config wrangler.prod.jsonc`. Turn **off** builds for
   other branches.
3. Build variables: the same names as dev's Worker, with prod values:
   `VITE_SUPABASE_URL` `https://caqvtbahdhcznwnbixqq.supabase.co`,
   `VITE_SUPABASE_ANON_KEY` prod's publishable key, `VITE_API_BASE`
   `https://made-for-stream-api-prod-422533033771.us-central1.run.app`,
   `VITE_STRIPE_KEY_MODE` `prod`, and `VITE_TURNSTILE_SITE_KEY`. Leave out
   every Stripe key, AdSense value and `VITE_PLATFORM_TAX_NUMBER`.
4. The first deploy creates the `madeforstream.com` custom domain and its DNS
   record. The email records on the domain stay as they are.
5. Optional: `www` → Rules → Redirect Rules → "Redirect from WWW to root",
   with a proxied `AAAA www 100::` record.

### 5. Check it, then make yourself admin

On `madeforstream.com`: sign up by email (the check appears above the send
button), with Google and with Twitch. Then, in prod's SQL editor, with your
user id from Authentication → Users:

```sql
insert into public.admin_roles (profile_user_id) values ('<your user id>');
```

Then apply as a creator, approve it in Admin, publish a listing, send a
request from a second account and chat. The banner must say payments aren't
open, and Accept must be greyed out.

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

## The database is the smallest instance (OPS-005)

Until 2026-10-06 dev ran on Supabase's free plan, on its smallest instance
(Nano, at most 0.5 GB of memory). That day it used up its daily disk
allowance and stopped answering: nobody could sign in. Playbook:
`support/operations/alerting.md` `OPS-005`.

The organization (`ImAllBeans`) is now on the **Pro** plan and both projects
are on **Small** compute (2 GB). Two things to know:

- Upgrading the plan does not change the machine. The size is set per
  project: Project Settings → Compute and Disk. Changing it restarts the
  database.
- Supabase's billing and usage emails go to the organization's billing email
  (Organization → Billing), set to `ops@madeforstream.com`.

## Before payments open (launch)

- Prod needs live Stripe: the live keys and webhook secrets as Secret Manager
  references on `made-for-stream-api-prod`, the live webhook endpoint and
  account-events destination pointing at it, and the `connect-resync` job.
- Follow "Opening payments at launch" in `support/operations/pre-launch.md`.
